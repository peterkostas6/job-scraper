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

    return Response.json({ ok: true, message: "notification_queue table ready" });
  } catch (err) {
    console.error("init-db error:", err);
    return Response.json({ error: "DB init failed", details: err.message }, { status: 500 });
  }
}
