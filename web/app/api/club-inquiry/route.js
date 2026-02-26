// POST /api/club-inquiry — handles club partnership inquiry form submissions
// Sends an internal notification email to Pete + a confirmation email to the requester
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
    // Send inquiry notification to Pete
    await resend.emails.send({
      from: "Pete's Postings <hello@petespostings.com>",
      to: inboxEmail,
      subject: `Club Partnership Inquiry: ${clubName} — ${schoolName}`,
      html: `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1e293b;">
  <h2 style="font-size:18px;font-weight:700;margin-bottom:24px;">New Club Partnership Inquiry</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:140px;">School</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${schoolName}</td></tr>
    <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Club / Org</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${clubName}</td></tr>
    <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Approx. Members</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${memberCount || "Not specified"}</td></tr>
    <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Contact Name</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${contactName}</td></tr>
    <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Contact Email</td><td style="padding:8px 0;font-size:14px;"><a href="mailto:${contactEmail}" style="color:#2563eb;">${contactEmail}</a></td></tr>
  </table>
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
    <a href="mailto:${contactEmail}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;font-size:13px;font-weight:600;text-decoration:none;border-radius:8px;">Reply to ${contactName}</a>
  </div>
</body></html>`,
    });

    // Send confirmation to the requester
    await resend.emails.send({
      from: "Pete's Postings <hello@petespostings.com>",
      to: contactEmail,
      subject: "We received your partnership inquiry",
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <p style="font-size:20px;font-weight:800;color:#1e293b;margin:0 0 32px;">Pete's Postings</p>
    <p style="font-size:15px;color:#334155;margin:0 0 12px;">Hi ${contactName},</p>
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 20px;">
      Thanks for reaching out about a club partnership for <strong>${clubName}</strong> at <strong>${schoolName}</strong>.
    </p>
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;">
      We'll review your inquiry and get back to you within <strong>24 hours</strong>.
    </p>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
      <p style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px;">Club membership includes</p>
      <ul style="margin:0;padding:0 0 0 20px;font-size:14px;color:#475569;line-height:2;">
        <li>All Pro features for every member</li>
        <li>Last 48-hour postings</li>
        <li>Save &amp; bookmark jobs</li>
        <li>Email notifications for new postings</li>
        <li>Member verification via student email</li>
      </ul>
    </div>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="https://petespostings.com" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Browse Active Postings</a>
    </div>
    <p style="font-size:15px;color:#334155;">— Pete</p>
    <p style="font-size:11px;color:#94a3b8;margin-top:32px;">Pete's Postings &middot; Not affiliated with any listed bank</p>
  </div>
</body>
</html>`,
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error("Club inquiry email error:", err);
    return Response.json({ error: "Failed to send emails" }, { status: 500 });
  }
}
