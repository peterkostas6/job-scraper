// POST /api/webhook/clerk — handles Clerk user lifecycle events
// user.created: sends welcome email via Resend + grants student Pro access if qualifying .edu email
// Secured with Svix signature verification using CLERK_WEBHOOK_SECRET
import { Resend } from "resend";
import { createHmac } from "crypto";
import { clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

function verifyClerkWebhook(payload, headers) {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return false;

  // Clerk webhook secrets are base64-encoded after the "whsec_" prefix
  const secretBytes = Buffer.from(secret.replace("whsec_", ""), "base64");
  const toSign = `${svixId}.${svixTimestamp}.${payload}`;
  const computed = createHmac("sha256", secretBytes).update(toSign).digest("base64");

  // svix-signature is space-separated list of "v1,<hash>" tokens
  return svixSignature.split(" ").some((sig) => {
    const [version, hash] = sig.split(",");
    return version === "v1" && hash === computed;
  });
}

function buildWelcomeEmail(firstName) {
  const name = firstName || "there";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <p style="font-size:20px;font-weight:800;color:#1e293b;margin:0 0 32px;">Pete's Postings</p>
    <p style="font-size:16px;color:#334155;margin:0 0 12px;">Hey ${name},</p>
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;">
      Welcome to Pete's Postings. You now have access to live analyst and internship postings
      pulled directly from <strong>7 bulge bracket bank career sites</strong> — updated daily.
      No LinkedIn noise, no outdated spreadsheets.
    </p>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <p style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px;">Your free access includes</p>
      <ul style="margin:0;padding:0 0 0 20px;font-size:14px;color:#475569;line-height:2;">
        <li>Live postings from JPMC, GS, MS, BofA, Citi, Deutsche Bank &amp; Barclays</li>
        <li>Filter by location, job type, and category</li>
        <li>Search by title across any bank</li>
        <li>New postings from the past week</li>
      </ul>
    </div>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px 20px;margin-bottom:28px;">
      <p style="font-size:13px;font-weight:700;color:#1e40af;margin:0 0 6px;">Want more? Upgrade to Pro</p>
      <p style="font-size:13px;color:#3b82f6;line-height:1.6;margin:0;">
        Save jobs, get email alerts for new postings, and see jobs posted in the last 48 hours — starting at $4.99/mo.
      </p>
    </div>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="https://petespostings.com" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Browse Jobs Now</a>
    </div>
    <p style="font-size:11px;color:#94a3b8;text-align:center;line-height:1.6;">
      Pete's Postings &middot; Not affiliated with any listed bank
    </p>
  </div>
</body>
</html>`;
}

export async function POST(req) {
  const payload = await req.text();

  if (!verifyClerkWebhook(payload, req.headers)) {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.type === "user.created") {
    const userData = event.data;
    const email = userData.email_addresses?.[0]?.email_address;
    const firstName = userData.first_name || "";

    if (!email) return Response.json({ received: true });

    // Check if email domain qualifies for free student Pro access
    const domain = email.split("@")[1] || "";
    const partnerDomains = (process.env.STUDENT_PARTNER_DOMAINS || "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    if (domain.endsWith(".edu") && partnerDomains.includes(domain.toLowerCase())) {
      try {
        const client = await clerkClient();
        await client.users.updateUserMetadata(userData.id, {
          publicMetadata: { subscribed: true, plan: "student" },
        });
      } catch (err) {
        console.error("Failed to grant student Pro access:", err);
      }
    }

    // Send welcome email
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Pete's Postings <hello@petespostings.com>",
        to: email,
        subject: "Welcome to Pete's Postings",
        html: buildWelcomeEmail(firstName),
      });
    } catch (err) {
      console.error("Failed to send welcome email:", err);
    }
  }

  return Response.json({ received: true });
}
