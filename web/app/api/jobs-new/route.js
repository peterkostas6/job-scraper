// GET /api/jobs-new — returns recent jobs from Redis job-first-seen hash
// last48h: Pro subscribers only
// thisWeek (2-7 days): signed-in free users
// last48hCount: always returned (for teaser banners)
import { Redis } from "@upstash/redis";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    let isSubscribed = false;
    const isSignedIn = !!userId;

    if (userId) {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      isSubscribed = user.publicMetadata?.subscribed === true;
    }

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    const allEntries = await redis.hgetall("job-first-seen");

    if (!allEntries || Object.keys(allEntries).length === 0) {
      return Response.json({ last48h: [], thisWeek: [], last48hCount: 0, total: 0 });
    }

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;

    const allJobs = [];
    for (const [link, raw] of Object.entries(allEntries)) {
      try {
        const data = JSON.parse(raw);
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

    allJobs.sort((a, b) => b.effectiveTime - a.effectiveTime);

    const last48h = allJobs.filter((j) => j.effectiveTime >= fortyEightHoursAgo);
    const thisWeek = allJobs.filter((j) => j.effectiveTime < fortyEightHoursAgo);

    return Response.json({
      last48h: isSubscribed ? last48h : [],       // Pro only
      thisWeek: isSignedIn ? thisWeek : [],        // signed-in (free+) only
      last48hCount: last48h.length,               // always returned for banners/teasers
      total: allJobs.length,
    });
  } catch (err) {
    console.error("jobs-new error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
