// GET /api/jobs-live — every job the cron currently sees as live, across all banks.
// The browse page reads this one route instead of scraping each bank on every load.
// The cron refreshes the table every 5 minutes; the CDN may serve this for up to a minute.
import { sql } from "@vercel/postgres";
import { decodeEntities } from "@/lib/text";
import { isGraduateProgram, isMbaOrSenior, isBankingEntryLevel, isFinanceRole } from "@/lib/notif-helpers";
import { BANKS, BANK_NAMES } from "@/lib/banks";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

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

    // Rows saved before the cron dropped Associate/VP roles are closed on its next run;
    // filtering here too keeps them off the site in the meantime (and on preview builds,
    // where the cron never runs).
    const jobs = rows.filter((row) => !isMbaOrSenior(row.title)).map((row) => ({
      link: row.link,
      title: decodeEntities(row.title),
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
    console.error("jobs-live error, falling back to live scrape:", err);
    try {
      return await scrapeFallback();
    } catch (fallbackErr) {
      console.error("jobs-live fallback error:", fallbackErr);
      return Response.json({ error: err.message }, { status: 500 });
    }
  }
}

// If Postgres is down (e.g. the plan's quota is used up), scrape every bank directly with the
// same filters the cron applies, so the browse page still shows jobs. Cached longer to spare the banks.
async function scrapeFallback() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://petespostings.com";
  const entries = Object.entries(BANKS);
  const results = await Promise.allSettled(
    entries.map(async ([bankKey, bank]) => {
      const res = await fetch(`${baseUrl}${bank.endpoint}`, { headers: { "User-Agent": "PetesPostings-Fallback/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { bankKey, jobs: data.jobs || [] };
    })
  );

  const now = Date.now();
  const seen = new Set();
  const jobs = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { bankKey, jobs: bankJobs } = result.value;
    for (const job of bankJobs) {
      if (!job.link || seen.has(job.link)) continue;
      if (isGraduateProgram(job.title) || isMbaOrSenior(job.title)) continue;
      if (!isBankingEntryLevel(job.title) || !isFinanceRole(job.title)) continue;
      seen.add(job.link);
      jobs.push({
        link: job.link,
        title: decodeEntities(job.title),
        location: job.location,
        bank: BANK_NAMES[bankKey],
        bankKey,
        category: job.category,
        postedDate: job.postedDate ? new Date(job.postedDate).toISOString() : null,
        detectedAt: now,
      });
    }
  }
  if (jobs.length === 0) throw new Error("fallback scrape returned no jobs");
  jobs.sort((a, b) => (b.postedDate || "").localeCompare(a.postedDate || ""));

  return Response.json(
    { jobs, count: jobs.length, updatedAt: now },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
