// Reddit Conversions API: server-side copies of the pixel's key events, plus payments the
// browser never sees (a trial converting to paid, renewals). Shares conversion IDs with the
// pixel so Reddit counts each once. Never throws: tracking must not break a webhook.
import crypto from "crypto";
import { REDDIT_PIXEL_ID } from "@/lib/reddit-pixel";

const hash = (v) => crypto.createHash("sha256").update(String(v).trim().toLowerCase()).digest("hex");

// eventType is Reddit's name (SignUp, Lead, Purchase). value is in USD.
export async function sendRedditServerEvent({ eventType, conversionId, email, externalId, value, ip, userAgent }) {
  const token = process.env.REDDIT_CAPI_TOKEN;
  if (!token) return;

  const user = {};
  if (email) user.email = hash(email);
  if (externalId) user.external_id = hash(externalId);
  if (ip) user.ip_address = hash(ip);
  if (userAgent) user.user_agent = userAgent;

  const event = {
    event_at: new Date().toISOString(),
    event_type: { tracking_type: eventType },
    user,
    event_metadata: {
      conversion_id: conversionId,
      ...(value != null && { value_decimal: value, currency: "USD" }),
    },
  };

  try {
    const res = await fetch(`https://ads-api.reddit.com/api/v2.0/conversions/events/${REDDIT_PIXEL_ID}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "petespostings/1.0" },
      body: JSON.stringify({ events: [event] }),
    });
    if (!res.ok) console.error(`Reddit CAPI ${eventType} failed:`, res.status, await res.text());
  } catch (err) {
    console.error(`Reddit CAPI ${eventType} failed:`, err?.message || err);
  }
}
