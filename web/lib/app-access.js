// The iPhone app (ios-app/) has a hard paywall: only paying accounts get past onboarding.
// A Premium subscription bought on the website counts too. The website itself never uses this.

export const isApp = () => typeof navigator !== "undefined" && /PetesPostingsApp/.test(navigator.userAgent);

// Until Apple in-app purchase is connected, Subscribe on the dev site and localhost unlocks the
// app on this phone only, so the flow can be tested end to end. Never on petespostings.com.
export const isTestHost = () => {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "dev.petespostings.com" || h.endsWith(".vercel.app");
};
const TEST_KEY = "pp_test_premium";
export const unlockForTesting = () => { try { localStorage.setItem(TEST_KEY, "1"); } catch {} };

export function hasAppAccess(user) {
  if (user?.publicMetadata?.subscribed === true) return true;
  if (!isTestHost()) return false;
  try { return localStorage.getItem(TEST_KEY) === "1"; } catch { return false; }
}

// Pages a locked app user may still open: the onboarding itself and the policies it links to.
export const APP_OPEN_PATHS = ["/onboarding", "/terms", "/privacy"];

// Website-only pages (landing pages, the website sign-up and text-alert setup, pricing): the app
// sends paying users to their jobs instead. Alerts in the app are push notifications, set in the
// Alerts tab.
export const APP_WEB_ONLY_PATHS = ["/", "/start", "/alerts", "/edge", "/welcome", "/pricing", "/about"];
