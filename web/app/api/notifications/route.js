import { prefsEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { telnyxConfig, sendSms } from "@/lib/notif-send";
import { BANK_NAMES } from "@/lib/banks";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const JOB_TYPE_LABELS = {
  all: "All types (analyst + internship)",
  internship: "Internship only",
  fulltime: "Analyst only",
};

// GET — fetch current notification preferences
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const notifications = user.unsafeMetadata?.notifications || {
      enabled: false,
      banks: [],
      categories: [],
      jobType: "all",
    };

    return Response.json({ notifications });
  } catch (err) {
    console.error("Notifications GET error:", err);
    return Response.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}

// POST — save notification preferences
export async function POST(request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { enabled, banks, categories, jobType } = body;

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
          smsEnabled,
          phoneNumber: phoneNumber || "",
          smsConsent,
          smsConsentAt,
          smsOptOutAt: smsEnabled ? null : oldPrefs?.smsOptOutAt || null,
        },
      },
    });

    const email = user.emailAddresses?.[0]?.emailAddress;
    const firstName = user.firstName || "";

    // Send preferences confirmation email
    if (email) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { subject, html, text } = prefsEmail({
          firstName,
          isFirstSetup,
          enabled: Boolean(enabled),
          smsEnabled: Boolean(smsEnabled),
          phoneNumber: phoneNumber || "",
          bankNames: (Array.isArray(banks) ? banks : []).map((k) => BANK_NAMES[k] || k),
          categories: Array.isArray(categories) ? categories : [],
          jobTypeLabel: JOB_TYPE_LABELS[jobType] || "All types",
          userId,
        });
        await sendEmail(resend, { to: email, subject, html, text, tags: [{ name: "type", value: "prefs" }] });
      } catch (emailErr) {
        console.error("Prefs confirmation email failed:", emailErr);
      }
    }

    // Send a welcome text when SMS is enabled for the first time, re-enabled, or the number changes
    const newPhone = phoneNumber?.trim();
    if (smsEnabled && newPhone && (newPhone !== oldPhone || !oldSmsEnabled)) {
      const telnyx = telnyxConfig();
      if (telnyx) {
        const welcomeMsg = `Hey${firstName ? ` ${firstName}` : ""}! This is Pete from Pete's Postings. You'll get a text within minutes when a role matching your alerts is posted. Reply STOP to opt out. petespostings.com`;
        sendSms(telnyx, newPhone, welcomeMsg).catch((e) => console.error("Welcome SMS failed:", e.message));
      }
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Notifications POST error:", err);
    return Response.json({ error: "Failed to save preferences" }, { status: 500 });
  }
}
