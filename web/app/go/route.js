// GET /go?u=<job link> — every job link on the site goes through here. Counts the click
// (one row per user + job in short_links, source 'web'), then sends the visitor on.
import crypto from "crypto";
import { sql } from "@vercel/postgres";
import { auth } from "@clerk/nextjs/server";
import { BOT_UA } from "@/lib/notif-helpers";

export const dynamic = "force-dynamic";

// Only sites we already have jobs from, so no one can use petespostings.com to send people
// elsewhere. The jobs table is filled only by our bank scrapers, so a new bank's site is
// allowed as soon as the cron stores its first job. If the lookup fails, send them home.
async function isBankSite(target) {
  const prefix = `https://${target.hostname}/`;
  try {
    const { rows } = await sql`SELECT 1 FROM jobs WHERE left(link, ${prefix.length}) = ${prefix} LIMIT 1`;
    return rows.length > 0;
  } catch (err) {
    console.error("bank site check failed:", err);
    return false;
  }
}

export async function GET(request) {
  const link = new URL(request.url).searchParams.get("u") || "";
  let target;
  try {
    target = new URL(link);
  } catch {}
  if (!target || target.protocol !== "https:" || !(await isBankSite(target))) {
    return Response.redirect(new URL("/", request.url), 302);
  }

  // A failed count must never stop the visitor reaching the job.
  try {
    if (!BOT_UA.test(request.headers.get("user-agent") || "")) {
      const { userId } = await auth();
      const who = userId || "anon";
      const code = crypto.createHash("sha256").update(`web|${who}|${link}`).digest("base64url").slice(0, 8);
      await sql`
        INSERT INTO short_links (code, link, user_id, source, clicks, first_clicked_at, last_clicked_at)
        VALUES (${code}, ${link}, ${who}, 'web', 1, NOW(), NOW())
        ON CONFLICT (code) DO UPDATE SET clicks = short_links.clicks + 1, last_clicked_at = NOW()
      `;
    }
  } catch (err) {
    console.error("click count failed:", err);
  }
  return Response.redirect(link, 302);
}
