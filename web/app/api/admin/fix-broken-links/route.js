// POST /api/admin/fix-broken-links — one-time cleanup.
// Checks every job currently in the Recent tab (last 48h, is_live=true),
// verifies the URL actually works, and marks broken ones as is_live=false.
// Safe to re-run. Secured with CRON_SECRET.
import { sql } from "@vercel/postgres";

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
        AND is_live = true
    `;

    if (rows.length === 0) {
      return Response.json({ ok: true, message: "No recent jobs to check.", checked: 0, broken: 0 });
    }

    // Verify each link in parallel (8-second timeout per link)
    const brokenLinks = [];
    await Promise.all(
      rows.map(async (row) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(row.link, {
            method: "GET",
            signal: controller.signal,
            headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
            redirect: "follow",
          });
          clearTimeout(timeoutId);
          if (res.status === 404 || res.status === 410) {
            brokenLinks.push(row.link);
          }
        } catch {
          // Timeout or network error — leave as is_live=true (benefit of the doubt)
        }
      })
    );

    // Mark broken links as not live
    if (brokenLinks.length > 0) {
      await sql`UPDATE jobs SET is_live = false WHERE link = ANY(${brokenLinks})`;
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
