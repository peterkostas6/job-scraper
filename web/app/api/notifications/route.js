import { alertTrial } from "@/lib/alert-trial";
import { saveAlertPrefs } from "@/lib/alert-prefs";
import { auth, clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

// GET — fetch current notification preferences
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const notifications = user.unsafeMetadata?.notifications || {
      enabled: false,
      banks: [],
      categories: [],
      jobType: "all",
    };

    // Free accounts: where their 3 free days of alert links stand (Premium: null).
    const trial = user.publicMetadata?.subscribed === true ? null : alertTrial(user.createdAt);

    // hasPrefs: they have saved preferences at least once (alerts on or off).
    return Response.json({ notifications, trial, hasPrefs: Boolean(user.unsafeMetadata?.notifications) });
  } catch (err) {
    console.error("Notifications GET error:", err);
    return Response.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}

// POST — save notification preferences
export async function POST(request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    // From the iPhone app (its user agent): no confirmation email, the app shows the change itself.
    const quiet = /PetesPostingsApp/.test(request.headers.get("user-agent") || "");
    await saveAlertPrefs({ userId, body, origin: new URL(request.url).origin, quiet });

    return Response.json({ success: true });
  } catch (err) {
    console.error("Notifications POST error:", err);
    return Response.json({ error: "Failed to save preferences" }, { status: 500 });
  }
}
