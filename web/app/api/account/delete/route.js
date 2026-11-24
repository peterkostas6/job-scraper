// POST /api/account/delete — the signed-in person deletes their own account ("Delete account" in
// the iPhone app's account menu; Apple requires it). Clerk then sends user.deleted to
// /api/webhook/clerk, which cancels any website (Stripe) subscription.
import { auth, clerkClient } from "@clerk/nextjs/server";
import { captureServer } from "@/lib/posthog-server";

export const dynamic = "force-dynamic";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in first" }, { status: 401 });
  try {
    const clerk = await clerkClient();
    await captureServer(userId, "account_deleted", { from: "app" });
    await clerk.users.deleteUser(userId);
    return Response.json({ deleted: true });
  } catch (err) {
    console.error("account delete:", err?.message || err);
    return Response.json({ error: "Couldn't delete the account" }, { status: 500 });
  }
}
