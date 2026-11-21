// GET  /api/job-status — this user's texted / viewed / applied state per job (Alerts page).
// POST /api/job-status { link, applied } — mark or unmark a job as applied.
// POST /api/job-status { link, viewed: true } — they opened it from the Alerts page.
import { auth } from "@clerk/nextjs/server";
import { jobStatuses, markApplied, markViewed } from "@/lib/job-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json({ statuses: await jobStatuses(userId) });
  } catch (err) {
    console.error("job-status GET failed:", err);
    return Response.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function POST(request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const link = typeof body.link === "string" ? body.link : "";
  if (!/^https:\/\//.test(link) || link.length > 2000) return Response.json({ error: "Bad link" }, { status: 400 });
  try {
    if (typeof body.applied === "boolean") await markApplied(userId, link, body.applied);
    if (body.viewed === true) await markViewed(userId, link);
    return Response.json({ success: true });
  } catch (err) {
    console.error("job-status POST failed:", err);
    return Response.json({ error: "Failed to save" }, { status: 500 });
  }
}
