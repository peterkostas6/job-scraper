// POST /api/saved-email: emails the signed-in user the roles on their Saved tab (with Applied
// marked), to the email on their account.
import { auth, clerkClient } from "@clerk/nextjs/server";
import { Resend } from "resend";
import { savedJobsEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { jobStatuses } from "@/lib/job-status";

export const dynamic = "force-dynamic";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress;
  if (!email) return Response.json({ error: "There's no email on your account." }, { status: 400 });
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
