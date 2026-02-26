// GET /api/jobs-new — returns recent jobs from Postgres jobs table
// last48h: Pro subscribers only
// thisWeek (2-7 days): Pro subscribers only
// last48hCount: always returned (for teaser banners)
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
      return Response.json({ last48h: [], thisWeek: [], last48hCount: 0, total: 0 });
    }

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;

    const allJobs = [];
    for (const row of rows) {
      const detectedAt = Number(row.detected_at_ms);

      // filterTime = min(detectedAt, postedDate)
      // Prevents old-posted jobs from appearing as new even if seeded recently
      let filterTime = detectedAt;
      if (row.posted_date) {
        const postedTs = new Date(row.posted_date).getTime();
        if (!isNaN(postedTs)) filterTime = Math.min(detectedAt, postedTs);
      }

      // Only include jobs whose effective age is within 7 days
      if (filterTime < sevenDaysAgo) continue;

      // Display time: use bank's postedDate if available, otherwise detectedAt
      let displayTime = detectedAt;
      if (row.posted_date) {
        const ts = new Date(row.posted_date).getTime();
        if (!isNaN(ts)) displayTime = ts;
      }

      allJobs.push({
        link: row.link,
        title: row.title,
        location: row.location,
        bank: row.bank,
        bankKey: row.bank_key,
        category: row.category,
        postedDate: row.posted_date ? new Date(row.posted_date).toISOString() : null,
        detectedAt,
        filterTime,
        effectiveTime: displayTime,
        hasActualDate: !!row.posted_date,
      });
    }

    // Sort by filterTime (newest first)
    allJobs.sort((a, b) => b.filterTime - a.filterTime);

    const last48h = allJobs.filter((j) => j.filterTime >= fortyEightHoursAgo);
    const thisWeek = allJobs.filter((j) => j.filterTime < fortyEightHoursAgo);

    return Response.json({
      last48h: isSubscribed ? last48h : [],
      thisWeek: isSubscribed ? thisWeek : [],
      last48hCount: last48h.length,
      total: allJobs.length,
    });
  } catch (err) {
    console.error("jobs-new error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
