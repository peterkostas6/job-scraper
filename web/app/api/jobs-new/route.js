// GET /api/jobs-new — returns jobs detected in the last 48 hours from Postgres
// Pro subscribers only. last48hCount always returned for teaser banners.
import { sql } from "@vercel/postgres";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { isBankingEntryLevel } from "@/lib/notif-helpers";

function isUSLocation(loc) {
  if (!loc) return true;
  const l = loc.toLowerCase();
  if (l.includes("united states")) return true;
  // State abbreviations (e.g. "NY", "TX")
  if (/[,\-]\s*(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)\b/i.test(l)) return true;
  // Full state names (e.g. "Texas", "Florida")
  if (l.includes("alabama") || l.includes("alaska") || l.includes("arizona") || l.includes("arkansas") || l.includes("california") || l.includes("colorado") || l.includes("connecticut") || l.includes("delaware") || l.includes("florida") || l.includes("georgia") || l.includes("hawaii") || l.includes("idaho") || l.includes("illinois") || l.includes("indiana") || l.includes("iowa") || l.includes("kansas") || l.includes("kentucky") || l.includes("louisiana") || l.includes("maine") || l.includes("maryland") || l.includes("massachusetts") || l.includes("michigan") || l.includes("minnesota") || l.includes("mississippi") || l.includes("missouri") || l.includes("montana") || l.includes("nebraska") || l.includes("nevada") || l.includes("hampshire") || l.includes("new jersey") || l.includes("new mexico") || l.includes("new york") || l.includes("carolina") || l.includes("dakota") || l.includes("ohio") || l.includes("oklahoma") || l.includes("oregon") || l.includes("pennsylvania") || l.includes("rhode island") || l.includes("tennessee") || l.includes("texas") || l.includes("utah") || l.includes("vermont") || l.includes("virginia") || l.includes("washington") || l.includes("west virginia") || l.includes("wisconsin") || l.includes("wyoming")) return true;
  // Major US cities
  if (l.includes("new york") || l.includes("chicago") || l.includes("san francisco") || l.includes("los angeles") || l.includes("boston") || l.includes("houston") || l.includes("dallas") || l.includes("miami") || l.includes("atlanta") || l.includes("seattle") || l.includes("charlotte") || l.includes("whippany") || l.includes("wilmington") || l.includes("minneapolis") || l.includes("denver") || l.includes("phoenix") || l.includes("philadelphia") || l.includes("san diego") || l.includes("detroit") || l.includes("nashville") || l.includes("baltimore") || l.includes("portland") || l.includes("las vegas") || l.includes("memphis") || l.includes("louisville") || l.includes("richmond") || l.includes("pittsburgh") || l.includes("cincinnati") || l.includes("cleveland") || l.includes("indianapolis") || l.includes("columbus") || l.includes("jacksonville") || l.includes("austin") || l.includes("tampa") || l.includes("orlando") || l.includes("st. louis") || l.includes("kansas city") || l.includes("salt lake") || l.includes("richmond") || l.includes("stamford") || l.includes("greenwich")) return true;
  if (l.includes("multiple")) return true;
  return false;
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    let isSubscribed = false;

    if (userId) {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      isSubscribed = user.publicMetadata?.subscribed === true;
    }

    // Only fetch jobs that are currently live on the bank's website (is_live = true)
    // The cron updates this flag every 30 mins — expired/removed jobs are filtered out automatically
    const { rows } = await sql`
      SELECT
        link,
        title,
        bank,
        bank_key,
        location,
        category,
        posted_date,
        EXTRACT(EPOCH FROM detected_at)::bigint * 1000 AS detected_at_ms
      FROM jobs
      WHERE detected_at > NOW() - INTERVAL '7 days'
        AND is_live = true
      ORDER BY detected_at DESC
    `;

    if (rows.length === 0) {
      return Response.json({ last48h: [], last48hCount: 0, total: 0 });
    }

    const now = Date.now();
    const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;

    const jobs = [];
    for (const row of rows) {
      const detectedAt = Number(row.detected_at_ms);

      // Show job if cron detected it within the last 48 hours
      if (detectedAt < fortyEightHoursAgo) continue;

      // Only show banking entry-level roles — filter out ops, admin, etc.
      if (!isBankingEntryLevel(row.title)) continue;

      // Only show US jobs
      if (!isUSLocation(row.location || "")) continue;

      jobs.push({
        link: row.link,
        title: row.title,
        location: row.location,
        bank: row.bank,
        bankKey: row.bank_key,
        category: row.category,
        postedDate: row.posted_date ? new Date(row.posted_date).toISOString() : null,
        detectedAt,
      });
    }

    // Sort newest first
    jobs.sort((a, b) => b.detectedAt - a.detectedAt);

    return Response.json({
      last48h: isSubscribed ? jobs : [],
      last48hCount: jobs.length,
      total: jobs.length,
    });
  } catch (err) {
    console.error("jobs-new error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
