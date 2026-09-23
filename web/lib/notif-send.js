// Shared sender for job notifications. Used by the detection cron (immediate send)
// and by the retry sweep (queued rows). One email and at most one SMS per call.
import crypto from "crypto";
import { sql } from "@vercel/postgres";
import { alertEmail } from "@/lib/email-templates";
import { sendEmail, unsubscribeUrl, BRAND } from "@/lib/email";

// Sends go through the Twilio Messaging Service that the approved A2P campaign is attached to.
export function smsConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  return accountSid && authToken && messagingServiceSid ? { accountSid, authToken, messagingServiceSid } : null;
}

// Plain ASCII only: a single non-GSM character (like a bullet) switches the whole
// message to UCS-2 and halves the characters per billable segment.
// shortUrls (optional) holds one short link per job; when every job has one, each job
// gets its own link instead of the Recent page link.
export function buildSmsText(jobs, withOptOut, shortUrls) {
  const clean = (s) => String(s).replace(/[\u2013\u2014]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x20-\x7E\n]/g, "");
  const perJob = jobs.length <= 3 && shortUrls?.length === jobs.length && shortUrls.every(Boolean);
  const jobLines = jobs.slice(0, 3).map((j, i) => `- ${clean(j.title).slice(0, 48)} @ ${clean(j.bank)}${perJob ? `\n${shortUrls[i]}` : ""}`).join("\n");
  const more = jobs.length > 3 ? `\n+ ${jobs.length - 3} more` : "";
  const footer = perJob ? "" : "\n\npetespostings.com/recent";
  return `Pete's Postings: ${jobs.length} new ${jobs.length === 1 ? "job" : "jobs"} posted:\n${jobLines}${more}${footer}${withOptOut ? "\n\nReply STOP to unsubscribe" : ""}`;
}

// Returns petespostings.com/j/<code> for this user + job, or null if it can't be saved.
// The code comes from a hash, so a resend of the same job reuses the same link.
async function shortLink(userId, link) {
  const code = crypto.createHash("sha256").update(`${userId}|${link}`).digest("base64url").slice(0, 8);
  try {
    await sql`INSERT INTO short_links (code, link, user_id) VALUES (${code}, ${link}, ${userId}) ON CONFLICT (code) DO NOTHING`;
    return `petespostings.com/j/${code}`;
  } catch (err) {
    console.error("short link insert failed:", err?.message || err);
    return null;
  }
}

// Carrier guidelines ask for opt-out wording in the first text and then periodically,
// not in every text. Alerts carry it when this number hasn't had it in 30 days.
async function needsOptOutReminder(phone) {
  try {
    const { rows } = await sql`
      SELECT 1 FROM notification_log
      WHERE channel = 'sms-optout-notice' AND recipient = ${phone} AND created_at > NOW() - INTERVAL '30 days'
      LIMIT 1
    `;
    return rows.length === 0;
  } catch {
    return true;
  }
}

// Returns the Twilio message SID so delivery callbacks can be matched to the send.
export async function sendSms(sms, to, text, mediaUrl) {
  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sms.accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${sms.accountSid}:${sms.authToken}`).toString("base64")}`,
    },
    body: new URLSearchParams({ MessagingServiceSid: sms.messagingServiceSid, To: to, Body: text, ...(mediaUrl && { MediaUrl: mediaUrl }) }),
  });
  if (!resp.ok) throw new Error(`Twilio ${resp.status}: ${await resp.text()}`);
  const body = await resp.json().catch(() => null);
  return body?.sid || null;
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
export async function sendUserNotification({ resend, sms, userId, email, firstName, prefs, jobs }) {
  const result = { emailSent: false, smsSent: false, failed: false };
  if (!jobs || jobs.length === 0) return result;
  const uid = userId || email || "anon";
  const jobLinks = jobs.map((j) => j.link);

  // prefs.enabled is the email switch; undefined (the admin test) still emails.
  if (email && prefs?.enabled !== false) {
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

  if (sms && prefs?.smsEnabled && prefs?.phoneNumber) {
    try {
      const withOptOut = await needsOptOutReminder(prefs.phoneNumber);
      const shortUrls = jobs.length <= 3 ? await Promise.all(jobs.map((j) => shortLink(uid, j.link))) : null;
      const messageId = await sendSms(sms, prefs.phoneNumber, buildSmsText(jobs, withOptOut, shortUrls));
      result.smsSent = true;
      await logNotification({ userId, channel: "sms", status: "sent", recipient: prefs.phoneNumber, jobLinks, providerId: messageId });
      if (withOptOut) await logNotification({ userId, channel: "sms-optout-notice", status: "sent", recipient: prefs.phoneNumber, providerId: messageId });
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
