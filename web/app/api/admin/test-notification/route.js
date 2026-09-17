// GET /api/admin/test-notification?to=<email>[&phone=<e164>] — sends one sample alert through the
// shared sender so email and SMS delivery can be checked without waiting for a real posting.
// Guarded by CRON_SECRET.
import { Resend } from "resend";
import { sendUserNotification, telnyxConfig } from "@/lib/notif-send";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const to = url.searchParams.get("to");
  const phone = url.searchParams.get("phone");
  if (!to && !phone) return Response.json({ error: "Pass ?to=<email> and/or ?phone=<e164>" }, { status: 400 });

  const jobs = [
    { title: "Investment Banking Analyst (test alert)", bank: "Goldman Sachs", link: "https://petespostings.com/jobs?bank=gs", location: "New York, NY", category: "Investment Banking" },
    { title: "Summer Analyst Program 2027 (test alert)", bank: "JPMorgan Chase", link: "https://petespostings.com/jobs?bank=jpmc", location: "New York, NY", category: "Investment Banking" },
  ];
  const telnyx = telnyxConfig();
  const result = await sendUserNotification({
    resend: new Resend(process.env.RESEND_API_KEY),
    telnyx,
    email: to,
    firstName: "",
    prefs: { smsEnabled: !!phone, phoneNumber: phone },
    jobs,
  });
  return Response.json({ ...result, smsConfigured: !!telnyx });
}
