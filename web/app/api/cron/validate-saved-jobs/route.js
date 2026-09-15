// GET /api/cron/validate-saved-jobs — runs every 30 min, checking every user's saved/bookmarked jobs.
// Saved jobs live in Clerk unsafeMetadata.savedJobs and are never touched by the
// live-scrape crons, so a bookmark can silently rot once the bank pulls the posting.
// Flow: newly-dead links get an `expiredAt` timestamp (flagged, kept, shown as
// "Expired" in the UI); links already flagged for 7+ days get dropped from the list.
import { clerkClient } from "@clerk/nextjs/server";
import { isJobLinkDead } from "@/lib/notif-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REMOVE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await clerkClient();
    const now = Date.now();

    let usersChecked = 0;
    let jobsChecked = 0;
    let newlyFlagged = 0;
    let removed = 0;

    let offset = 0;
    while (true) {
      const userList = await client.users.getUserList({ limit: 100, offset });

      for (const user of userList.data) {
        const savedJobs = user.unsafeMetadata?.savedJobs;
        if (!Array.isArray(savedJobs) || savedJobs.length === 0) continue;

        usersChecked++;
        let changed = false;
        const nextSavedJobs = [];

        for (const job of savedJobs) {
          if (job.expiredAt) {
            // Already flagged — only decide whether it's aged past the removal window.
            if (now - new Date(job.expiredAt).getTime() >= REMOVE_AFTER_MS) {
              changed = true;
              removed++;
              continue; // drop it
            }
            nextSavedJobs.push(job);
            continue;
          }

          jobsChecked++;
          const dead = await isJobLinkDead(job.link);
          if (dead) {
            changed = true;
            newlyFlagged++;
            nextSavedJobs.push({ ...job, expiredAt: new Date(now).toISOString() });
          } else {
            nextSavedJobs.push(job);
          }
        }

        if (changed) {
          await client.users.updateUser(user.id, {
            unsafeMetadata: { ...user.unsafeMetadata, savedJobs: nextSavedJobs },
          });
        }
      }

      if (userList.data.length < 100) break;
      offset += 100;
    }

    return Response.json({
      ok: true,
      usersChecked,
      jobsChecked,
      newlyFlagged,
      removed,
    });
  } catch (err) {
    console.error("validate-saved-jobs error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
