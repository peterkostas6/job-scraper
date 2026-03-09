// GET /api/cron/notify — polls all bank APIs every 30 mins, detects new jobs, queues notifications
// Uses Postgres jobs table as the dedup source of truth (no Redis dependency).
// Sends an owner summary email to pete@petespostings.com after every run.
import { clerkClient } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { Resend } from "resend";
import { isGraduateProgram, isInternship, isBankingEntryLevel } from "@/lib/notif-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const OWNER_EMAIL = "pete@petespostings.com";

const BANK_ENDPOINTS = {
  jpmc: "/api/jobs",
  gs: "/api/jobs-gs",
  ms: "/api/jobs-ms",
  bofa: "/api/jobs-bofa",
  citi: "/api/jobs-citi",
  db: "/api/jobs-db",
  barclays: "/api/jobs-barclays",
  wells: "/api/jobs-wells",
  mufg: "/api/jobs-mufg",
  td: "/api/jobs-td",
  mizuho: "/api/jobs-mizuho",
  bmo: "/api/jobs-bmo",
  hl: "/api/jobs-hl",
  guggenheim: "/api/jobs-guggenheim",
  macquarie: "/api/jobs-macquarie",
  piper: "/api/jobs-piper",
  stifel: "/api/jobs-stifel",
};

const BANK_NAMES = {
  jpmc: "JPMorgan Chase",
  gs: "Goldman Sachs",
  ms: "Morgan Stanley",
  bofa: "Bank of America",
  citi: "Citi",
  db: "Deutsche Bank",
  barclays: "Barclays",
  wells: "Wells Fargo",
  mufg: "MUFG",
  td: "TD Securities",
  mizuho: "Mizuho",
  bmo: "BMO",
  hl: "Houlihan Lokey",
  guggenheim: "Guggenheim",
  macquarie: "Macquarie",
  piper: "Piper Sandler",
  stifel: "Stifel",
};

function formatTimestamp(d) {
  return d.toUTCString();
}

function buildOwnerSummaryHtml({ runAt, allJobs, newJobs, skippedBrokenLinks, bankStats, queued, notifiedUsers }) {
  // New jobs table
  let newJobsSection = "";
  if (newJobs.length === 0) {
    newJobsSection = `
      <tr>
        <td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;font-size:14px;background:#f8fafc;border-radius:6px;">
          No new jobs found this run
        </td>
      </tr>`;
  } else {
    newJobsSection = newJobs.map((job) => {
      const type = isInternship(job.title) ? "Internship" : "Analyst";
      const typeColor = type === "Internship" ? "#d97706" : "#2563eb";
      return `
        <tr>
          <td style="padding:8px 12px 8px 0;font-size:13px;border-bottom:1px solid #f1f5f9;">
            <a href="${job.link}" style="color:#1e293b;text-decoration:none;font-weight:500;">${job.title}</a>
          </td>
          <td style="padding:8px 12px;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${job.bank}</td>
          <td style="padding:8px 12px;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;">${job.location || "—"}</td>
          <td style="padding:8px 0;font-size:11px;font-weight:700;color:${typeColor};border-bottom:1px solid #f1f5f9;white-space:nowrap;">${type.toUpperCase()}</td>
        </tr>`;
    }).join("");
  }

  // Bank breakdown table
  const bankRows = Object.entries(bankStats).map(([bankKey, stats]) => {
    const name = BANK_NAMES[bankKey] || bankKey;
    const statusHtml = stats.error
      ? `<span style="color:#ef4444;">&#10007; Error: ${stats.error}</span>`
      : `<span style="color:#16a34a;">&#10003; ${stats.total} fetched &nbsp;&#183;&nbsp; ${stats.kept} entry-level</span>`;
    return `
      <tr>
        <td style="padding:7px 12px 7px 0;font-size:13px;border-bottom:1px solid #f1f5f9;color:#334155;">${name}</td>
        <td style="padding:7px 0;font-size:12px;border-bottom:1px solid #f1f5f9;">${statusHtml}</td>
      </tr>`;
  }).join("");

  const errorCount = Object.values(bankStats).filter((s) => s.error).length;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:32px 24px;">

    <table style="width:100%;margin-bottom:24px;"><tr>
      <td><span style="font-size:17px;font-weight:800;color:#1e293b;">Pete's Postings</span></td>
      <td style="text-align:right;font-size:12px;color:#94a3b8;">Cron Summary</td>
    </tr></table>

    <p style="margin:0 0 24px;font-size:13px;color:#64748b;">
      Run at: <strong style="color:#334155;">${formatTimestamp(runAt)}</strong>
    </p>

    <!-- Stats row -->
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;text-align:center;border-right:1px solid #e2e8f0;">
          <div style="font-size:32px;font-weight:800;color:#1e293b;">${allJobs.length}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">Total jobs live</div>
        </td>
        <td style="padding:20px 24px;text-align:center;border-right:1px solid #e2e8f0;">
          <div style="font-size:32px;font-weight:800;color:${newJobs.length > 0 ? "#16a34a" : "#94a3b8"};">${newJobs.length}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">New this run</div>
        </td>
        <td style="padding:20px 24px;text-align:center;border-right:1px solid #e2e8f0;">
          <div style="font-size:32px;font-weight:800;color:#1e293b;">${queued}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">Notifications queued</div>
        </td>
        <td style="padding:20px 24px;text-align:center;border-right:1px solid #e2e8f0;">
          <div style="font-size:32px;font-weight:800;color:${errorCount > 0 ? "#ef4444" : "#94a3b8"};">${errorCount}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">Bank errors</div>
        </td>
        <td style="padding:20px 24px;text-align:center;">
          <div style="font-size:32px;font-weight:800;color:${skippedBrokenLinks > 0 ? "#f59e0b" : "#94a3b8"};">${skippedBrokenLinks}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">Broken links skipped</div>
        </td>
      </tr>
    </table>

    <!-- New jobs -->
    <h3 style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">
      New Jobs Detected (${newJobs.length})
    </h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
      <tr>
        <th style="text-align:left;font-size:11px;color:#94a3b8;padding:0 12px 8px 0;font-weight:600;">TITLE</th>
        <th style="text-align:left;font-size:11px;color:#94a3b8;padding:0 12px 8px;font-weight:600;">BANK</th>
        <th style="text-align:left;font-size:11px;color:#94a3b8;padding:0 12px 8px;font-weight:600;">LOCATION</th>
        <th style="text-align:left;font-size:11px;color:#94a3b8;padding:0 0 8px;font-weight:600;">TYPE</th>
      </tr>
      ${newJobsSection}
    </table>

    <!-- Bank breakdown -->
    <h3 style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">
      Bank Breakdown
    </h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:32px;">
      <tr>
        <th style="text-align:left;font-size:11px;color:#94a3b8;padding:0 0 8px;font-weight:600;">BANK</th>
        <th style="text-align:left;font-size:11px;color:#94a3b8;padding:0 0 8px;font-weight:600;">STATUS</th>
      </tr>
      ${bankRows}
    </table>

    <p style="font-size:11px;color:#cbd5e1;margin:0;">
      Pete's Postings owner alert — sent automatically every 30 minutes
    </p>
  </div>
</body>
</html>`;
}

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runAt = new Date();

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://petespostings.com";

    // 1. Fetch jobs from all banks in parallel
    const bankEntries = Object.entries(BANK_ENDPOINTS);
    const rawResults = await Promise.allSettled(
      bankEntries.map(async ([bankKey, endpoint]) => {
        const res = await fetch(`${baseUrl}${endpoint}`, {
          headers: { "User-Agent": "PetesPostings-Cron/1.0" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { bankKey, jobs: data.jobs || [] };
      })
    );

    // Collect all current entry-level jobs + per-bank stats
    const allJobs = [];
    const bankStats = {};
    for (let i = 0; i < rawResults.length; i++) {
      const bankKey = bankEntries[i][0];
      const result = rawResults[i];
      if (result.status === "fulfilled") {
        const { jobs } = result.value;
        let kept = 0;
        for (const job of jobs) {
          if (isGraduateProgram(job.title)) continue;
          if (!isBankingEntryLevel(job.title)) continue;
          allJobs.push({ ...job, bank: BANK_NAMES[bankKey], bankKey });
          kept++;
        }
        bankStats[bankKey] = { total: jobs.length, kept, error: null };
      } else {
        bankStats[bankKey] = { total: 0, kept: 0, error: result.reason.message };
      }
    }

    // 2. Find new jobs by checking Postgres — any link not in the jobs table is new
    const newJobs = [];
    if (allJobs.length > 0) {
      const currentLinks = allJobs.map((j) => j.link);
      const { rows: existingRows } = await sql`
        SELECT link FROM jobs WHERE link = ANY(${currentLinks})
      `;
      const existingLinks = new Set(existingRows.map((r) => r.link));
      for (const job of allJobs) {
        if (!existingLinks.has(job.link)) newJobs.push(job);
      }
    }

    // 2b. Verify new job links — skip any that return 404 (broken/taken down on bank site)
    // Runs in parallel with an 8-second timeout per link.
    // Only drops jobs with a definitive 404/410 — everything else gets benefit of the doubt.
    const verifiedNewJobs = [];
    let skippedBrokenLinks = 0;
    if (newJobs.length > 0) {
      await Promise.all(
        newJobs.map(async (job) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(job.link, {
              method: "GET",
              signal: controller.signal,
              headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
              redirect: "follow",
            });
            clearTimeout(timeoutId);
            if (res.status === 404 || res.status === 410) {
              skippedBrokenLinks++;
            } else {
              verifiedNewJobs.push(job);
            }
          } catch {
            // Timeout or network error — include the job (benefit of the doubt)
            verifiedNewJobs.push(job);
          }
        })
      );
    }

    // 3. Insert verified new jobs into Postgres with detected_at = now
    const detectedAt = new Date();
    for (const job of verifiedNewJobs) {
      await sql`
        INSERT INTO jobs (link, title, bank, bank_key, location, category, posted_date, detected_at, is_live)
        VALUES (
          ${job.link},
          ${job.title},
          ${job.bank},
          ${job.bankKey || ""},
          ${job.location || ""},
          ${job.category || ""},
          ${job.postedDate ? new Date(job.postedDate) : null},
          ${detectedAt},
          true
        )
        ON CONFLICT (link) DO NOTHING
      `;
    }

    // Update is_live for all tracked jobs — marks expired/removed jobs as not live
    // so they disappear from the Recent tab automatically.
    const allCurrentLinks = allJobs.map((j) => j.link);
    await sql`UPDATE jobs SET is_live = false WHERE is_live = true`;
    if (allCurrentLinks.length > 0) {
      await sql`UPDATE jobs SET is_live = true WHERE link = ANY(${allCurrentLinks})`;
    }

    // 4. Queue notifications for subscribed users (only when new jobs exist)
    let queued = 0;
    let notifiedUsers = 0;

    if (verifiedNewJobs.length > 0) {
      const client = await clerkClient();
      let allUsers = [];
      let offset = 0;
      while (true) {
        const userList = await client.users.getUserList({ limit: 100, offset });
        allUsers.push(...userList.data);
        if (userList.data.length < 100) break;
        offset += 100;
      }

      const notifyUsers = allUsers.filter(
        (u) =>
          u.publicMetadata?.subscribed === true &&
          u.unsafeMetadata?.notifications?.enabled === true
      );

      for (const user of notifyUsers) {
        const prefs = user.unsafeMetadata.notifications;
        const prefBanks = prefs.banks || [];
        const prefCategories = prefs.categories || [];
        const prefJobType = prefs.jobType || "all";
        const prefLocation = (prefs.location || "").trim().toLowerCase();

        const matchingJobs = verifiedNewJobs.filter((job) => {
          if (prefBanks.length > 0 && !prefBanks.includes(job.bankKey)) return false;
          if (prefCategories.length > 0 && !prefCategories.includes(job.category)) return false;
          if (prefJobType === "internship" && !isInternship(job.title)) return false;
          if (prefJobType === "fulltime" && isInternship(job.title)) return false;
          if (prefLocation && !(job.location || "").toLowerCase().includes(prefLocation)) return false;
          return true;
        });

        if (matchingJobs.length === 0) continue;

        for (const job of matchingJobs) {
          await sql`
            INSERT INTO notification_queue (user_id, job_link, job_title, job_bank, job_location, job_category)
            VALUES (${user.id}, ${job.link}, ${job.title}, ${job.bank}, ${job.location || ""}, ${job.category || ""})
          `;
          queued++;
        }
        notifiedUsers++;
      }
    }

    // 5. Send owner summary email (always — so you can verify the cron is running)
    try {
      await resend.emails.send({
        from: "Pete's Postings <notifications@petespostings.com>",
        to: OWNER_EMAIL,
        subject:
          newJobs.length > 0
            ? `[Cron] ${newJobs.length} new ${newJobs.length === 1 ? "job" : "jobs"} — ${formatTimestamp(runAt)}`
            : `[Cron] No new jobs — ${formatTimestamp(runAt)}`,
        html: buildOwnerSummaryHtml({ runAt, allJobs, newJobs: verifiedNewJobs, skippedBrokenLinks, bankStats, queued, notifiedUsers }),
      });
    } catch (emailErr) {
      // Non-fatal — log but don't fail the cron
      console.error("Owner summary email failed:", emailErr.message);
    }

    return Response.json({
      message: "Done",
      totalJobs: allJobs.length,
      newJobs: verifiedNewJobs.length,
      skippedBrokenLinks,
      queued,
    });
  } catch (err) {
    console.error("Cron notify error:", err);
    // Try to notify Pete of the failure
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Pete's Postings <notifications@petespostings.com>",
        to: OWNER_EMAIL,
        subject: `[Cron ERROR] ${formatTimestamp(runAt)}`,
        html: `<div style="font-family:sans-serif;padding:32px;max-width:600px;">
          <h2 style="color:#ef4444;margin:0 0 16px;">Cron Job Failed</h2>
          <p style="color:#334155;"><strong>Run time:</strong> ${formatTimestamp(runAt)}</p>
          <p style="color:#334155;"><strong>Error:</strong> ${err.message}</p>
          <pre style="background:#f1f5f9;padding:16px;border-radius:8px;font-size:12px;color:#475569;overflow:auto;">${err.stack || ""}</pre>
        </div>`,
      });
    } catch {}
    return Response.json({ error: "Cron failed", details: err.message }, { status: 500 });
  }
}
