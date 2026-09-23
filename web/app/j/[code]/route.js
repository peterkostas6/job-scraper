// GET /j/<code> — short link from an alert text. Counts the click, then sends the
// visitor on to the job posting on the bank's site.
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";

// Link previews and carrier scanners fetch the URL too; those are not people.
const BOT_UA = /bot|crawl|spider|preview|facebookexternalhit|slurp|scan/i;

export async function GET(request, { params }) {
  const home = new URL("/", request.url);
  try {
    const counted = request.method === "GET" && !BOT_UA.test(request.headers.get("user-agent") || "");
    const { rows } = counted
      ? await sql`
          UPDATE short_links
          SET clicks = clicks + 1, first_clicked_at = COALESCE(first_clicked_at, NOW()), last_clicked_at = NOW()
          WHERE code = ${params.code}
          RETURNING link
        `
      : await sql`SELECT link FROM short_links WHERE code = ${params.code}`;
    return Response.redirect(rows[0]?.link || home, 302);
  } catch (err) {
    console.error("short link error:", err);
    return Response.redirect(home, 302);
  }
}
