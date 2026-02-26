// POST /api/admin/migrate-jobs — one-time migration of Redis job-first-seen → Postgres jobs table
// Protected by CRON_SECRET. Safe to call multiple times (ON CONFLICT DO NOTHING).
import { Redis } from "@upstash/redis";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    const allEntries = await redis.hgetall("job-first-seen");

    if (!allEntries || Object.keys(allEntries).length === 0) {
      return Response.json({ migrated: 0, message: "No Redis data to migrate" });
    }

    let migrated = 0;
    let skipped = 0;

    for (const [link, raw] of Object.entries(allEntries)) {
      try {
        const data = typeof raw === "string" ? JSON.parse(raw) : raw;

        await sql`
          INSERT INTO jobs (link, title, bank, bank_key, location, category, posted_date, detected_at)
          VALUES (
            ${link},
            ${data.title || ''},
            ${data.bank || ''},
            ${data.bankKey || ''},
            ${data.location || ''},
            ${data.category || ''},
            ${data.postedDate ? new Date(data.postedDate) : null},
            ${new Date(data.detectedAt || Date.now())}
          )
          ON CONFLICT (link) DO NOTHING
        `;
        migrated++;
      } catch {
        skipped++;
      }
    }

    return Response.json({ ok: true, migrated, skipped });
  } catch (err) {
    console.error("migrate-jobs error:", err);
    return Response.json({ error: "Migration failed", details: err.message }, { status: 500 });
  }
}
