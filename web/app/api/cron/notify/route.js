// GET /api/cron/notify — checks for new jobs and emails subscribers
// Secured with CRON_SECRET header. Triggered every hour.
import { Resend } from "resend";
import { Redis } from "@upstash/redis";
import { clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min max for Vercel

const BANK_ENDPOINTS = {
  jpmc: "/api/jobs",
  gs: "/api/jobs-gs",
  ms: "/api/jobs-ms",
  bofa: "/api/jobs-bofa",
  citi: "/api/jobs-citi",
  db: "/api/jobs-db",
  barclays: "/api/jobs-barclays",
  ubs: "/api/jobs-ubs",
};

const BANK_NAMES = {
  jpmc: "JPMorgan Chase",
  gs: "Goldman Sachs",
  ms: "Morgan Stanley",
  bofa: "Bank of America",
  citi: "Citi",
  db: "Deutsche Bank",
  barclays: "Barclays",
  ubs: "UBS",
};

function isInternship(title) {
  const t = title.toLowerCase();
  return /\bintern\b/.test(t) || t.includes("internship") || t.includes("summer") || t.includes("co-op") || t.includes("coop");
}

function isGraduateProgram(title) {
  const t = title.toLowerCase();
  return /\bgraduate\b/.test(t) || /\bgrad\s+program/.test(t) || /\bgrad\s+programme/.test(t);
}

function buildEmailHtml(newJobs, userName) {
  const grouped = {};
  for (const job of newJobs) {
    const bank = job.bank || "Other";
    if (!grouped[bank]) grouped[bank] = [];
    grouped[bank].push(job);
  }

  let jobRows = "";
  for (const [bank, jobs] of Object.entries(grouped)) {
    jobRows += `<tr><td colspan="3" style="padding:16px 0 8px;font-size:16px;font-weight:700;color:#1e293b;border-bottom:1px solid #e2e8f0;">${bank}</td></tr>`;
    for (const job of jobs) {
      const type = isInternship(job.title) ? "Internship" : "Analyst";
      const typeColor = type === "Internship" ? "#d97706" : "#2563eb";
      jobRows += `
        <tr>
          <td style="padding:10px 0;font-size:14px;">
            <a href="${job.link}" style="color:#1e293b;text-decoration:none;font-weight:500;">${job.title}</a>
          </td>
          <td style="padding:10px 8px;font-size:12px;color:#64748b;">${job.location || ""}</td>
          <td style="padding:10px 0;font-size:11px;font-weight:600;color:${typeColor};text-transform:uppercase;">${type}</td>
        </tr>`;
    }
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="margin-bottom:24px;">
      <span style="font-size:18px;font-weight:800;color:#1e293b;">Pete's Postings</span>
    </div>
    <p style="font-size:15px;color:#334155;margin:0 0 8px;">Hey${userName ? " " + userName : ""},</p>
    <p style="font-size:15px;color:#334155;margin:0 0 24px;">${newJobs.length} new ${newJobs.length === 1 ? "posting" : "postings"} matching your preferences just went live:</p>
    <table style="width:100%;border-collapse:collapse;">
      ${jobRows}
    </table>
    <div style="margin-top:32px;text-align:center;">
      <a href="https://petespostings.com" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Browse All Jobs</a>
    </div>
    <p style="margin-top:32px;font-size:12px;color:#94a3b8;text-align:center;">
      You're receiving this because you enabled job notifications on Pete's Postings.<br>
      To unsubscribe, turn off notifications in your dashboard settings.
    </p>
  </div>
</body>
</html>`;
}

export async function GET(request) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://petespostings.com";

    // 1. Fetch jobs from all banks in parallel
    const bankEntries = Object.entries(BANK_ENDPOINTS);
    const results = await Promise.allSettled(
      bankEntries.map(async ([bankKey, endpoint]) => {
        const res = await fetch(`${baseUrl}${endpoint}`, {
          headers: { "User-Agent": "PetesPostings-Cron/1.0" },
        });
        if (!res.ok) throw new Error(`${bankKey}: ${res.status}`);
        const data = await res.json();
        return { bankKey, jobs: data.jobs || [] };
      })
    );

    // Collect all current jobs
    const allJobs = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        const { bankKey, jobs } = result.value;
        for (const job of jobs) {
          if (isGraduateProgram(job.title)) continue;
          allJobs.push({ ...job, bank: BANK_NAMES[bankKey], bankKey });
        }
      }
    }

    // 2. Compare against Redis to find new jobs
    const currentLinks = allJobs.map((j) => j.link);
    const seenLinks = await redis.smembers("seen-job-links");
    const seenSet = new Set(seenLinks);

    const newJobs = allJobs.filter((j) => !seenSet.has(j.link));

    // Store new job data in Redis for the "New Postings" feature
    // Uses actual postedDate from the bank API where available, otherwise first-detected timestamp
    // Only store jobs posted within the last 7 days (skip stale jobs that somehow appear new)
    if (newJobs.length > 0) {
      const detectedAt = Date.now();
      const sevenDaysAgo = detectedAt - 7 * 24 * 60 * 60 * 1000;
      const jobInfoPairs = {};
      for (const job of newJobs) {
        // Skip if the bank says this job was posted more than 7 days ago
        if (job.postedDate) {
          const ts = new Date(job.postedDate).getTime();
          if (!isNaN(ts) && ts < sevenDaysAgo) continue;
        }
        // If the bank provides a postedDate, use it as detectedAt so that
        // old jobs re-appearing (e.g. after a Redis wipe) age out correctly.
        let jobDetectedAt = detectedAt;
        if (job.postedDate) {
          const postedTs = new Date(job.postedDate).getTime();
          if (!isNaN(postedTs)) jobDetectedAt = Math.min(detectedAt, postedTs);
        }
        jobInfoPairs[job.link] = JSON.stringify({
          title: job.title,
          location: job.location || "",
          bank: job.bank,
          bankKey: job.bankKey,
          category: job.category || "",
          postedDate: job.postedDate || null,
          detectedAt: jobDetectedAt,
        });
      }
      // Store in batches of 100 to avoid oversized requests
      const pairs = Object.entries(jobInfoPairs);
      for (let i = 0; i < pairs.length; i += 100) {
        const batch = Object.fromEntries(pairs.slice(i, i + 100));
        await redis.hset("job-first-seen", batch);
      }
      // Clean up entries older than 30 days
      const thirtyDaysAgo = detectedAt - 30 * 24 * 60 * 60 * 1000;
      const allEntries = await redis.hgetall("job-first-seen");
      if (allEntries) {
        const toDelete = Object.entries(allEntries)
          .filter(([, val]) => {
            try {
              const d = JSON.parse(val);
              return (d.postedDate ? new Date(d.postedDate).getTime() : d.detectedAt) < thirtyDaysAgo;
            } catch { return false; }
          })
          .map(([key]) => key);
        if (toDelete.length > 0) {
          await redis.hdel("job-first-seen", ...toDelete);
        }
      }
    }

    // If no new jobs, update seen set and exit
    if (newJobs.length === 0) {
      // Still update the seen set (remove expired links, add any missing)
      if (currentLinks.length > 0) {
        await redis.del("seen-job-links");
        // Add in batches of 100
        for (let i = 0; i < currentLinks.length; i += 100) {
          const batch = currentLinks.slice(i, i + 100);
          await redis.sadd("seen-job-links", ...batch);
        }
      }
      return Response.json({ message: "No new jobs", totalJobs: allJobs.length });
    }

    // 3. Fetch all subscribed users with notifications enabled
    const client = await clerkClient();
    let allUsers = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const userList = await client.users.getUserList({ limit, offset });
      allUsers.push(...userList.data);
      if (userList.data.length < limit) break;
      offset += limit;
    }

    // Filter to subscribed users with notifications enabled
    const notifyUsers = allUsers.filter((u) => {
      const sub = u.publicMetadata?.subscribed === true;
      const notif = u.unsafeMetadata?.notifications;
      return sub && notif?.enabled === true;
    });

    // 4. For each user, filter new jobs by their preferences and send email + SMS
    let emailsSent = 0;
    let smsSent = 0;

    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
    const twilioEnabled = twilioSid && twilioToken && twilioFrom;

    for (const user of notifyUsers) {
      const prefs = user.unsafeMetadata.notifications;
      const prefBanks = prefs.banks || [];
      const prefCategories = prefs.categories || [];
      const prefJobType = prefs.jobType || "all";

      const matchingJobs = newJobs.filter((job) => {
        // Bank filter
        if (prefBanks.length > 0 && !prefBanks.includes(job.bankKey)) return false;

        // Category filter
        if (prefCategories.length > 0 && !prefCategories.includes(job.category)) return false;

        // Job type filter
        if (prefJobType === "internship" && !isInternship(job.title)) return false;
        if (prefJobType === "fulltime" && isInternship(job.title)) return false;

        return true;
      });

      if (matchingJobs.length === 0) continue;

      const email = user.emailAddresses[0]?.emailAddress;
      const firstName = user.firstName || "";

      // Send email
      if (email) {
        try {
          await resend.emails.send({
            from: "Pete's Postings <notifications@petespostings.com>",
            to: email,
            subject: `${matchingJobs.length} new ${matchingJobs.length === 1 ? "job" : "jobs"} on Pete's Postings`,
            html: buildEmailHtml(matchingJobs, firstName),
          });
          emailsSent++;
        } catch (emailErr) {
          console.error(`Failed to email ${email}:`, emailErr);
        }
      }

      // Send SMS if user has it enabled and provided a phone number
      if (twilioEnabled && prefs.smsEnabled && prefs.phoneNumber) {
        try {
          const jobLines = matchingJobs.slice(0, 3).map((j) => `• ${j.title} @ ${j.bank}`).join("\n");
          const more = matchingJobs.length > 3 ? `\n+ ${matchingJobs.length - 3} more` : "";
          const body = `Pete's Postings: ${matchingJobs.length} new ${matchingJobs.length === 1 ? "job" : "jobs"} just posted:\n${jobLines}${more}\n\npetespostings.com`;

          const encoded = new URLSearchParams({ To: prefs.phoneNumber, From: twilioFrom, Body: body });
          const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
            },
            body: encoded.toString(),
          });
          if (resp.ok) smsSent++;
          else console.error(`SMS failed for ${prefs.phoneNumber}:`, await resp.text());
        } catch (smsErr) {
          console.error(`Failed to SMS ${prefs.phoneNumber}:`, smsErr);
        }
      }
    }

    // 5. Update Redis seen set with current links
    if (currentLinks.length > 0) {
      await redis.del("seen-job-links");
      for (let i = 0; i < currentLinks.length; i += 100) {
        const batch = currentLinks.slice(i, i + 100);
        await redis.sadd("seen-job-links", ...batch);
      }
    }

    return Response.json({
      message: "Notifications sent",
      newJobs: newJobs.length,
      totalJobs: allJobs.length,
      smsSent,
      usersNotified: emailsSent,
    });
  } catch (err) {
    console.error("Cron notify error:", err);
    return Response.json({ error: "Cron failed", details: err.message }, { status: 500 });
  }
}
