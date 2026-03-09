// POST /api/cron/send-notifications — reads notification_queue, sends batched email + SMS, clears rows
// Only sends if there are new jobs queued. No "nothing found" emails.
// Secured with CRON_SECRET header. Triggered at 14 UTC and 21 UTC daily.
import { Resend } from "resend";
import { clerkClient } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { buildEmailHtml } from "@/lib/notif-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const telnyxApiKey = process.env.TELNYX_API_KEY;
    const telnyxFrom = process.env.TELNYX_PHONE_NUMBER;
    const telnyxEnabled = telnyxApiKey && telnyxFrom;

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
          AND is_live = true
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

        // Send email
        if (email) {
          try {
            await resend.emails.send({
              from: "Pete's Postings <notifications@petespostings.com>",
              to: email,
              subject: `${jobs.length} new ${jobs.length === 1 ? "job" : "jobs"} on Pete's Postings`,
              html: buildEmailHtml(jobs, firstName),
            });
            emailsSent++;
          } catch (emailErr) {
            console.error(`Failed to email ${email}:`, emailErr);
          }
        }

        // Send SMS if enabled
        if (telnyxEnabled && prefs.smsEnabled && prefs.phoneNumber) {
          try {
            const jobLines = jobs.slice(0, 3).map((j) => `• ${j.title} @ ${j.bank}`).join("\n");
            const more = jobs.length > 3 ? `\n+ ${jobs.length - 3} more` : "";
            const text = `Pete's Postings: ${jobs.length} new ${jobs.length === 1 ? "job" : "jobs"} posted:\n${jobLines}${more}\n\npetespostings.com\nReply STOP to unsubscribe`;

            const resp = await fetch("https://api.telnyx.com/v2/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${telnyxApiKey}`,
              },
              body: JSON.stringify({ from: telnyxFrom, to: prefs.phoneNumber, text }),
            });
            if (resp.ok) smsSent++;
            else console.error(`SMS failed for ${prefs.phoneNumber}:`, await resp.text());
          } catch (smsErr) {
            console.error(`Failed to SMS ${prefs.phoneNumber}:`, smsErr);
          }
        }

      }

      // 4. Delete processed rows
      await sql`DELETE FROM notification_queue WHERE id = ANY(${sentIds})`;
    }

    return Response.json({
      message: "Done",
      emailsSent,
      smsSent,
      totalJobsSent: rows.length,
    });
  } catch (err) {
    console.error("send-notifications error:", err);
    return Response.json({ error: "Send failed", details: err.message }, { status: 500 });
  }
}
