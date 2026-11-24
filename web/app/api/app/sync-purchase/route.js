// POST /api/app/sync-purchase — the iPhone app calls this after a purchase, a restore, or signing
// in, once the purchase is attached to the account in RevenueCat. Records it on the account.
import { auth } from "@clerk/nextjs/server";
import { syncAppStoreAccess } from "@/lib/app-store";

export const dynamic = "force-dynamic";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in first" }, { status: 401 });
  try {
    return Response.json({ subscribed: await syncAppStoreAccess(userId) });
  } catch (err) {
    console.error("sync-purchase:", err?.message || err);
    return Response.json({ error: "Couldn't check your purchase" }, { status: 502 });
  }
}
