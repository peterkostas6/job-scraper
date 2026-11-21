// GET /j/<code> — short link from an alert text or email. Counts the click, then sends the
// visitor on to the job posting on the bank's site. Alerts are free, but once an account's
// 3 free days from sign-up are up (lib/alert-trial-days.js) its alert links open the Premium page instead,
// until it pays.
import { sql } from "@vercel/postgres";
import { clerkClient } from "@clerk/nextjs/server";
import { BOT_UA } from "@/lib/notif-helpers";
import { captureServer } from "@/lib/posthog-server";
import { alertTrial } from "@/lib/alert-trial";
import { markViewed } from "@/lib/job-status";

export const dynamic = "force-dynamic";

// True only when we know the account is unpaid and its trial is over. Any failed lookup
// lets the click through: a paying user must never hit the paywall by mistake.
async function alertLinkLocked(userId) {
  if (!userId || !userId.startsWith("user_")) return false;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    if (user.publicMetadata?.subscribed === true) return false;
    return alertTrial(user.createdAt).over;
  } catch {
    return false;
  }
}

export async function GET(request, { params }) {
  const home = new URL("/", request.url);
  try {
    const counted = request.method === "GET" && !BOT_UA.test(request.headers.get("user-agent") || "");
    const { rows } = counted
      ? await sql`
          UPDATE short_links
          SET clicks = clicks + 1, first_clicked_at = COALESCE(first_clicked_at, NOW()), last_clicked_at = NOW()
          WHERE code = ${params.code}
          RETURNING link, user_id, source
        `
      : await sql`SELECT link, user_id, source FROM short_links WHERE code = ${params.code}`;
    const row = rows[0];
    if (!row) return Response.redirect(home, 302);
    const locked = (row.source === "sms" || row.source === "email") && (await alertLinkLocked(row.user_id));
    if (counted) await captureServer(row.user_id, "job_link_clicked", { source: row.source || "sms", link: row.link, bank_site: new URL(row.link).hostname, from_alert: true, locked });
    if (locked) {
      const pay = new URL("/pricing", request.url);
      pay.searchParams.set("alert", params.code);
      return Response.redirect(pay, 302);
    }
    if (counted) await markViewed(row.user_id, row.link);
    return Response.redirect(row.link, 302);
  } catch (err) {
    console.error("short link error:", err);
    return Response.redirect(home, 302);
  }
}
