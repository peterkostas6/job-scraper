// POST /api/webhook/clerk — handles Clerk user lifecycle events
// user.created: sends welcome email via Resend + grants student Pro access if qualifying .edu email
// Secured with Svix signature verification using CLERK_WEBHOOK_SECRET
import { welcomeEmail, newMemberEmail, NEW_MEMBER_NOTICE_TO } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { Resend } from "resend";
import { createHmac } from "crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { sendMetaServerEvent } from "@/lib/meta-capi";
import { sendRedditServerEvent } from "@/lib/reddit-capi";

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

    const studentPro = domain.endsWith(".edu") && partnerDomains.includes(domain.toLowerCase());
    if (studentPro) {
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
      const { subject, html, text } = welcomeEmail({ firstName, bankCount: 20 });
      await sendEmail(resend, { to: email, subject, html, text, idempotencyKey: `welcome-${userData.id}`, tags: [{ name: "type", value: "welcome" }] });
    } catch (err) {
      console.error("Failed to send welcome email:", err);
    }

    // Tell the owners about every new account.
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const name = [userData.first_name, userData.last_name].filter(Boolean).join(" ") || "Not given";
      const notice = newMemberEmail({
        subject: `New free account: ${email}`,
        heading: "Someone signed up for a free account",
        rows: [["Name", name], ["Email", email], ["Student Pro", studentPro ? "Yes (partner school)" : "No"]],
      });
      await sendEmail(resend, { to: NEW_MEMBER_NOTICE_TO, ...notice, idempotencyKey: `owner-signup-${userData.id}`, tags: [{ name: "type", value: "owner-signup" }] });
    } catch (err) {
      console.error("Failed to send new account notice:", err);
    }

    // Server copy of the browser's CompleteRegistration (same event ID).
    await sendMetaServerEvent({ eventName: "CompleteRegistration", eventId: `reg_${userData.id}`, email, externalId: userData.id });
    await sendRedditServerEvent({ eventType: "SignUp", conversionId: `reg_${userData.id}`, email, externalId: userData.id });
  }

  return Response.json({ received: true });
}
