// GET /api/admin/test-notification?to=<email>[&phone=<e164>] — sends one sample alert through the
// shared sender so email and SMS delivery can be checked without waiting for a real posting.
// Add &locked=1 to send the text someone without Premium gets (its link opens /pricing).
// Add &resendLast=1 to send the jobs from the most recent real text alert instead of the samples.
// GET ...?preview=alert|welcome|prefs|club — returns the rendered HTML instead of sending.
// Guarded by CRON_SECRET (Authorization: Bearer, or ?key= for browser previews).
import { Resend } from "resend";
import { sql } from "@vercel/postgres";
import { sendUserNotification, smsConfig } from "@/lib/notif-send";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { alertEmail, welcomeEmail, prefsEmail, clubConfirmationEmail } from "@/lib/email-templates";
import { BANK_COUNT } from "@/lib/banks";

export const dynamic = "force-dynamic";

const SAMPLE_JOBS = [
  { title: "Investment Banking Analyst, Technology Group", bank: "Goldman Sachs", link: "https://petespostings.com/jobs?bank=gs", location: "New York, NY", category: "Investment Banking" },
  { title: "Equity Research Analyst, Healthcare", bank: "Goldman Sachs", link: "https://petespostings.com/jobs?bank=gs", location: "New York, NY", category: "Research" },
  { title: "2027 Summer Analyst Program, Markets", bank: "JPMorgan Chase", link: "https://petespostings.com/jobs?bank=jpmc", location: "Chicago, IL", category: "Sales & Trading" },
];

async function ownPhoneSample(url) {
  if (url.searchParams.get("locked") !== "1" || url.searchParams.get("to") || url.searchParams.get("preview")) return false;
  const digits = (v) => String(v || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  try {
    const { userId } = await auth();
    if (!userId) return false;
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const saved = digits(user.unsafeMetadata?.notifications?.phoneNumber);
    return saved.length === 10 && saved === digits(url.searchParams.get("phone"));
  } catch {
    return false;
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const cronSecret = process.env.CRON_SECRET;
  const keyed = !cronSecret || request.headers.get("authorization") === `Bearer ${cronSecret}` || url.searchParams.get("key") === cronSecret;
  // Without the key, a signed-in user may send themselves the no-Premium sample text
  // (?locked=1, no email), and only to the phone number saved in their own alert preferences.
  const authed = keyed || (await isAdmin()) || (await ownPhoneSample(url));
  if (!authed) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const preview = url.searchParams.get("preview");
  if (preview) {
    const built = {
      alert: () => alertEmail({ jobs: SAMPLE_JOBS, firstName: "Alex", userId: "preview-user" }),
      welcome: () => welcomeEmail({ firstName: "Alex", bankCount: BANK_COUNT }),
      prefs: () => prefsEmail({ firstName: "Alex", isFirstSetup: true, enabled: true, smsEnabled: true, phoneNumber: "+12125550147", bankNames: ["Goldman Sachs", "JPMorgan Chase"], categories: [], jobTypeLabel: "Internships only", userId: "preview-user" }),
      club: () => clubConfirmationEmail({ contactName: "Alex", clubName: "Finance Society", schoolName: "NYU Stern" }),
    }[preview];
    if (!built) return Response.json({ error: "Unknown preview" }, { status: 400 });
    const { html, text } = built();
    if (url.searchParams.get("text") === "1") return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const to = url.searchParams.get("to");
  const phone = url.searchParams.get("phone");
  if (!to && !phone) return Response.json({ error: "Pass ?to=<email> and/or ?phone=<e164>, or ?preview=alert" }, { status: 400 });

  let jobs = SAMPLE_JOBS;
  if (url.searchParams.get("resendLast") === "1") {
    const { rows } = await sql`
      SELECT j.title, j.bank, j.link, j.location, j.category
      FROM jobs j
      WHERE j.link IN (
        SELECT unnest(job_links) FROM (
          SELECT job_links FROM notification_log WHERE channel = 'sms' AND status = 'sent' ORDER BY created_at DESC LIMIT 1
        ) last
      )
    `;
    if (rows.length === 0) return Response.json({ error: "No previous text alert found" }, { status: 404 });
    jobs = rows;
  }

  const sms = smsConfig();
  const result = await sendUserNotification({
    resend: new Resend(process.env.RESEND_API_KEY),
    sms,
    userId: url.searchParams.get("locked") === "1" ? "test-locked" : "test-user",
    email: to,
    firstName: "",
    prefs: { smsEnabled: !!phone, phoneNumber: phone },
    jobs,
    forceLocked: url.searchParams.get("locked") === "1",
  });
  return Response.json({ ...result, smsConfigured: !!sms });
}
