// POST /api/admin/fix-redis — corrects job-first-seen detectedAt values
// For entries with postedDate: sets detectedAt = postedDate timestamp
// For entries without postedDate: deletes them (can't determine real age)
// Protected by CRON_SECRET. One-time use to fix initial seeding issue.
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

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

  const allEntries = await redis.hgetall("job-first-seen");
  if (!allEntries || Object.keys(allEntries).length === 0) {
    return Response.json({ message: "job-first-seen is empty", updated: 0, deleted: 0 });
  }

  const toUpdate = {};
  const toDelete = [];

  for (const [link, raw] of Object.entries(allEntries)) {
    try {
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (data.postedDate) {
        const postedTs = new Date(data.postedDate).getTime();
        if (!isNaN(postedTs)) {
          // Use min(existing detectedAt, postedDate) so old jobs age out correctly
          const correctedDetectedAt = Math.min(data.detectedAt || Date.now(), postedTs);
          toUpdate[link] = JSON.stringify({ ...data, detectedAt: correctedDetectedAt });
        }
      } else {
        // No postedDate — we can't verify age, remove from feed
        toDelete.push(link);
      }
    } catch {
      toDelete.push(link);
    }
  }

  // Apply updates in batches of 100
  const updatePairs = Object.entries(toUpdate);
  for (let i = 0; i < updatePairs.length; i += 100) {
    const batch = Object.fromEntries(updatePairs.slice(i, i + 100));
    await redis.hset("job-first-seen", batch);
  }

  // Delete undated entries in batches of 100
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    await redis.hdel("job-first-seen", ...batch);
  }

  return Response.json({
    message: "Done",
    updated: updatePairs.length,
    deleted: toDelete.length,
  });
}
