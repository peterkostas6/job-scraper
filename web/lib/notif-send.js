// Shared sender for job notifications. Used by the detection cron (immediate send)
// and by the retry sweep (queued rows). One email and at most one SMS per call.
import crypto from "crypto";
import { sql } from "@vercel/postgres";
import { alertEmail } from "@/lib/email-templates";
import { sendEmail, unsubscribeUrl, BRAND } from "@/lib/email";

export function telnyxConfig() {
  const apiKey = process.env.TELNYX_API_KEY;
  const from = process.env.TELNYX_PHONE_NUMBER;
  return apiKey && from ? { apiKey, from } : null;
}

// Plain ASCII only: a single non-GSM character (like a bullet) switches the whole
// message to UCS-2 and halves the characters per billable segment.
export function buildSmsText(jobs) {
  const clean = (s) => String(s).replace(/[\u2013\u2014]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x20-\x7E\n]/g, "");
  const jobLines = jobs.slice(0, 3).map((j) => `- ${clean(j.title).slice(0, 48)} @ ${clean(j.bank)}`).join("\n");
  const more = jobs.length > 3 ? `\n+ ${jobs.length - 3} more` : "";
  return `Pete's Postings: ${jobs.length} new ${jobs.length === 1 ? "job" : "jobs"} posted:\n${jobLines}${more}\n\npetespostings.com/recent\nReply STOP to unsubscribe`;
}

// Returns the Telnyx message id so delivery callbacks can be matched to the send.
export async function sendSms(telnyx, to, text) {
  const resp = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${telnyx.apiKey}` },
    body: JSON.stringify({ from: telnyx.from, to, text }),
  });
  if (!resp.ok) throw new Error(`Telnyx ${resp.status}: ${await resp.text()}`);
  const body = await resp.json().catch(() => null);
  return body?.data?.id || null;
}

// Records a send attempt or a delivery event. Never throws: a logging failure must not
// stop a notification from going out.
export async function logNotification({ userId = null, channel, status, recipient = null, jobLinks = null, error = null, providerId = null }) {
  try {
    await sql`
      INSERT INTO notification_log (user_id, channel, status, recipient, job_links, error, provider_id)
      VALUES (${userId}, ${channel}, ${status}, ${recipient}, ${jobLinks}, ${error}, ${providerId})
    `;
  } catch (err) {
    console.error("notification_log insert failed:", err?.message || err);
  }
}

/**
 * Send one email and (if enabled) one SMS to a user for a batch of jobs.
 * Returns { emailSent, smsSent, failed } — failed is true only when the email could not
 * be delivered, so the caller queues the jobs for the retry sweep.
 */
export async function sendUserNotification({ resend, telnyx, userId, email, firstName, prefs, jobs }) {
  const result = { emailSent: false, smsSent: false, failed: false };
  if (!jobs || jobs.length === 0) return result;
  const uid = userId || email || "anon";
  const jobLinks = jobs.map((j) => j.link);

  if (email) {
    try {
      const { subject, html, text } = alertEmail({ jobs, firstName, userId: uid });
      // Same user + same set of links = same key, so a retry never double-sends.
      const linkHash = crypto.createHash("sha256").update(jobs.map((j) => j.link).sort().join("|")).digest("hex").slice(0, 16);
      const sent = await sendEmail(resend, {
        from: BRAND.fromAlerts,
        to: email,
        subject,
        html,
        text,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl(uid)}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        idempotencyKey: `alert-${uid}-${linkHash}`,
        tags: [{ name: "type", value: "job-alert" }],
      });
      result.emailSent = true;
      await logNotification({ userId, channel: "email", status: "sent", recipient: email, jobLinks, providerId: sent?.id || null });
    } catch (err) {
      console.error(`Failed to email ${email}:`, err?.message || err);
      result.failed = true;
      result.emailError = err?.message || String(err);
      await logNotification({ userId, channel: "email", status: "failed", recipient: email, jobLinks, error: result.emailError });
    }
  }

  if (telnyx && prefs?.smsEnabled && prefs?.phoneNumber) {
    try {
      const messageId = await sendSms(telnyx, prefs.phoneNumber, buildSmsText(jobs));
      result.smsSent = true;
      await logNotification({ userId, channel: "sms", status: "sent", recipient: prefs.phoneNumber, jobLinks, providerId: messageId });
    } catch (err) {
      // SMS failures are logged but never queued: a retry would hit the same carrier or
      // account limit, and re-queuing would resend the email that already went out.
      console.error(`Failed to SMS ${prefs.phoneNumber}:`, err?.message || err);
      result.smsError = err?.message || String(err);
      await logNotification({ userId, channel: "sms", status: "failed", recipient: prefs.phoneNumber, jobLinks, error: result.smsError });
    }
  }

  return result;
}
