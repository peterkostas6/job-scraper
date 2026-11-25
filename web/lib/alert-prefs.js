// Saving alert settings for one account: the Alerts page (POST /api/notifications) and the
// after-checkout step for people who paid before having an account both go through here,
// so consent rules, the confirmation email and the welcome text behave the same everywhere.
import { prefsEmail, welcomeAlertsEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { smsConfig, sendSms, logNotification } from "@/lib/notif-send";
import { BANK_NAMES } from "@/lib/banks";
import { clerkClient } from "@clerk/nextjs/server";
import { Resend } from "resend";
import { captureServer } from "@/lib/posthog-server";
import { levelsFromPrefs, LEVEL_LABEL, LEVEL_KEYS } from "@/lib/levels";
import { FIRM_LABEL } from "@/lib/firms";


// The first text someone gets when they turn texts on (sent with the contact card).
export function welcomeText(firstName) {
  return `Hey${firstName ? ` ${firstName}` : ""}! This is Pete from Pete's Postings. You'll get a text within minutes when a role matching your alerts is posted. Reply STOP to opt out. petespostings.com`;
}

// quiet: saved from the iPhone app, where the change is visible right there, so no confirmation email.
export async function saveAlertPrefs({ userId, body, origin, quiet = false }) {
  const { enabled, banks, categories, jobType } = body;
  const levels = levelsFromPrefs(body);

  // Normalize phone number to E.164 format (+1XXXXXXXXXX)
  let phoneNumber = (body.phoneNumber || "").replace(/\D/g, "");
  if (phoneNumber.length === 10) phoneNumber = "1" + phoneNumber;
  if (phoneNumber.length === 11 && phoneNumber.startsWith("1")) phoneNumber = "+" + phoneNumber;
  else if (phoneNumber.length > 0 && !phoneNumber.startsWith("+")) phoneNumber = "+" + phoneNumber;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const oldPrefs = user.unsafeMetadata?.notifications;
  const oldPhone = oldPrefs?.phoneNumber || "";
  const oldSmsEnabled = oldPrefs?.smsEnabled || false;
  const isFirstSetup = !oldPrefs;

  // SMS can only be enabled with explicit, unchecked-by-default opt-in consent and a phone number
  const smsConsent = Boolean(body.smsConsent);
  const smsEnabled = Boolean(body.smsEnabled) && smsConsent && phoneNumber.length > 0;
  const smsConsentAt = smsConsent ? (oldPrefs?.smsConsentAt || new Date().toISOString()) : null;

  await client.users.updateUser(userId, {
    unsafeMetadata: {
      ...user.unsafeMetadata,
      notifications: {
        enabled: Boolean(enabled),
        banks: Array.isArray(banks) ? banks : [],
        categories: Array.isArray(categories) ? categories : [],
        jobType: jobType || "all",
        levels,
        location: typeof body.location === "string" ? body.location.trim().slice(0, 60) : "",
        smsEnabled,
        phoneNumber: phoneNumber || "",
        smsConsent,
        smsConsentAt,
        smsOptOutAt: smsEnabled ? null : oldPrefs?.smsOptOutAt || null,
        // iPhone app push: the phone is registered by /api/app/push-token; the Alerts switch can
        // turn it off or back on (only with a registered phone). Saves without it keep it as is.
        pushEnabled: typeof body.pushEnabled === "boolean" ? body.pushEnabled && (oldPrefs?.pushTokens || []).length > 0 : oldPrefs?.pushEnabled === true,
        pushTokens: oldPrefs?.pushTokens || [],
      },
    },
  });

  const email = user.emailAddresses?.[0]?.emailAddress;
  const firstName = user.firstName || "";

  // Settings as properties on the person too, so you can filter users by what they track.
  // The phone number is never sent.
  const alertProps = {
    email_alerts: Boolean(enabled),
    sms_alerts: smsEnabled,
    job_type: jobType || "all",
    levels,
    banks: Array.isArray(banks) && banks.length ? banks : ["all"],
    categories: Array.isArray(categories) && categories.length ? categories : ["all"],
    city: typeof body.location === "string" && body.location.trim() ? body.location.trim().slice(0, 60) : "anywhere",
  };
  await captureServer(userId, isFirstSetup ? "alerts_set_up" : "alert_settings_changed", {
    ...alertProps,
    sms_turned_on: smsEnabled && !oldSmsEnabled,
    sms_turned_off: !smsEnabled && oldSmsEnabled,
    $set: { alert_email: alertProps.email_alerts, alert_sms: alertProps.sms_alerts, alert_job_type: alertProps.job_type, alert_bank_count: Array.isArray(banks) && banks.length ? banks.length : 20 },
  });

  // Send preferences confirmation email. Preferences saved with every alert off (the setup's
  // "Don't alert me") send nothing the first time; the held welcome email still goes out.
  if (email && !quiet && !(isFirstSetup && !enabled && !smsEnabled)) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const prefs = {
        firstName,
        enabled: Boolean(enabled),
        smsEnabled: Boolean(smsEnabled),
        phoneNumber: phoneNumber || "",
        bankNames: (Array.isArray(banks) ? banks : []).map((k) => BANK_NAMES[k] || k),
        categories: Array.isArray(categories) ? categories : [],
        jobTypeLabel: levels.length === LEVEL_KEYS.length ? "All levels" : levels.map((k) => LEVEL_LABEL[k]).join(", "),
        city: typeof body.location === "string" ? body.location.trim().slice(0, 60) : "",
        userId,
      };
      // First setup while the sign-up welcome is still held: cancel it and send one email that
      // welcomes them and lists their alerts. If it already went out, send the usual confirmation.
      let combined = false;
      const welcomeId = user.privateMetadata?.welcomeEmailId;
      if (isFirstSetup && welcomeId && !user.privateMetadata?.welcomeDone) {
        const { error } = await resend.emails.cancel(welcomeId).catch((e) => ({ error: e }));
        if (!error) {
          const { subject, html, text } = welcomeAlertsEmail({ ...prefs, bankCount: FIRM_LABEL });
          await sendEmail(resend, { to: email, subject, html, text, idempotencyKey: `welcome-alerts-${userId}`, tags: [{ name: "type", value: "welcome" }] });
          combined = true;
        }
        await client.users.updateUserMetadata(userId, { privateMetadata: { welcomeDone: true } }).catch(() => {});
      }
      if (!combined) {
        const { subject, html, text } = prefsEmail({ ...prefs, isFirstSetup });
        await sendEmail(resend, { to: email, subject, html, text, tags: [{ name: "type", value: "prefs" }] });
      }
    } catch (emailErr) {
      console.error("Prefs confirmation email failed:", emailErr);
    }
  }

  // Send a welcome text when SMS is enabled for the first time, re-enabled, or the number changes
  const newPhone = phoneNumber?.trim();
  if (smsEnabled && newPhone && (newPhone !== oldPhone || !oldSmsEnabled)) {
    const sms = smsConfig();
    if (sms) {
      const welcomeMsg = welcomeText(firstName);
      // Awaited: Vercel freezes the function once the response is sent, which would drop an in-flight send.
      // Attach the contact card so the number saves as "Pete's Postings" in one tap.
      const contactCard = `${origin}/petes-postings.vcf`;
      const welcomeSid = await sendSms(sms, newPhone, welcomeMsg, contactCard).catch((e) => console.error("Welcome SMS failed:", e.message));
      // The welcome text carries the STOP wording, so alerts can skip it for the next 30 days.
      if (welcomeSid) await logNotification({ userId, channel: "sms-optout-notice", status: "sent", recipient: newPhone, providerId: welcomeSid });
    }
  }
}
