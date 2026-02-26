import { auth, clerkClient } from "@clerk/nextjs/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const BANK_NAMES = {
  jpmc: "JPMorgan Chase",
  gs: "Goldman Sachs",
  ms: "Morgan Stanley",
  bofa: "Bank of America",
  citi: "Citi",
  db: "Deutsche Bank",
  barclays: "Barclays",
};

const JOB_TYPE_LABELS = {
  all: "All types (analyst + internship)",
  internship: "Internship only",
  fulltime: "Analyst only",
};

function buildPrefsEmail({ firstName, isFirstSetup, enabled, smsEnabled, phoneNumber, banks, jobType }) {
  const name = firstName || "there";
  const bankList = banks && banks.length > 0
    ? banks.map((k) => BANK_NAMES[k] || k).join(", ")
    : "All banks";
  const jobTypeLabel = JOB_TYPE_LABELS[jobType] || "All types";
  const subject = isFirstSetup ? "Your notification preferences are set up" : "Your notification preferences were updated";
  const intro = isFirstSetup
    ? `You're all set. Here's a summary of what you'll be notified about:`
    : `Your notification preferences have been updated. Here's what's now active:`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <p style="font-size:20px;font-weight:800;color:#1e293b;margin:0 0 32px;">Pete's Postings</p>
    <p style="font-size:15px;color:#334155;margin:0 0 8px;">Hey ${name},</p>
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;">${intro}</p>

    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px;width:160px;border-bottom:1px solid #f1f5f9;">Email alerts</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;border-bottom:1px solid #f1f5f9;color:${enabled ? "#16a34a" : "#94a3b8"};">${enabled ? "On" : "Off"}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">SMS alerts</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;border-bottom:1px solid #f1f5f9;color:${smsEnabled ? "#16a34a" : "#94a3b8"};">${smsEnabled ? `On${phoneNumber ? ` · ${phoneNumber}` : ""}` : "Off"}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">Banks</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;border-bottom:1px solid #f1f5f9;">${bankList}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px;">Job type</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;">${jobTypeLabel}</td>
        </tr>
      </table>
    </div>

    <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 24px;">
      Alerts go out at <strong>9am and 4pm ET</strong> on days when new matching jobs are posted.
      You can update your preferences anytime from your dashboard.
    </p>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="https://petespostings.com" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Browse Active Postings</a>
    </div>

    <p style="font-size:15px;color:#334155;">— Pete</p>
    <p style="font-size:11px;color:#94a3b8;margin-top:32px;">Pete's Postings · Not affiliated with any listed bank</p>
  </div>
</body>
</html>`;

  return { subject, html };
}

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
    const { enabled, banks, categories, jobType, smsEnabled } = body;

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

    await client.users.updateUser(userId, {
      unsafeMetadata: {
        ...user.unsafeMetadata,
        notifications: {
          enabled: Boolean(enabled),
          banks: Array.isArray(banks) ? banks : [],
          categories: Array.isArray(categories) ? categories : [],
          jobType: jobType || "all",
          smsEnabled: Boolean(smsEnabled),
          phoneNumber: phoneNumber || "",
        },
      },
    });

    const email = user.emailAddresses?.[0]?.emailAddress;
    const firstName = user.firstName || "";

    // Send preferences confirmation email
    if (email) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { subject, html } = buildPrefsEmail({
          firstName,
          isFirstSetup,
          enabled: Boolean(enabled),
          smsEnabled: Boolean(smsEnabled),
          phoneNumber: phoneNumber || "",
          banks: Array.isArray(banks) ? banks : [],
          jobType: jobType || "all",
        });
        await resend.emails.send({
          from: "Pete's Postings <hello@petespostings.com>",
          to: email,
          subject,
          html,
        });
      } catch (emailErr) {
        console.error("Prefs confirmation email failed:", emailErr);
      }
    }

    // Send welcome SMS when SMS is enabled for the first time, re-enabled, or phone number changes
    const newPhone = phoneNumber?.trim();
    if (smsEnabled && newPhone && (newPhone !== oldPhone || !oldSmsEnabled)) {
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

      if (twilioSid && twilioToken && twilioFrom) {
        const welcomeMsg = `Hey${firstName ? ` ${firstName}` : ""}! This is Pete from Pete's Postings. I'll send you a text based on your preferences when new jobs get posted. Good luck! petespostings.com`;

        const encoded = new URLSearchParams({ To: newPhone, From: twilioFrom, Body: welcomeMsg });
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
          },
          body: encoded.toString(),
        }).catch((e) => console.error("Welcome SMS failed:", e));
      }
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Notifications POST error:", err);
    return Response.json({ error: "Failed to save preferences" }, { status: 500 });
  }
}
