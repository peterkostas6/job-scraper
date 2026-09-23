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

    // is_live = the bank still lists it. link_dead = the posting page itself is gone.
    // Two columns because two different checks write them, and they must not fight.
    await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT true`;
    await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS link_dead BOOLEAN NOT NULL DEFAULT false`;
    await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`;
    await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jobs_is_live ON jobs(is_live)`;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_jobs_live_bank ON jobs(bank_key) WHERE is_live AND NOT link_dead
    `;

    // Per-bank health from the last cron run: which scrapers fail, and when each last worked.
    await sql`
      CREATE TABLE IF NOT EXISTS bank_status (
        bank_key TEXT PRIMARY KEY,
        last_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_success_at TIMESTAMPTZ,
        last_error TEXT,
        live_count INT NOT NULL DEFAULT 0
      )
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

    // Short links in alert texts (petespostings.com/j/<code>). One code per user + job,
    // so clicks show how many people opened each job.
    await sql`
      CREATE TABLE IF NOT EXISTS short_links (
        code TEXT PRIMARY KEY,
        link TEXT NOT NULL,
        user_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        clicks INT NOT NULL DEFAULT 0,
        first_clicked_at TIMESTAMPTZ,
        last_clicked_at TIMESTAMPTZ
      )
    `;

    return Response.json({ ok: true, message: "notification_queue, jobs, notification_log, bank_status, and short_links tables ready" });
  } catch (err) {
    console.error("init-db error:", err);
    return Response.json({ error: "DB init failed", details: err.message }, { status: 500 });
  }
}
