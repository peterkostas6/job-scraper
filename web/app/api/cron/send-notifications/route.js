// POST /api/cron/send-notifications — reads notification_queue, sends batched email + SMS, clears rows
// At the 4pm ET (21 UTC) run, also sends "nothing found today" email to users with no new jobs.
// Secured with CRON_SECRET header. Triggered at 14 UTC and 21 UTC daily.
import { Resend } from "resend";
import { clerkClient } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { buildEmailHtml } from "@/lib/notif-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function buildNothingFoundEmail(firstName) {
  const name = firstName || "there";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <p style="font-size:20px;font-weight:800;color:#1e293b;margin:0 0 32px;">Pete's Postings</p>
    <p style="font-size:15px;color:#334155;margin:0 0 12px;">Hey ${name},</p>
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 20px;">
      No new postings matching your preferences today — I checked all morning and afternoon.
    </p>
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 28px;">
      I'll keep searching on your behalf and will let you know the moment something goes live.
    </p>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="https://petespostings.com" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Browse All Active Postings</a>
    </div>
    <p style="font-size:15px;color:#334155;">— Pete</p>
    <p style="font-size:11px;color:#94a3b8;margin-top:32px;">Pete's Postings · Not affiliated with any listed bank</p>
  </div>
</body>
</html>`;
}

export async function POST(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 4pm ET = 21 UTC (EST) — end-of-day run, weekdays only
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const isWeekday = utcDay >= 1 && utcDay <= 5;
  const isEndOfDay = now.getUTCHours() === 21 && isWeekday;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
    const twilioEnabled = twilioSid && twilioToken && twilioFrom;

    // 1. Fetch all queued rows
    const { rows } = await sql`
      SELECT * FROM notification_queue ORDER BY queued_at ASC
    `;

    const client = await clerkClient();
    let emailsSent = 0;
    let smsSent = 0;
    let nothingFoundSent = 0;
    const sentIds = [];
    const notifiedUserIds = new Set();

    if (rows.length > 0) {
      // 2. Group rows by user_id
      const byUser = {};
      for (const row of rows) {
        if (!byUser[row.user_id]) byUser[row.user_id] = [];
        byUser[row.user_id].push(row);
      }

      // 3. For each user: fetch from Clerk, send email + SMS, collect row IDs
      for (const [userId, userRows] of Object.entries(byUser)) {
        let clerkUser;
        try {
          clerkUser = await client.users.getUser(userId);
        } catch (err) {
          console.error(`Could not fetch Clerk user ${userId}:`, err.message);
          sentIds.push(...userRows.map((r) => r.id));
          continue;
        }

        const email = clerkUser.emailAddresses[0]?.emailAddress;
        const firstName = clerkUser.firstName || "";
        const prefs = clerkUser.unsafeMetadata?.notifications || {};

        const jobs = userRows.map((r) => ({
          title: r.job_title,
          link: r.job_link,
          bank: r.job_bank,
          location: r.job_location,
          category: r.job_category,
        }));

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
        if (twilioEnabled && prefs.smsEnabled && prefs.phoneNumber) {
          try {
            const jobLines = jobs.slice(0, 3).map((j) => `• ${j.title} @ ${j.bank}`).join("\n");
            const more = jobs.length > 3 ? `\n+ ${jobs.length - 3} more` : "";
            const body = `Pete's Postings: ${jobs.length} new ${jobs.length === 1 ? "job" : "jobs"} posted:\n${jobLines}${more}\n\npetespostings.com`;

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

        notifiedUserIds.add(userId);
        sentIds.push(...userRows.map((r) => r.id));
      }

      // 4. Delete processed rows
      await sql`DELETE FROM notification_queue WHERE id = ANY(${sentIds})`;
    }

    // 5. End-of-day: send "nothing found today" to subscribed users who got no new jobs
    if (isEndOfDay) {
      let offset = 0;
      const limit = 100;

      while (true) {
        const { data: users } = await client.users.getUserList({ limit, offset });
        if (!users || users.length === 0) break;

        for (const u of users) {
          if (notifiedUserIds.has(u.id)) continue;
          if (u.publicMetadata?.subscribed !== true) continue;

          const prefs = u.unsafeMetadata?.notifications || {};
          if (!prefs.enabled && !prefs.smsEnabled) continue;

          const email = u.emailAddresses?.[0]?.emailAddress;
          if (!email) continue;

          try {
            await resend.emails.send({
              from: "Pete's Postings <notifications@petespostings.com>",
              to: email,
              subject: "No new postings today — still searching for you",
              html: buildNothingFoundEmail(u.firstName || ""),
            });
            nothingFoundSent++;
          } catch (err) {
            console.error(`Nothing-found email failed for ${email}:`, err);
          }
        }

        if (users.length < limit) break;
        offset += limit;
      }
    }

    return Response.json({
      message: "Done",
      emailsSent,
      smsSent,
      nothingFoundSent,
      totalJobsSent: rows.length,
    });
  } catch (err) {
    console.error("send-notifications error:", err);
    return Response.json({ error: "Send failed", details: err.message }, { status: 500 });
  }
}
