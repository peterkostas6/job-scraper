// Shared sender for job notifications. Used by the detection cron (immediate send)
// and by the retry sweep (queued rows). One email and at most one SMS per call.
import crypto from "crypto";
import { sql } from "@vercel/postgres";
import { alertEmail } from "@/lib/email-templates";
import { sendEmail, unsubscribeUrl, BRAND } from "@/lib/email";
import { captureServer } from "@/lib/posthog-server";
import { alertTrial } from "@/lib/alert-trial";
import { markAlerted } from "@/lib/job-status";
import { smsSlot, holdJobs, heldJobs, clearHeld } from "@/lib/sms-pacing";
import { sendPush, apnsConfigured } from "@/lib/apns";
import { clerkClient } from "@clerk/nextjs/server";

// One push for a batch: the single role's title, or a count with the firms.
function pushMessage(jobs) {
  if (jobs.length === 1) return { title: `${jobs[0].bank} just posted`, body: jobs[0].title };
  const banks = [...new Set(jobs.map((j) => j.bank).filter(Boolean))];
  return { title: `${jobs.length} new roles`, body: `${banks.slice(0, 3).join(", ")}${banks.length > 3 ? ` and ${banks.length - 3} more` : ""}` };
}

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
// Alerts are free for every account (see lib/alert-trial.js for when their links lock).
// Kept for the free-alert log count below.
export const FREE_ALERT_LIMIT = Infinity;

// Free alerts already sent to this account, or to this phone number from any account, so a
// second sign-up with the same number doesn't reset the allowance. Counted from the log, not
// from user metadata, because users can edit their own metadata.
export async function freeAlertsUsed(userId, phone) {
  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS n FROM notification_log
      WHERE channel = 'free-alert' AND status = 'sent'
        AND (user_id = ${userId} OR (${phone || ""}::text <> '' AND recipient = ${phone || ""}::text))
    `;
    return rows[0]?.n || 0;
  } catch (err) {
    console.error("free alert count failed:", err?.message || err);
    return FREE_ALERT_LIMIT; // fail closed: an unknown count never sends a paid-tier alert
  }
}

export function buildSmsText(jobs, withOptOut, shortUrls) {
  const clean = (s) => String(s).replace(/[\u2013\u2014]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x20-\x7E\n]/g, "");
  const perJob = jobs.length <= 3 && shortUrls?.length === jobs.length && shortUrls.every(Boolean);
  const jobLines = jobs.slice(0, 3).map((j, i) => `- ${clean(j.title).slice(0, 48)} @ ${clean(j.bank)}${perJob ? `\n${shortUrls[i]}` : ""}`).join("\n");
  const more = jobs.length > 3 ? `\n+ ${jobs.length - 3} more` : "";
  const footer = perJob ? "" : "\n\npetespostings.com/recent";
  return `Pete's Postings: ${jobs.length} new ${jobs.length === 1 ? "job" : "jobs"} posted:\n${jobLines}${more}${footer}${withOptOut ? "\n\nReply STOP to unsubscribe" : ""}`;
}

// Text for accounts past their free days: no titles, just enough to want to open it.
// The link is a /j/ link, which sends them to /pricing until they have Premium.
export function buildLockedSmsText(jobs, withOptOut, url) {
  const clean = (s) => String(s).replace(/[^\x20-\x7E]/g, "");
  const banks = [...new Set(jobs.map((j) => clean(j.bank)))];
  const at = banks.length === 1 ? banks[0]
    : banks.length === 2 ? `${banks[0]} and ${banks[1]}`
    : `${banks[0]}, ${banks[1]} and ${banks.length - 2} more ${banks.length === 3 ? "bank" : "banks"}`;
  const found = jobs.length === 1 ? `We found 1 new role at ${at} that matches your preferences` : `We found ${jobs.length} new roles at ${at} that match your preferences`;
  return `Pete's Postings: ${found}. Posted just now.\n\nGet Premium to see ${jobs.length === 1 ? "it" : "them"}: ${url || "petespostings.com/pricing"}${withOptOut ? "\n\nReply STOP to unsubscribe" : ""}`;
}

// Returns petespostings.com/j/<code> for this user + job, or null if it can't be saved.
// The code comes from a hash, so a resend of the same job reuses the same link. Email links
// get their own code (source 'email') so clicks show which channel they came from.
async function shortLink(userId, link, source = "sms") {
  const key = source === "sms" ? `${userId}|${link}` : `${source}|${userId}|${link}`;
  const code = crypto.createHash("sha256").update(key).digest("base64url").slice(0, 8);
  try {
    await sql`INSERT INTO short_links (code, link, user_id, source) VALUES (${code}, ${link}, ${userId}, ${source}) ON CONFLICT (code) DO NOTHING`;
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
 * isFree: the account isn't Premium; the alert still goes out and is logged as a free alert.
 * Returns { emailSent, smsSent, failed } — failed is true only when the email could not
 * be delivered, so the caller queues the jobs for the retry sweep.
 */
export async function sendUserNotification({ resend, sms, userId, email, firstName, prefs, jobs, isFree = false, createdAt = null, forceLocked = false, smsOnly = false, paced = true, push = true }) {
  const result = { emailSent: false, smsSent: false, failed: false };
  if (!jobs || jobs.length === 0) return result;
  const smsTo = sms && prefs?.smsEnabled && prefs?.phoneNumber ? prefs.phoneNumber : "";
  // Free accounts always get the alert; once their 3 free days are up the /j/ links
  // send them to /pricing instead of the job.
  const trial = isFree && createdAt ? alertTrial(createdAt) : null;
  const trialOver = forceLocked || Boolean(trial?.over);
  const uid = userId || email || "anon";
  const jobLinks = jobs.map((j) => j.link);

  // prefs.enabled is the email switch; undefined (the admin test) still emails.
  // smsOnly: the held-text sweep, whose jobs were already emailed when they were found.
  if (email && prefs?.enabled !== false && !smsOnly) {
    try {
      // Job links go through /j/<code> so email clicks are counted like text clicks.
      const emailJobs = await Promise.all(jobs.map(async (j) => {
        const short = await shortLink(uid, j.link, "email");
        return short ? { ...j, link: `https://${short}` } : j;
      }));
      const { subject, html, text } = alertEmail({ jobs: emailJobs, firstName, userId: uid });
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
      await markAlerted(userId, jobLinks, "email");
    } catch (err) {
      console.error(`Failed to email ${email}:`, err?.message || err);
      result.failed = true;
      result.emailError = err?.message || String(err);
      await logNotification({ userId, channel: "email", status: "failed", recipient: email, jobLinks, error: result.emailError });
    }
  }

  if (paced && sms && prefs?.smsEnabled && prefs?.phoneNumber) {
    // Pacing (lib/sms-pacing.js): if this number had a text too recently or hit today's
    // limit, hold these jobs for the next text instead of sending one now.
    const slot = await smsSlot(prefs.phoneNumber);
    if (!slot.allowed) {
      try {
        await holdJobs(uid, jobs);
        result.smsHeld = true;
      } catch (err) {
        console.error(`Failed to hold SMS jobs for ${uid}:`, err?.message || err);
      }
    }
  }

  if (sms && prefs?.smsEnabled && prefs?.phoneNumber && !result.smsHeld) {
    // Jobs held from earlier runs go out in this same text, oldest first.
    const held = paced ? await heldJobs(uid) : [];
    const seen = new Set();
    const smsJobs = [...held, ...jobs].filter((j) => !seen.has(j.link) && seen.add(j.link));
    const smsLinks = smsJobs.map((j) => j.link);
    try {
      const withOptOut = await needsOptOutReminder(prefs.phoneNumber);
      let text;
      if (trialOver) {
        text = buildLockedSmsText(smsJobs, withOptOut, await shortLink(uid, smsJobs[0].link));
      } else {
        const shortUrls = smsJobs.length <= 3 ? await Promise.all(smsJobs.map((j) => shortLink(uid, j.link))) : null;
        text = buildSmsText(smsJobs, withOptOut, shortUrls);
      }
      const messageId = await sendSms(sms, prefs.phoneNumber, text);
      result.smsSent = true;
      if (held.length) await clearHeld(uid);
      await logNotification({ userId, channel: "sms", status: "sent", recipient: prefs.phoneNumber, jobLinks: smsLinks, providerId: messageId });
      await markAlerted(userId, smsLinks, "sms");
      if (withOptOut) await logNotification({ userId, channel: "sms-optout-notice", status: "sent", recipient: prefs.phoneNumber, providerId: messageId });
    } catch (err) {
      // SMS failures are logged but never queued: a retry would hit the same carrier or
      // account limit, and re-queuing would resend the email that already went out.
      console.error(`Failed to SMS ${prefs.phoneNumber}:`, err?.message || err);
      result.smsError = err?.message || String(err);
      await logNotification({ userId, channel: "sms", status: "failed", recipient: prefs.phoneNumber, jobLinks: smsLinks, error: result.smsError });
    }
  }

  // iPhone app: one push to each of the person's phones. Not from the held-text sweep or the
  // email retry sweep (push: false), whose jobs were already pushed when they were found.
  if (push && !smsOnly && prefs?.pushEnabled && prefs?.pushTokens?.length && apnsConfigured()) {
    try {
      const short = jobs.length === 1 ? await shortLink(uid, jobs[0].link, "push") : null;
      const out = await sendPush(prefs.pushTokens, { ...pushMessage(jobs), url: short ? `https://${short}` : "/recent" });
      result.pushSent = out.sent > 0;
      if (out.dead.length && userId) {
        // Phones that deleted the app or turned notifications off.
        const clerk = await clerkClient();
        const u = await clerk.users.getUser(userId);
        const n = u.unsafeMetadata?.notifications || {};
        const pushTokens = (n.pushTokens || []).filter((t) => !out.dead.includes(t));
        await clerk.users.updateUser(userId, { unsafeMetadata: { ...u.unsafeMetadata, notifications: { ...n, pushTokens, pushEnabled: pushTokens.length > 0 && n.pushEnabled } } });
      }
      if (out.errors.length) result.pushError = out.errors.join("; ");
      await logNotification({ userId, channel: "push", status: result.pushSent ? "sent" : "failed", recipient: `${prefs.pushTokens.length} device(s)`, jobLinks, error: result.pushError || null });
      if (result.pushSent) await markAlerted(userId, jobLinks, "push");
    } catch (err) {
      console.error(`Failed to push ${uid}:`, err?.message || err);
      result.pushError = err?.message || String(err);
    }
  }

  if (isFree && (result.emailSent || result.smsSent)) {
    await logNotification({ userId, channel: "free-alert", status: "sent", recipient: smsTo || email || null, jobLinks });
  }

  // One event per person per alert, with what went out and what failed.
  if (userId && (result.emailSent || result.smsSent || result.pushSent || result.emailError || result.smsError || result.pushError)) {
    await captureServer(userId, "alert_sent", {
      email_sent: result.emailSent,
      sms_sent: result.smsSent,
      push_sent: Boolean(result.pushSent),
      push_failed: Boolean(result.pushError),
      email_failed: Boolean(result.emailError),
      sms_failed: Boolean(result.smsError),
      jobs: jobs.length,
      banks: [...new Set(jobs.map((j) => j.bank).filter(Boolean))],
      free_alert: isFree,
      trial_over: trialOver,
    });
  }

  return result;
}
