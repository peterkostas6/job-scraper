// The iPhone app's native plugins (ios-app/), reached from the site through Capacitor's bridge.
// The site is loaded from the web, so it can't bundle the plugins' JavaScript; it calls the
// native side directly. Every helper is a no-op (or returns null) outside the app.

const plugin = (name) => (typeof window !== "undefined" && window.Capacitor?.isPluginAvailable?.(name) ? window.Capacitor.Plugins[name] : null);

// ---- Apple in-app purchase (RevenueCat) ----
// NEXT_PUBLIC_REVENUECAT_IOS_KEY is RevenueCat's public Apple key (starts "appl_"); safe in the browser.
const RC_KEY = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY || "";
export const ENTITLEMENT = "premium";
let configured = null;

export function purchasesReady() { return Boolean(RC_KEY && plugin("Purchases")); }

// Purchases made before an account exists are tied to this phone; logging in moves them over.
async function purchases(userId) {
  const P = plugin("Purchases");
  if (!P || !RC_KEY) return null;
  if (!configured) configured = P.configure({ apiKey: RC_KEY });
  await configured;
  if (userId) await P.logIn({ appUserID: userId }).catch(() => {});
  return P;
}

const isActive = (info) => Boolean(info?.entitlements?.active?.[ENTITLEMENT]);

// The Premium package from RevenueCat's current offering, with Apple's local price string.
export async function getPremiumPackage(userId) {
  const P = await purchases(userId);
  if (!P) return null;
  const { current } = await P.getOfferings();
  return current?.monthly || current?.availablePackages?.[0] || null;
}

// Opens Apple's purchase sheet. Returns true when Premium is active afterwards; false if cancelled.
export async function buyPremium(pkg, userId) {
  const P = await purchases(userId);
  try {
    const { customerInfo } = await P.purchasePackage({ aPackage: pkg });
    return isActive(customerInfo);
  } catch (err) {
    if (err?.userCancelled || /cancel/i.test(err?.message || "")) return false;
    throw err;
  }
}

export async function restorePremium(userId) {
  const P = await purchases(userId);
  if (!P) return false;
  const { customerInfo } = await P.restorePurchases();
  return isActive(customerInfo);
}

// RevenueCat's id for whoever is on this phone (anonymous until linked to an account).
export async function purchasesAppUserId() {
  const P = await purchases();
  if (!P) return null;
  return (await P.getAppUserID().catch(() => null))?.appUserID || null;
}

// After sign-in: attach this phone's purchase to the account, then have the server record it.
export async function linkPurchaseToAccount(userId) {
  if (!(await purchases(userId))) return null;
  const res = await fetch("/api/app/sync-purchase", { method: "POST" }).catch(() => null);
  return res?.ok ? res.json() : null;
}

// ---- Push notifications ----
// Asks for permission, registers the phone with Apple, and saves its address on the account.
// Resolves true once the address is saved.
export function enablePush() {
  const Push = plugin("PushNotifications");
  if (!Push) return Promise.resolve(false);
  return new Promise(async (resolve) => {
    try {
      const perm = await Push.requestPermissions();
      if (perm.receive !== "granted") return resolve(false);
      const done = (ok) => { okHandle?.remove?.(); errHandle?.remove?.(); resolve(ok); };
      const okHandle = await Push.addListener("registration", async ({ value }) => {
        const res = await fetch("/api/app/push-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: value }) }).catch(() => null);
        done(Boolean(res?.ok));
      });
      const errHandle = await Push.addListener("registrationError", () => done(false));
      await Push.register();
    } catch { resolve(false); }
  });
}

// Whether iOS lets the app send notifications: "granted", "denied", "prompt" (never asked), or null
// outside the app.
export async function pushPermission() {
  const Push = plugin("PushNotifications");
  if (!Push) return null;
  try { return (await Push.checkPermissions()).receive || null; } catch { return null; }
}

// Opens the app's notification settings in iPhone Settings (after someone has said no once, iOS
// never asks again, so this is the only way to turn them on).
export function openAppSettings() {
  return nativeTabs.call("openSettings", {}).catch(() => null);
}

// Tapping a notification opens the role it's about (the push carries a /j/ link).
export function onPushTap(open) {
  const Push = plugin("PushNotifications");
  if (!Push) return () => {};
  const handle = Push.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const url = notification?.data?.url;
    if (url) open(url);
  });
  return () => { Promise.resolve(handle).then((h) => h?.remove?.()); };
}

// ---- Sign in with Apple ----
// Returns Apple's identity token (a signed JWT Clerk can verify), or null if cancelled/unavailable.
export function appleSignInReady() { return Boolean(plugin("SignInWithApple")); }
export async function appleIdentityToken() {
  const A = plugin("SignInWithApple");
  if (!A) return null;
  try {
    // Clerk only accepts Apple tokens that carry a nonce (a fresh random value, against replays).
    const nonce = crypto.randomUUID();
    const { response } = await A.authorize({ clientId: "com.petespostings.app", redirectURI: "https://petespostings.com", scopes: "email name", nonce });
    return response?.identityToken || null;
  } catch { return null; }
}

// ---- Native tab bar (ios-app/ios/App/App/NativeTabs.swift) ----
// Called through Capacitor's bridge directly, so an older app build without the plugin just
// rejects and the site keeps its own tab bar.
const capBridge = () => (typeof window !== "undefined" ? window.Capacitor : null);
export const nativeTabs = {
  call(method, data = {}) {
    const c = capBridge();
    return c?.nativePromise ? c.nativePromise("NativeTabs", method, data) : Promise.reject(new Error("no bridge"));
  },
  // Tab taps from the native bar: cb(index), index in the same order as the site's .tabbar.
  onTap(cb) {
    const c = capBridge();
    if (!c?.nativeCallback) return () => {};
    const id = c.nativeCallback("NativeTabs", "addListener", { eventName: "tabTap" }, (data) => { if (data && typeof data.index === "number") cb(data.index); });
    return () => { c.nativePromise?.("NativeTabs", "removeListener", { eventName: "tabTap", callbackId: id }).catch(() => {}); };
  },
};
