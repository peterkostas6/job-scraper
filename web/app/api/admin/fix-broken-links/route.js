// POST /api/admin/fix-broken-links — one-time cleanup.
// Checks every job currently in the Recent tab (last 48h, is_live=true),
// verifies the URL actually works, and marks broken ones link_dead=true.
// Safe to re-run. Secured with CRON_SECRET.
import { sql } from "@vercel/postgres";
import { isJobLinkDead } from "@/lib/notif-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all jobs currently visible in the Recent tab
    const { rows } = await sql`
      SELECT link FROM jobs
      WHERE detected_at > NOW() - INTERVAL '48 hours'
        AND is_live = true AND NOT link_dead
    `;

    if (rows.length === 0) {
      return Response.json({ ok: true, message: "No recent jobs to check.", checked: 0, broken: 0 });
    }

    // Verify each link in parallel (8-second timeout per link)
    const brokenLinks = [];
    await Promise.all(
      rows.map(async (row) => {
        if (await isJobLinkDead(row.link)) brokenLinks.push(row.link);
      })
    );

    // Mark broken links as not live
    if (brokenLinks.length > 0) {
      await sql`UPDATE jobs SET link_dead = true, last_checked_at = NOW() WHERE link = ANY(${brokenLinks})`;
    }

    return Response.json({
      ok: true,
      message: `Checked ${rows.length} recent jobs. Removed ${brokenLinks.length} broken links from Recent tab.`,
      checked: rows.length,
      broken: brokenLinks.length,
    });
  } catch (err) {
    console.error("fix-broken-links error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
