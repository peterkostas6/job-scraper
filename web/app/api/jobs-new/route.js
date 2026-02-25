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
        // @upstash/redis auto-deserializes JSON values, so raw may already be an object
        const data = typeof raw === "string" ? JSON.parse(raw) : raw;
        const detectedAt = data.detectedAt || 0;

        // filterTime = the earlier of detectedAt and postedDate.
        // If a job was seeded with detectedAt=now but postedDate=5 days ago,
        // filterTime becomes 5 days ago and it won't appear in Last 48 Hours.
        let filterTime = detectedAt;
        if (data.postedDate) {
          const postedTs = new Date(data.postedDate).getTime();
          if (!isNaN(postedTs)) filterTime = Math.min(detectedAt, postedTs);
        }

        // Only include jobs whose effective age is within 7 days
        if (filterTime < sevenDaysAgo) continue;

        // Display time: use bank's postedDate if available, otherwise detectedAt
        let displayTime = detectedAt;
        if (data.postedDate) {
          const ts = new Date(data.postedDate).getTime();
          if (!isNaN(ts)) displayTime = ts;
        }

        allJobs.push({
          link,
          title: data.title,
          location: data.location,
          bank: data.bank,
          bankKey: data.bankKey,
          category: data.category,
          postedDate: data.postedDate || null,
          detectedAt,
          filterTime,
          effectiveTime: displayTime,
          hasActualDate: !!data.postedDate,
        });
      } catch {
        // Skip malformed entries
      }
    }

    // Sort by filterTime (newest first)
    allJobs.sort((a, b) => b.filterTime - a.filterTime);

    // Use filterTime for section placement — min(detectedAt, postedDate).
    // This prevents old-posted jobs from appearing as new even if seeded recently.
    const last48h = allJobs.filter((j) => j.filterTime >= fortyEightHoursAgo);
    const thisWeek = allJobs.filter((j) => j.filterTime < fortyEightHoursAgo);

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
