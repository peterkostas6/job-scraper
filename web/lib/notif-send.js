// Shared sender for job notifications. Used by the detection cron (immediate send)
// and by the retry sweep (queued rows). One email and at most one SMS per call.
import crypto from "crypto";
import { alertEmail } from "@/lib/email-templates";
import { sendEmail, unsubscribeUrl, BRAND } from "@/lib/email";

export function telnyxConfig() {
  const apiKey = process.env.TELNYX_API_KEY;
  const from = process.env.TELNYX_PHONE_NUMBER;
  return apiKey && from ? { apiKey, from } : null;
}

export function buildSmsText(jobs) {
  const jobLines = jobs.slice(0, 3).map((j) => `• ${j.title} @ ${j.bank}`).join("\n");
  const more = jobs.length > 3 ? `\n+ ${jobs.length - 3} more` : "";
  return `Pete's Postings: ${jobs.length} new ${jobs.length === 1 ? "job" : "jobs"} posted:\n${jobLines}${more}\n\npetespostings.com/recent\nReply STOP to unsubscribe`;
}

export async function sendSms(telnyx, to, text) {
  const resp = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${telnyx.apiKey}` },
    body: JSON.stringify({ from: telnyx.from, to, text }),
  });
  if (!resp.ok) throw new Error(`Telnyx ${resp.status}: ${await resp.text()}`);
}

/**
 * Send one email and (if enabled) one SMS to a user for a batch of jobs.
 * Returns { emailSent, smsSent, failed } — failed is true when a channel the user
 * has enabled could not be delivered, so the caller can queue the jobs for retry.
 */
export async function sendUserNotification({ resend, telnyx, userId, email, firstName, prefs, jobs }) {
  const result = { emailSent: false, smsSent: false, failed: false };
  if (!jobs || jobs.length === 0) return result;
  const uid = userId || email || "anon";

  if (email) {
    try {
      const { subject, html, text } = alertEmail({ jobs, firstName, userId: uid });
      // Same user + same set of links = same key, so a retry never double-sends.
      const linkHash = crypto.createHash("sha256").update(jobs.map((j) => j.link).sort().join("|")).digest("hex").slice(0, 16);
      await sendEmail(resend, {
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
    } catch (err) {
      console.error(`Failed to email ${email}:`, err?.message || err);
      result.failed = true;
    }
  }

  if (telnyx && prefs?.smsEnabled && prefs?.phoneNumber) {
    try {
      await sendSms(telnyx, prefs.phoneNumber, buildSmsText(jobs));
      result.smsSent = true;
    } catch (err) {
      console.error(`Failed to SMS ${prefs.phoneNumber}:`, err?.message || err);
      result.failed = true;
    }
  }

  return result;
}
