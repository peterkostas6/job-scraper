// POST /api/admin/migrate-is-live — one-time migration: adds is_live column to jobs table.
// is_live = true means the job link is currently active on the bank's website.
// The cron updates this every 30 mins. The Recent tab only shows is_live = true jobs.
// Safe to re-run. Secured with CRON_SECRET header.
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Add the column — default true so existing jobs remain visible until the next cron run
    await sql`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT true
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_jobs_is_live ON jobs(is_live)
    `;

    const { rows } = await sql`SELECT COUNT(*) AS total FROM jobs`;
    const total = rows[0]?.total || 0;

    return Response.json({
      ok: true,
      message: `Migration complete. is_live column added. ${total} existing jobs set to is_live=true. The cron will clean up dead links within 30 minutes.`,
    });
  } catch (err) {
    console.error("migrate-is-live error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
