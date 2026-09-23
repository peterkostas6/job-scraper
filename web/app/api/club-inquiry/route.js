// POST /api/club-inquiry — handles club partnership inquiry form submissions
// Sends an internal notification email to Pete + a confirmation email to the requester
import { clubInquiryEmail, clubConfirmationEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { smsConfig, sendSms } from "@/lib/notif-send";
import { Resend } from "resend";

export async function POST(req) {
  const { schoolName, clubName, memberCount, contactName, contactEmail } = await req.json();

  if (!schoolName || !clubName || !contactName || !contactEmail) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Basic email validation
  if (!contactEmail.includes("@")) {
    return Response.json({ error: "Invalid email address" }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const inboxEmail = process.env.CONTACT_EMAIL || "pete@petespostings.com";

  try {
    // Notice to Pete, then confirmation to the requester
    const notice = clubInquiryEmail({ schoolName, clubName, memberCount, contactName, contactEmail });
    await sendEmail(resend, { to: inboxEmail, replyTo: contactEmail, ...notice, tags: [{ name: "type", value: "club-inquiry" }] });

    const confirm = clubConfirmationEmail({ contactName, clubName, schoolName });
    await sendEmail(resend, { to: contactEmail, ...confirm, tags: [{ name: "type", value: "club-confirmation" }] });

    // Send SMS alert to Pete
    const sms = smsConfig();
    if (sms) {
      await sendSms(sms, "+14014878091", `Club inquiry: ${clubName} @ ${schoolName}\n${memberCount ? memberCount + " members\n" : ""}${contactName} — ${contactEmail}`);
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Club inquiry email error:", err);
    return Response.json({ error: "Failed to send emails" }, { status: 500 });
  }
}
