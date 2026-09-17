// Shared sender for job notifications. Used by the detection cron (immediate send)
// and by the retry sweep (queued rows). One email and at most one SMS per call.
import { buildEmailHtml } from "@/lib/notif-helpers";

export function telnyxConfig() {
  const apiKey = process.env.TELNYX_API_KEY;
  const from = process.env.TELNYX_PHONE_NUMBER;
  return apiKey && from ? { apiKey, from } : null;
}

export function buildSmsText(jobs) {
  const jobLines = jobs.slice(0, 3).map((j) => `• ${j.title} @ ${j.bank}`).join("\n");
  const more = jobs.length > 3 ? `\n+ ${jobs.length - 3} more` : "";
  return `Pete's Postings: ${jobs.length} new ${jobs.length === 1 ? "job" : "jobs"} posted:\n${jobLines}${more}\n\npetespostings.com\nReply STOP to unsubscribe`;
}

/**
 * Send one email and (if enabled) one SMS to a user for a batch of jobs.
 * Returns { emailSent, smsSent, failed } — failed is true when a channel the user
 * has enabled could not be delivered, so the caller can queue the jobs for retry.
 */
export async function sendUserNotification({ resend, telnyx, email, firstName, prefs, jobs }) {
  const result = { emailSent: false, smsSent: false, failed: false };
  if (!jobs || jobs.length === 0) return result;

  if (email) {
    try {
      await resend.emails.send({
        from: "Pete's Postings <notifications@petespostings.com>",
        to: email,
        subject: `${jobs.length} new ${jobs.length === 1 ? "job" : "jobs"} on Pete's Postings`,
        html: buildEmailHtml(jobs, firstName || ""),
      });
      result.emailSent = true;
    } catch (err) {
      console.error(`Failed to email ${email}:`, err?.message || err);
      result.failed = true;
    }
  }

  if (telnyx && prefs?.smsEnabled && prefs?.phoneNumber) {
    try {
      const resp = await fetch("https://api.telnyx.com/v2/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${telnyx.apiKey}` },
        body: JSON.stringify({ from: telnyx.from, to: prefs.phoneNumber, text: buildSmsText(jobs) }),
      });
      if (resp.ok) result.smsSent = true;
      else {
        console.error(`SMS failed for ${prefs.phoneNumber}:`, await resp.text());
        result.failed = true;
      }
    } catch (err) {
      console.error(`Failed to SMS ${prefs.phoneNumber}:`, err?.message || err);
      result.failed = true;
    }
  }

  return result;
}
