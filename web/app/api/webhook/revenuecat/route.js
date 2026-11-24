// POST /api/webhook/revenuecat — RevenueCat calls this when an App Store subscription starts,
// renews, is cancelled, expires or fails to bill. We don't trust the event's details: we look up
// the account's current status from RevenueCat (lib/app-store.js) and record that.
//   REVENUECAT_WEBHOOK_AUTH  the Authorization header value set on the webhook in RevenueCat
import { syncAppStoreAccess } from "@/lib/app-store";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!process.env.REVENUECAT_WEBHOOK_AUTH || req.headers.get("authorization") !== process.env.REVENUECAT_WEBHOOK_AUTH) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { event } = await req.json().catch(() => ({}));
  // The app logs in with the Clerk user id ("user_..."); purchases made before signing in carry
  // RevenueCat's anonymous id until then, and are recorded when the app syncs after sign-in.
  const ids = [event?.app_user_id, event?.original_app_user_id, ...(event?.aliases || []), ...(event?.transferred_to || [])];
  const userIds = [...new Set(ids.filter((id) => typeof id === "string" && id.startsWith("user_")))];
  try {
    for (const id of userIds) await syncAppStoreAccess(id);
  } catch (err) {
    console.error("revenuecat webhook:", err?.message || err);
    return Response.json({ error: "sync failed" }, { status: 500 }); // RevenueCat retries
  }
  return Response.json({ received: true, users: userIds.length });
}
