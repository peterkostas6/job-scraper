// POST /api/company-request — a Pro member asks us to add a company. Saved to
// company_requests and emailed to Pete. Pro only: checked here, not just in the page.
import { sql } from "@vercel/postgres";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { Resend } from "resend";
import { companyRequestEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in to request a company." }, { status: 401 });

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  if (user.publicMetadata?.subscribed !== true) {
    return Response.json({ error: "Requests are a Pro feature." }, { status: 403 });
  }

  const { company: raw } = await request.json().catch(() => ({}));
  const company = String(raw || "").trim().replace(/\s+/g, " ");
  if (company.length < 2 || company.length > 100) {
    return Response.json({ error: "Enter a company name." }, { status: 400 });
  }

  const email = user.emailAddresses?.[0]?.emailAddress || null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

  try {
    await sql`INSERT INTO company_requests (user_id, email, company) VALUES (${userId}, ${email}, ${company})`;
  } catch (err) {
    console.error("company request insert failed:", err);
    return Response.json({ error: "Couldn't send your request. Try again." }, { status: 500 });
  }

  // The request is saved either way; a failed notice email only goes to the logs.
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const notice = companyRequestEmail({ company, name, email: email || "No email on file" });
    await sendEmail(resend, {
      to: process.env.CONTACT_EMAIL || "pete@petespostings.com",
      ...(email && { replyTo: email }),
      ...notice,
      tags: [{ name: "type", value: "company-request" }],
    });
  } catch (err) {
    console.error("company request email failed:", err);
  }

  return Response.json({ success: true });
}
