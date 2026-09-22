// POST /api/admin/init-db — one-time schema init
// Protected by CRON_SECRET. Call once after deploy.
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS notification_queue (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        job_link TEXT NOT NULL,
        job_title TEXT NOT NULL,
        job_bank TEXT NOT NULL,
        job_location TEXT DEFAULT '',
        job_category TEXT DEFAULT '',
        queued_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_nq_user_id ON notification_queue(user_id)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_nq_queued_at ON notification_queue(queued_at)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS jobs (
        link TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        bank TEXT NOT NULL,
        bank_key TEXT DEFAULT '',
        location TEXT DEFAULT '',
        category TEXT DEFAULT '',
        posted_date TIMESTAMPTZ,
        detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_jobs_detected_at ON jobs(detected_at)
    `;

    // One row per send attempt and per carrier delivery event, so "who got what, and
    // what failed" can be answered from the database instead of scrolling logs.
    await sql`
      CREATE TABLE IF NOT EXISTS notification_log (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        recipient TEXT,
        job_links TEXT[],
        error TEXT,
        provider_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_nl_created_at ON notification_log(created_at)
    `;

    return Response.json({ ok: true, message: "notification_queue, jobs, and notification_log tables ready" });
  } catch (err) {
    console.error("init-db error:", err);
    return Response.json({ error: "DB init failed", details: err.message }, { status: 500 });
  }
}
