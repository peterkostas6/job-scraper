// GET /api/jobs-new — returns jobs detected in the last 48 hours from Postgres
// Pro subscribers only. last48hCount always returned for teaser banners.
import { sql } from "@vercel/postgres";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { isAnalystOrIntern } from "@/lib/notif-helpers";
import { BANKS } from "@/lib/banks";
import { trialFor } from "@/lib/alert-trial-days";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const { userId } = await auth();
    let isSubscribed = false;

    if (userId) {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      // Premium, or inside the 3 free days after sign-up (lib/alert-trial-days.js).
      isSubscribed = user.publicMetadata?.subscribed === true || !trialFor(user.createdAt).over;
    }

    // Only fetch jobs that are currently live on the bank's website (is_live = true)
    // The cron updates this flag every 30 mins — expired/removed jobs are filtered out automatically
    const { rows } = await sql`
      SELECT
        link,
        title,
        bank,
        bank_key,
        location,
        category,
        posted_date,
        EXTRACT(EPOCH FROM detected_at)::bigint * 1000 AS detected_at_ms
      FROM jobs
      WHERE COALESCE(posted_date, detected_at) > NOW() - INTERVAL '48 hours'
        AND is_live = true AND NOT link_dead
      ORDER BY COALESCE(posted_date, detected_at) DESC, detected_at DESC
    `;

    if (rows.length === 0) {
      return Response.json({ last48h: [], last48hCount: 0, total: 0 });
    }

    const now = Date.now();
    const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;

    const jobs = [];
    for (const row of rows) {
      const detectedAt = Number(row.detected_at_ms);
      const postedAt = row.posted_date ? new Date(row.posted_date).getTime() : null;
      // The real posted date (when we have one) is the authoritative signal for freshness.
      // detected_at is only a proxy — it's "when our cron first saw it," which is normally
      // within minutes of posting but can drift if detection was ever delayed. Fall back to
      // detected_at only for the banks whose scraper can't supply a posted date.
      const effectiveAt = postedAt != null ? postedAt : detectedAt;

      // Show job if it was actually posted (or, lacking that, detected) within 48 hours
      if (effectiveAt < fortyEightHoursAgo) continue;

      // Same roles as /api/jobs-live, so the 48-hour count matches Browse and the homepage.
      if (!isAnalystOrIntern(row.title)) continue;
      // Banks taken off the site (e.g. Manulife) keep their rows; the cron no longer checks them.
      if (row.bank_key && !BANKS[row.bank_key]) continue;

      jobs.push({
        link: row.link,
        title: row.title,
        location: row.location,
        bank: row.bank,
        bankKey: row.bank_key,
        category: row.category,
        postedDate: postedAt != null ? new Date(postedAt).toISOString() : null,
        detectedAt,
        effectiveTime: effectiveAt,
        hasActualDate: postedAt != null,
      });
    }

    // Sort newest first
    jobs.sort((a, b) => b.effectiveTime - a.effectiveTime);

    return Response.json({
      last48h: isSubscribed ? jobs : [],
      last48hCount: jobs.length,
      total: jobs.length,
    });
  } catch (err) {
    console.error("jobs-new error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
