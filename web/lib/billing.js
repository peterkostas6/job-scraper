import { isApp } from "@/lib/app-access";

// Apple's own subscription settings (cancel, see renewal date). On an iPhone this link opens
// Settings > Subscriptions; the app hands any non-site link to iOS.
const APPLE_SUBSCRIPTIONS = "https://apps.apple.com/account/subscriptions";

// Show "Manage subscription" to anyone paying through Stripe (website) or Apple (iPhone app).
export const canManageSubscription = (user) => Boolean(user?.publicMetadata?.stripeCustomerId || user?.publicMetadata?.appStoreActive);

// Sends a subscriber to wherever they pay: Apple's settings for App Store subscriptions, Stripe's
// billing page for website ones. Inside the app a website subscriber is told to manage it on the
// website instead, since Apple doesn't allow links to outside payment pages in the app.
export async function openBillingPortal() {
  const meta = (typeof window !== "undefined" && window.Clerk?.user?.publicMetadata) || {};
  if (meta.appStoreActive && !meta.stripeCustomerId) {
    if (isApp()) window.location.href = APPLE_SUBSCRIPTIONS;
    else alert("You subscribed in the iPhone app. To manage it, open Settings on your iPhone, tap your name, then Subscriptions.");
    return;
  }
  if (isApp()) {
    alert("You subscribed on petespostings.com. Manage your subscription there from a web browser.");
    return;
  }
  try {
    const res = await fetch("/api/billing-portal", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (data.url) { window.location.href = data.url; return; }
    alert(data.error || "Couldn't open billing. Email pete@petespostings.com to manage your subscription.");
  } catch {
    alert("Couldn't open billing. Email pete@petespostings.com to manage your subscription.");
  }
}

// Permanently deletes the signed-in account (Apple requires this inside the app). A website
// subscription is cancelled by the Clerk user.deleted webhook; Apple billing can only be
// cancelled by the person in their iPhone settings, so they are told and offered the link.
export async function deleteAccount(clerk) {
  const meta = clerk?.user?.publicMetadata || {};
  const apple = meta.appStoreActive === true;
  const ok = window.confirm(
    "Delete your Pete's Postings account? Your saved jobs, alert settings and account are removed for good." +
    (apple ? "\n\nYour subscription is billed by Apple: cancel it in Settings > your name > Subscriptions, or Apple keeps charging." : meta.stripeCustomerId ? "\n\nYour Premium subscription will be cancelled." : "")
  );
  if (!ok) return;
  const res = await fetch("/api/account/delete", { method: "POST" }).catch(() => null);
  if (!res?.ok) { alert("Couldn't delete your account. Email pete@petespostings.com and we'll do it for you."); return; }
  try { localStorage.clear(); sessionStorage.clear(); } catch {}
  await clerk.signOut().catch(() => {});
  if (apple && isApp() && window.confirm("Account deleted. Open your Apple subscriptions now to cancel billing?")) {
    window.location.href = APPLE_SUBSCRIPTIONS;
    return;
  }
  window.location.href = isApp() ? "/onboarding" : "/";
}
