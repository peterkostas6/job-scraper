// GET /api/admin/bank-status?key=<CRON_SECRET> — per-bank scraper health and job counts.
// Shows which banks errored on the last run, when each last succeeded, and how many of
// its jobs are live, dead, or hidden because the link no longer works.
import { sql } from "@vercel/postgres";
import { BANKS } from "@/lib/banks";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && url.searchParams.get("key") !== cronSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rows: status } = await sql`SELECT * FROM bank_status`;
    const { rows: counts } = await sql`
      SELECT bank_key,
        count(*) FILTER (WHERE is_live AND NOT link_dead)::int AS live,
        count(*) FILTER (WHERE is_live AND link_dead)::int AS listed_but_dead,
        count(*)::int AS total,
        max(detected_at) AS last_new_job
      FROM jobs GROUP BY bank_key
    `;
    const byKey = Object.fromEntries(status.map((s) => [s.bank_key, s]));
    const countsByKey = Object.fromEntries(counts.map((c) => [c.bank_key, c]));

    const banks = Object.keys(BANKS).map((key) => ({
      bank: key,
      name: BANKS[key].name,
      lastRunAt: byKey[key]?.last_run_at || null,
      lastSuccessAt: byKey[key]?.last_success_at || null,
      lastError: byKey[key]?.last_error || null,
      live: countsByKey[key]?.live || 0,
      listedButDead: countsByKey[key]?.listed_but_dead || 0,
      total: countsByKey[key]?.total || 0,
      lastNewJob: countsByKey[key]?.last_new_job || null,
    }));

    return Response.json({ banks });
  } catch (err) {
    console.error("bank-status error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
