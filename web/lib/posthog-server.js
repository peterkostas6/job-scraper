// Server-side PostHog events (alerts sent, text-link clicks, payments): things the browser
// never sees. Uses the public project key and PostHog's capture endpoint, no extra package.
// Always awaited by callers (Vercel freezes the function after the response), but capped
// at 1.5s and never throws, so tracking can't slow down or break the real work.
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

export async function captureServer(distinctId, event, properties = {}) {
  if (!KEY || !distinctId) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    await fetch("https://us.i.posthog.com/i/v0/e/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: KEY, event, distinct_id: distinctId, properties: { ...properties, $lib: "server" } }),
      signal: controller.signal,
    });
  } catch {} finally {
    clearTimeout(timer);
  }
}

// The visitor's PostHog id from its browser cookie, so a server event (like a job-link
// click) joins the same person's timeline even before they sign in.
export function distinctIdFromRequest(request) {
  try {
    const cookie = request.headers.get("cookie") || "";
    const raw = cookie.split(/;\s*/).find((c) => c.startsWith(`ph_${KEY}_posthog=`));
    return raw ? JSON.parse(decodeURIComponent(raw.split("=").slice(1).join("="))).distinct_id || null : null;
  } catch {
    return null;
  }
}
