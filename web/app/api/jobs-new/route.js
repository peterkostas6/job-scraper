// GET /api/jobs-new — returns jobs recently detected, with actual posting dates where available
// Last 48h is free for all users. thisWeek is also free.
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Read all stored new-job entries
    const allEntries = await redis.hgetall("job-first-seen");

    if (!allEntries || Object.keys(allEntries).length === 0) {
      return Response.json({ thisWeek: [], last48h: [], total: 0 });
    }

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Parse and filter jobs
    const allJobs = [];
    for (const [link, raw] of Object.entries(allEntries)) {
      try {
        const data = JSON.parse(raw);
        // Determine the effective date: use actual postedDate if available, else detectedAt
        let effectiveTime;
        if (data.postedDate) {
          effectiveTime = new Date(data.postedDate).getTime();
          if (isNaN(effectiveTime)) effectiveTime = data.detectedAt || 0;
        } else {
          effectiveTime = data.detectedAt || 0;
        }

        if (effectiveTime >= sevenDaysAgo) {
          allJobs.push({
            link,
            title: data.title,
            location: data.location,
            bank: data.bank,
            bankKey: data.bankKey,
            category: data.category,
            postedDate: data.postedDate || null,
            detectedAt: data.detectedAt,
            effectiveTime,
            hasActualDate: !!data.postedDate,
          });
        }
      } catch {
        // Skip malformed entries
      }
    }

    // Sort by most recent first
    allJobs.sort((a, b) => b.effectiveTime - a.effectiveTime);

    return Response.json({
      recent: allJobs, // all jobs from past 7 days, sorted most recent first
      total: allJobs.length,
    });
  } catch (err) {
    console.error("jobs-new error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
