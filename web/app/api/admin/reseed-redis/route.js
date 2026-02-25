// POST /api/admin/reseed-redis — re-populates job-first-seen from live bank APIs
// Only adds jobs with a postedDate within the last 7 days (skips undated GS/Citi jobs)
// Rebuilds seen-job-links with all current jobs so cron can detect future new ones
// Protected by CRON_SECRET. Run after a Redis wipe to restore new-postings data.
import { Redis } from "@upstash/redis";

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
  ubs: "/api/jobs-ubs",
};

const BANK_NAMES = {
  jpmc: "JPMorgan Chase",
  gs: "Goldman Sachs",
  ms: "Morgan Stanley",
  bofa: "Bank of America",
  citi: "Citi",
  db: "Deutsche Bank",
  barclays: "Barclays",
  ubs: "UBS",
};

export async function POST(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://petespostings.com";
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Fetch all banks in parallel
  const bankEntries = Object.entries(BANK_ENDPOINTS);
  const results = await Promise.allSettled(
    bankEntries.map(async ([bankKey, endpoint]) => {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        headers: { "User-Agent": "PetesPostings-Admin/1.0" },
      });
      if (!res.ok) throw new Error(`${bankKey}: ${res.status}`);
      const data = await res.json();
      return { bankKey, jobs: data.jobs || [] };
    })
  );

  const allCurrentLinks = [];
  const toSeed = {};
  let skippedNoDate = 0;
  let skippedTooOld = 0;

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { bankKey, jobs } = result.value;

    for (const job of jobs) {
      if (!job.link) continue;
      allCurrentLinks.push(job.link);

      // Skip jobs with no postedDate — can't determine if they're recent
      if (!job.postedDate) {
        skippedNoDate++;
        continue;
      }

      const postedTs = new Date(job.postedDate).getTime();
      if (isNaN(postedTs)) {
        skippedNoDate++;
        continue;
      }

      // Skip jobs posted more than 7 days ago
      if (postedTs < sevenDaysAgo) {
        skippedTooOld++;
        continue;
      }

      toSeed[job.link] = JSON.stringify({
        title: job.title,
        location: job.location || "",
        bank: BANK_NAMES[bankKey],
        bankKey,
        category: job.category || "",
        postedDate: job.postedDate,
        detectedAt: Math.min(now, postedTs),
      });
    }
  }

  // Write job-first-seen entries in batches of 100
  const seedPairs = Object.entries(toSeed);
  if (seedPairs.length > 0) {
    for (let i = 0; i < seedPairs.length; i += 100) {
      const batch = Object.fromEntries(seedPairs.slice(i, i + 100));
      await redis.hset("job-first-seen", batch);
    }
  }

  // Rebuild seen-job-links with all current jobs
  if (allCurrentLinks.length > 0) {
    await redis.del("seen-job-links");
    for (let i = 0; i < allCurrentLinks.length; i += 100) {
      const batch = allCurrentLinks.slice(i, i + 100);
      await redis.sadd("seen-job-links", ...batch);
    }
  }

  return Response.json({
    message: "Done",
    seeded: seedPairs.length,
    skippedNoDate,
    skippedTooOld,
    seenLinksRebuilt: allCurrentLinks.length,
  });
}
