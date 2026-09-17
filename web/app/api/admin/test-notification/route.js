// GET /api/admin/test-notification?to=<email>[&phone=<e164>] — sends one sample alert through the
// shared sender so email and SMS delivery can be checked without waiting for a real posting.
// GET ...?preview=alert|welcome|prefs|club — returns the rendered HTML instead of sending.
// Guarded by CRON_SECRET (Authorization: Bearer, or ?key= for browser previews).
import { Resend } from "resend";
import { sendUserNotification, telnyxConfig } from "@/lib/notif-send";
import { alertEmail, welcomeEmail, prefsEmail, clubConfirmationEmail } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

const SAMPLE_JOBS = [
  { title: "Investment Banking Analyst, Technology Group", bank: "Goldman Sachs", link: "https://petespostings.com/jobs?bank=gs", location: "New York, NY", category: "Investment Banking" },
  { title: "Equity Research Analyst, Healthcare", bank: "Goldman Sachs", link: "https://petespostings.com/jobs?bank=gs", location: "New York, NY", category: "Research" },
  { title: "2027 Summer Analyst Program, Markets", bank: "JPMorgan Chase", link: "https://petespostings.com/jobs?bank=jpmc", location: "Chicago, IL", category: "Sales & Trading" },
];

export async function GET(request) {
  const url = new URL(request.url);
  const cronSecret = process.env.CRON_SECRET;
  const authed = !cronSecret || request.headers.get("authorization") === `Bearer ${cronSecret}` || url.searchParams.get("key") === cronSecret;
  if (!authed) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const preview = url.searchParams.get("preview");
  if (preview) {
    const built = {
      alert: () => alertEmail({ jobs: SAMPLE_JOBS, firstName: "Alex", userId: "preview-user" }),
      welcome: () => welcomeEmail({ firstName: "Alex", bankCount: 20 }),
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

  const telnyx = telnyxConfig();
  const result = await sendUserNotification({
    resend: new Resend(process.env.RESEND_API_KEY),
    telnyx,
    userId: "test-user",
    email: to,
    firstName: "",
    prefs: { smsEnabled: !!phone, phoneNumber: phone },
    jobs: SAMPLE_JOBS,
  });
  return Response.json({ ...result, smsConfigured: !!telnyx });
}
