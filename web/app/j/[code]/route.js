// GET /j/<code> — short link from an alert text. Counts the click, then sends the
// visitor on to the job posting on the bank's site.
import { sql } from "@vercel/postgres";
import { BOT_UA } from "@/lib/notif-helpers";
import { captureServer } from "@/lib/posthog-server";

export const dynamic = "force-dynamic";

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
      : await sql`SELECT link FROM short_links WHERE code = ${params.code}`;
    const row = rows[0];
    if (counted && row) await captureServer(row.user_id, "job_link_clicked", { source: row.source || "sms", link: row.link, bank_site: new URL(row.link).hostname, from_alert: true });
    return Response.redirect(row?.link || home, 302);
  } catch (err) {
    console.error("short link error:", err);
    return Response.redirect(home, 302);
  }
}
