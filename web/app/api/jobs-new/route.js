// GET /api/jobs-new — returns jobs detected in the last 48 hours from Postgres
// Pro subscribers only. last48hCount always returned for teaser banners.
import { sql } from "@vercel/postgres";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";

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

    // Fetch a wider window so we can apply the filterTime check in JS
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

      // filterTime = the earlier of detectedAt and posted_date.
      // If the bank says a job was posted 3 days ago, don't show it in the 48h tab
      // even if our cron only just detected it.
      let filterTime = detectedAt;
      if (row.posted_date) {
        const postedTs = new Date(row.posted_date).getTime();
        if (!isNaN(postedTs)) filterTime = Math.min(detectedAt, postedTs);
      }

      // Only include jobs whose effective age is within 48 hours
      if (filterTime < fortyEightHoursAgo) continue;

      // Only show analyst and intern roles — filter out ops, admin, etc.
      const t = row.title.toLowerCase();
      const isAnalystOrIntern =
        t.includes("analyst") ||
        /\bintern\b/.test(t) ||
        t.includes("internship") ||
        t.includes("summer") ||
        t.includes("co-op") ||
        t.includes("coop");
      if (!isAnalystOrIntern) continue;

      jobs.push({
        link: row.link,
        title: row.title,
        location: row.location,
        bank: row.bank,
        bankKey: row.bank_key,
        category: row.category,
        postedDate: row.posted_date ? new Date(row.posted_date).toISOString() : null,
        detectedAt,
        filterTime,
        hasActualDate: !!row.posted_date,
      });
    }

    // Sort newest first
    jobs.sort((a, b) => b.filterTime - a.filterTime);

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
