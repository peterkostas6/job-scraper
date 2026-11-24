// POST /api/app/push-token { token } — the iPhone app saves this phone's push address after the
// person allows notifications. Turns app alerts on for the account (alerts go out as pushes).
import { auth, clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in first" }, { status: 401 });
  const { token } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || !/^[0-9a-f]{32,200}$/i.test(token)) return Response.json({ error: "Bad token" }, { status: 400 });

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const prefs = user.unsafeMetadata?.notifications || {};
  // Newest first; a few phones at most per account.
  const pushTokens = [token, ...(prefs.pushTokens || []).filter((t) => t !== token)].slice(0, 5);
  await clerk.users.updateUser(userId, {
    unsafeMetadata: { ...user.unsafeMetadata, notifications: { ...prefs, pushEnabled: true, pushTokens } },
  });
  return Response.json({ success: true });
}
