// GET /api/cron/notify — checks for new jobs and queues notifications in Postgres
// Secured with CRON_SECRET header. Triggered every hour.
import { Redis } from "@upstash/redis";
import { clerkClient } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { isGraduateProgram, isInternship } from "@/lib/notif-helpers";

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

export async function GET(request) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
    if (newJobs.length > 0) {
      const detectedAt = Date.now();
      const sevenDaysAgo = detectedAt - 7 * 24 * 60 * 60 * 1000;
      const jobInfoPairs = {};
      for (const job of newJobs) {
        if (job.postedDate) {
          const ts = new Date(job.postedDate).getTime();
          if (!isNaN(ts) && ts < sevenDaysAgo) continue;
        }
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

        // Write to Postgres jobs table
        await sql`
          INSERT INTO jobs (link, title, bank, bank_key, location, category, posted_date, detected_at)
          VALUES (
            ${job.link},
            ${job.title},
            ${job.bank},
            ${job.bankKey || ''},
            ${job.location || ''},
            ${job.category || ''},
            ${job.postedDate ? new Date(job.postedDate) : null},
            ${new Date(jobDetectedAt)}
          )
          ON CONFLICT (link) DO NOTHING
        `;
      }
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
      if (currentLinks.length > 0) {
        await redis.del("seen-job-links");
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

    const notifyUsers = allUsers.filter((u) => {
      const sub = u.publicMetadata?.subscribed === true;
      const notif = u.unsafeMetadata?.notifications;
      return sub && notif?.enabled === true;
    });

    // 4. For each user, filter new jobs by their preferences and INSERT into notification_queue
    let queued = 0;

    for (const user of notifyUsers) {
      const prefs = user.unsafeMetadata.notifications;
      const prefBanks = prefs.banks || [];
      const prefCategories = prefs.categories || [];
      const prefJobType = prefs.jobType || "all";

      const matchingJobs = newJobs.filter((job) => {
        if (prefBanks.length > 0 && !prefBanks.includes(job.bankKey)) return false;
        if (prefCategories.length > 0 && !prefCategories.includes(job.category)) return false;
        if (prefJobType === "internship" && !isInternship(job.title)) return false;
        if (prefJobType === "fulltime" && isInternship(job.title)) return false;
        return true;
      });

      if (matchingJobs.length === 0) continue;

      // Batch insert all matching jobs for this user
      for (const job of matchingJobs) {
        await sql`
          INSERT INTO notification_queue (user_id, job_link, job_title, job_bank, job_location, job_category)
          VALUES (${user.id}, ${job.link}, ${job.title}, ${job.bank}, ${job.location || ''}, ${job.category || ''})
        `;
        queued++;
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
      message: "Jobs queued for notification",
      newJobs: newJobs.length,
      totalJobs: allJobs.length,
      queued,
    });
  } catch (err) {
    console.error("Cron notify error:", err);
    return Response.json({ error: "Cron failed", details: err.message }, { status: 500 });
  }
}
