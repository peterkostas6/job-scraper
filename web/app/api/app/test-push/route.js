// POST /api/app/test-push — "Send a test notification" in the app's Alerts panel: one push to the
// signed-in person's phones, so they can see what an alert looks like and that it arrives.
import { auth, clerkClient } from "@clerk/nextjs/server";
import { sendPush, apnsConfigured } from "@/lib/apns";

export const dynamic = "force-dynamic";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in first" }, { status: 401 });
  if (!apnsConfigured()) return Response.json({ error: "Notifications aren't set up on the server yet" }, { status: 503 });
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const tokens = user.unsafeMetadata?.notifications?.pushTokens || [];
  if (!tokens.length) return Response.json({ error: "Turn on notifications first" }, { status: 400 });
  const out = await sendPush(tokens, {
    title: "Goldman Sachs just posted",
    body: "2027 Investment Banking Summer Analyst · New York (test notification)",
    url: "/recent",
  });
  if (!out.sent) return Response.json({ error: "Apple didn't accept the notification", detail: out.errors.join("; ") || "device not registered" }, { status: 502 });
  return Response.json({ sent: out.sent });
}
