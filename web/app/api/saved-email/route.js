// POST /api/saved-email: emails the signed-in user the roles on their Saved tab (with Applied
// marked), to the email on their account. App-only members (no email on file) send { email }.
import { auth, clerkClient } from "@clerk/nextjs/server";
import { Resend } from "resend";
import { savedJobsEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { jobStatuses } from "@/lib/job-status";
import { isAppOnly, contactEmail } from "@/lib/app-user";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const typed = isAppOnly(user) ? String((await req.json().catch(() => ({})))?.email || "").trim().slice(0, 200) : "";
  if (typed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed)) return Response.json({ error: "That email doesn't look right." }, { status: 400 });
  const email = typed || contactEmail(user);
  if (!email) return Response.json({ error: "Enter an email address to send them to." }, { status: 400 });
  const jobs = (user.unsafeMetadata?.savedJobs || []).filter((j) => j?.link && j?.title);
  if (!jobs.length) return Response.json({ error: "You haven't saved any roles yet." }, { status: 400 });

  const statuses = await jobStatuses(userId).catch(() => ({}));
  const { subject, html, text } = savedJobsEmail({ firstName: user.firstName, jobs, statuses });
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    // One per minute at most, so a double tap doesn't send two.
    await sendEmail(resend, { to: email, subject, html, text, idempotencyKey: `saved-${userId}-${Math.floor(Date.now() / 60000)}`, tags: [{ name: "type", value: "saved" }] });
  } catch (err) {
    console.error("saved roles email failed:", err);
    return Response.json({ error: "Couldn't send the email. Try again." }, { status: 500 });
  }
  return Response.json({ success: true, email });
}
