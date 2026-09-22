// GET /api/jobs-live — every job the cron currently sees as live, across all banks.
// The browse page reads this one route instead of scraping each bank on every load.
// The cron refreshes the table every 5 minutes; the CDN may serve this for up to a minute.
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows } = await sql`
      SELECT link, title, bank, bank_key, location, category, posted_date,
        EXTRACT(EPOCH FROM detected_at)::bigint * 1000 AS detected_at_ms,
        EXTRACT(EPOCH FROM last_seen_at)::bigint * 1000 AS last_seen_at_ms
      FROM jobs
      WHERE is_live AND NOT link_dead
      ORDER BY posted_date DESC NULLS LAST, detected_at DESC
    `;

    const jobs = rows.map((row) => ({
      link: row.link,
      title: row.title,
      location: row.location,
      bank: row.bank,
      bankKey: row.bank_key,
      category: row.category,
      postedDate: row.posted_date ? new Date(row.posted_date).toISOString() : null,
      detectedAt: Number(row.detected_at_ms),
    }));
    const updatedAt = rows.reduce((max, row) => Math.max(max, Number(row.last_seen_at_ms) || 0), 0) || null;

    return Response.json(
      { jobs, count: jobs.length, updatedAt },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=240" } }
    );
  } catch (err) {
    console.error("jobs-live error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
