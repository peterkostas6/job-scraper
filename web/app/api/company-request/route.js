// POST /api/company-request — a signed-in user asks us to add a company. Saved to
// company_requests and emailed to Pete.
import { sql } from "@vercel/postgres";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { Resend } from "resend";
import { companyRequestEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// GET: the signed-in user's own requests (newest first) and the firms most people have asked for.
// The app works out which have been added by matching names against the firms we track.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  try {
    const mine = await sql`
      SELECT MIN(company) AS company, MAX(created_at) AS at
      FROM company_requests WHERE user_id = ${userId}
      GROUP BY LOWER(company) ORDER BY at DESC LIMIT 30`;
    const popular = await sql`
      SELECT MIN(company) AS company, COUNT(DISTINCT user_id)::int AS people
      FROM company_requests
      GROUP BY LOWER(company) HAVING COUNT(DISTINCT user_id) >= 2
      ORDER BY people DESC LIMIT 12`;
    return Response.json({ mine: mine.rows, popular: popular.rows });
  } catch (err) {
    console.error("company request list failed:", err);
    return Response.json({ mine: [], popular: [] });
  }
}

export async function POST(request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in to request a company." }, { status: 401 });

  const client = await clerkClient();
  const user = await client.users.getUser(userId);

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
      to: "pete@petespostings.com",
      ...(email && { replyTo: email }),
      ...notice,
      tags: [{ name: "type", value: "company-request" }],
    });
  } catch (err) {
    console.error("company request email failed:", err);
  }

  return Response.json({ success: true });
}
