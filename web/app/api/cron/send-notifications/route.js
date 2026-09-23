// GET /api/cron/send-notifications — retry sweep. The detection cron sends immediately;
// anything that failed to deliver lands in notification_queue and is retried here every 15 minutes.
// Secured with CRON_SECRET header.
import { Resend } from "resend";
import { clerkClient } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { sendUserNotification, smsConfig } from "@/lib/notif-send";

export const dynamic = "force-dynamic";
// The Postgres driver talks to Neon over HTTP. In production Next.js can serve a repeated,
// identical query from its data cache, which made the dedupe SELECT return a stale link set
// and every run re-detect the same jobs. Opt every fetch in these routes out of the cache.
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 300;

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const sms = smsConfig();

    // 1. Fetch all queued rows
    const { rows } = await sql`
      SELECT * FROM notification_queue ORDER BY queued_at ASC
    `;

    const client = await clerkClient();
    let emailsSent = 0;
    let smsSent = 0;
    const sentIds = [];

    if (rows.length > 0) {
      // 1b. Cross-check queued jobs against the jobs table.
      // Only send jobs that are still live AND still within the 48h Recent tab window.
      // This ensures users only get notified about jobs they can actually find on the site.
      const queuedLinks = [...new Set(rows.map((r) => r.job_link))];
      const { rows: liveRows } = await sql`
        SELECT link FROM jobs
        WHERE link = ANY(${queuedLinks})
          AND is_live = true AND NOT link_dead
          AND detected_at > NOW() - INTERVAL '48 hours'
      `;
      const liveLinks = new Set(liveRows.map((r) => r.link));

      // 2. Group rows by user_id
      const byUser = {};
      for (const row of rows) {
        if (!byUser[row.user_id]) byUser[row.user_id] = [];
        byUser[row.user_id].push(row);
      }

      // 3. For each user: fetch from Clerk, send email + SMS, collect row IDs
      for (const [userId, userRows] of Object.entries(byUser)) {
        // Always mark rows as processed (delete them) even if filtered — prevents queue buildup
        sentIds.push(...userRows.map((r) => r.id));

        let clerkUser;
        try {
          clerkUser = await client.users.getUser(userId);
        } catch (err) {
          console.error(`Could not fetch Clerk user ${userId}:`, err.message);
          continue;
        }

        const email = clerkUser.emailAddresses[0]?.emailAddress;
        const firstName = clerkUser.firstName || "";
        const prefs = clerkUser.unsafeMetadata?.notifications || {};

        // Only include jobs that are still live and in the Recent tab
        const jobs = userRows
          .filter((r) => liveLinks.has(r.job_link))
          .map((r) => ({
            title: r.job_title,
            link: r.job_link,
            bank: r.job_bank,
            location: r.job_location,
            category: r.job_category,
          }));

        // Nothing to send for this user after filtering
        if (jobs.length === 0) continue;

        if (dryRun) { emailsSent += email ? 1 : 0; continue; }
        const sent = await sendUserNotification({ resend, sms, userId, email, firstName, prefs, jobs });
        if (sent.emailSent) emailsSent++;
        if (sent.smsSent) smsSent++;
      }

      // 4. Delete processed rows
      if (!dryRun) await sql`DELETE FROM notification_queue WHERE id = ANY(${sentIds})`;
    }

    return Response.json({
      message: dryRun ? "Dry run — nothing deleted or sent" : "Done",
      dryRun,
      queuedRows: rows.length,
      emailsSent,
      smsSent,
      totalJobsSent: rows.length,
    });
  } catch (err) {
    console.error("send-notifications error:", err);
    return Response.json({ error: "Send failed", details: err.message }, { status: 500 });
  }
}
