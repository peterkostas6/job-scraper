// Pete's own browsers: opening any page with ?internal=on marks this browser as internal,
// so PostHog and the ad pixels ignore it (?internal=off undoes it). Stored per browser.
const KEY = "pp-internal";

export function isInternalBrowser() {
  if (typeof window === "undefined") return false;
  try {
    const flag = new URLSearchParams(window.location.search).get("internal");
    if (flag === "on") localStorage.setItem(KEY, "1");
    if (flag === "off") localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
