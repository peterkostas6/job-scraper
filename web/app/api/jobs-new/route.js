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
      WHERE detected_at > NOW() - INTERVAL '48 hours'
      ORDER BY detected_at DESC
    `;

    if (rows.length === 0) {
      return Response.json({ last48h: [], thisWeek: [], last48hCount: 0, total: 0 });
    }

    const jobs = rows.map((row) => ({
      link: row.link,
      title: row.title,
      location: row.location,
      bank: row.bank,
      bankKey: row.bank_key,
      category: row.category,
      postedDate: row.posted_date ? new Date(row.posted_date).toISOString() : null,
      detectedAt: Number(row.detected_at_ms),
      hasActualDate: !!row.posted_date,
    }));

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
