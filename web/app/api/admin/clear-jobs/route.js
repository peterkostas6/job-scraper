// POST /api/admin/clear-jobs — wipes all rows from the jobs table
// Protected by CRON_SECRET. Use to reset stale migration data.
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rowCount } = await sql`DELETE FROM jobs`;
    return Response.json({ ok: true, deleted: rowCount });
  } catch (err) {
    console.error("clear-jobs error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
