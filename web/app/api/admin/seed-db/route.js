// POST /api/admin/seed-db — one-time setup: seeds Postgres with all currently live jobs.
//
// WHY: When the jobs table is empty, the cron would see every live job as "new" and flood
// the Recent tab. This endpoint fetches all live jobs RIGHT NOW and inserts them with
// detected_at = 49 hours ago — meaning they're in the DB (so the cron won't re-add them),
// but they won't appear in the Recent tab (which only shows the last 48 hours).
//
// RUN ONCE after initial deploy or after a database wipe.
// Safe to re-run — uses ON CONFLICT DO NOTHING, so existing rows are never overwritten.
//
// Secured with CRON_SECRET header.
import { sql } from "@vercel/postgres";
import { isGraduateProgram, isBankingEntryLevel } from "@/lib/notif-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BANK_ENDPOINTS = {
  jpmc: "/api/jobs",
  gs: "/api/jobs-gs",
  ms: "/api/jobs-ms",
  bofa: "/api/jobs-bofa",
  citi: "/api/jobs-citi",
  db: "/api/jobs-db",
  barclays: "/api/jobs-barclays",
  wells: "/api/jobs-wells",
  mufg: "/api/jobs-mufg",
  td: "/api/jobs-td",
  mizuho: "/api/jobs-mizuho",
  bmo: "/api/jobs-bmo",
  hl: "/api/jobs-hl",
  guggenheim: "/api/jobs-guggenheim",
  macquarie: "/api/jobs-macquarie",
  piper: "/api/jobs-piper",
  stifel: "/api/jobs-stifel",
};

const BANK_NAMES = {
  jpmc: "JPMorgan Chase",
  gs: "Goldman Sachs",
  ms: "Morgan Stanley",
  bofa: "Bank of America",
  citi: "Citi",
  db: "Deutsche Bank",
  barclays: "Barclays",
  wells: "Wells Fargo",
  mufg: "MUFG",
  td: "TD Securities",
  mizuho: "Mizuho",
  bmo: "BMO",
  hl: "Houlihan Lokey",
  guggenheim: "Guggenheim",
  macquarie: "Macquarie",
  piper: "Piper Sandler",
  stifel: "Stifel",
};

export async function POST(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://petespostings.com";

    // Fetch all banks in parallel
    const bankEntries = Object.entries(BANK_ENDPOINTS);
    const results = await Promise.allSettled(
      bankEntries.map(async ([bankKey, endpoint]) => {
        const res = await fetch(`${baseUrl}${endpoint}`, {
          headers: { "User-Agent": "PetesPostings-Seed/1.0" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { bankKey, jobs: data.jobs || [] };
      })
    );

    const allJobs = [];
    const bankSummary = {};

    for (let i = 0; i < results.length; i++) {
      const bankKey = bankEntries[i][0];
      const result = results[i];
      if (result.status === "fulfilled") {
        const { jobs } = result.value;
        let kept = 0;
        for (const job of jobs) {
          if (isGraduateProgram(job.title)) continue;
          if (!isBankingEntryLevel(job.title)) continue;
          allJobs.push({ ...job, bank: BANK_NAMES[bankKey], bankKey });
          kept++;
        }
        bankSummary[bankKey] = { fetched: jobs.length, kept, error: null };
      } else {
        bankSummary[bankKey] = { fetched: 0, kept: 0, error: result.reason.message };
      }
    }

    // Set detected_at to 49 hours ago — just outside the 48h Recent tab window.
    // These jobs are the "known baseline" — they won't show up as new postings.
    const seedTime = new Date(Date.now() - 49 * 60 * 60 * 1000);

    let inserted = 0;
    let skipped = 0;

    for (const job of allJobs) {
      const result = await sql`
        INSERT INTO jobs (link, title, bank, bank_key, location, category, posted_date, detected_at)
        VALUES (
          ${job.link},
          ${job.title},
          ${job.bank},
          ${job.bankKey || ""},
          ${job.location || ""},
          ${job.category || ""},
          ${job.postedDate ? new Date(job.postedDate) : null},
          ${seedTime}
        )
        ON CONFLICT (link) DO NOTHING
      `;
      if (result.rowCount > 0) inserted++;
      else skipped++;
    }

    return Response.json({
      ok: true,
      message: `Seed complete. ${inserted} new jobs inserted, ${skipped} already existed.`,
      totalFetched: allJobs.length,
      inserted,
      skipped,
      bankSummary,
    });
  } catch (err) {
    console.error("seed-db error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
