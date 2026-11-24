// Premium bought in the iPhone app (Apple in-app purchase, through RevenueCat). RevenueCat is the
// source of truth: we ask it whether this account's "premium" entitlement is active and copy the
// answer onto the same Clerk flag Stripe uses (publicMetadata.subscribed), so the website, the
// app and the alert crons treat both kinds of subscriber the same.
//   REVENUECAT_SECRET_KEY  RevenueCat secret API key (sk_...), server only
import { clerkClient } from "@clerk/nextjs/server";
import { captureServer } from "@/lib/posthog-server";

const ENTITLEMENT = "premium";

async function appStoreActive(userId) {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${process.env.REVENUECAT_SECRET_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RevenueCat ${res.status}`);
  const { subscriber } = await res.json();
  const ent = subscriber?.entitlements?.[ENTITLEMENT];
  // expires_date null = lifetime; otherwise active until it passes.
  return Boolean(ent && (!ent.expires_date || Date.parse(ent.expires_date) > Date.now()));
}

// Returns the account's new subscribed value.
export async function syncAppStoreAccess(userId) {
  const active = await appStoreActive(userId);
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const meta = user.publicMetadata || {};
  // A website (Stripe) subscription keeps them Premium even when the App Store one lapses.
  const subscribed = active || Boolean(meta.stripeSubscriptionId && meta.subscribed && !meta.appStoreActive);
  if (meta.appStoreActive !== active || meta.subscribed !== subscribed) {
    await clerk.users.updateUserMetadata(userId, { publicMetadata: { appStoreActive: active, subscribed } });
    await captureServer(userId, active ? "app_subscription_active" : "app_subscription_inactive", { $set: { subscribed, app_store: active } });
  }
  return subscribed;
}
