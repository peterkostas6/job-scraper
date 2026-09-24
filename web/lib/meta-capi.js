// Meta Conversions API: server-side copies of the pixel's key events, plus payments the
// browser never sees (a trial converting to paid, renewals). Events sent from both places
// share an event_id so Meta counts them once. Never throws: tracking must not break a
// webhook or checkout.
import crypto from "crypto";
import { META_PIXEL_ID } from "@/lib/meta-pixel";

const hash = (v) => crypto.createHash("sha256").update(String(v).trim().toLowerCase()).digest("hex");

export async function sendMetaServerEvent({ eventName, eventId, email, externalId, value, sourceUrl, ip, userAgent, fbp, fbc }) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return;

  const user_data = {};
  if (email) user_data.em = [hash(email)];
  if (externalId) user_data.external_id = [hash(externalId)];
  if (ip) user_data.client_ip_address = ip;
  if (userAgent) user_data.client_user_agent = userAgent;
  if (fbp) user_data.fbp = fbp;
  if (fbc) user_data.fbc = fbc;

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: "website",
    event_source_url: sourceUrl || "https://petespostings.com",
    user_data,
    ...(value != null && { custom_data: { value, currency: "USD" } }),
  };
  // Set META_TEST_EVENT_CODE (Events Manager → Test events) to watch server events arrive.
  const body = { data: [event], ...(process.env.META_TEST_EVENT_CODE && { test_event_code: process.env.META_TEST_EVENT_CODE }) };

  try {
    const res = await fetch(`https://graph.facebook.com/v23.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error(`Meta CAPI ${eventName} failed:`, res.status, await res.text());
  } catch (err) {
    console.error(`Meta CAPI ${eventName} failed:`, err?.message || err);
  }
}
