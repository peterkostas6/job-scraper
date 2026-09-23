// POST /api/webhook/twilio — receives Twilio delivery status callbacks and inbound texts.
// Every event lands in notification_log so carrier blocks and STOP replies are visible.
// On inbound STOP-family keywords, turns off SMS for the matching user so the site
// reflects reality (Twilio already blocks further sends to that number regardless).
// HELP replies are answered by Twilio itself (Messaging Service → Opt-Out Management).
import crypto from "crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { logNotification } from "@/lib/notif-send";

export const dynamic = "force-dynamic";

const STOP_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"]);

// Twilio signs each request: HMAC-SHA1 of the URL plus every param (sorted by name), keyed
// with the auth token. Rejects anything that did not come from Twilio.
function isFromTwilio(request, params) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = request.headers.get("x-twilio-signature");
  if (!authToken || !signature) return false;
  const data = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], request.url);
  const expected = crypto.createHmac("sha1", authToken).update(data).digest("base64");
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function findUserByPhone(client, phone) {
  let offset = 0;
  while (true) {
    const { data } = await client.users.getUserList({ limit: 100, offset });
    const match = data.find((u) => u.unsafeMetadata?.notifications?.phoneNumber === phone);
    if (match) return match;
    if (data.length < 100) return null;
    offset += 100;
  }
}

// Twilio expects TwiML back; an empty <Response/> means "no reply".
const emptyTwiml = () => new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });

export async function POST(request) {
  const params = Object.fromEntries(new URLSearchParams(await request.text()));
  if (!isFromTwilio(request, params)) {
    console.error("Twilio webhook: bad signature for", request.url);
    return new Response("Forbidden", { status: 403 });
  }

  const inbound = !params.MessageStatus;
  await logNotification({
    channel: inbound ? "sms-inbound" : "sms-delivery",
    status: inbound ? (params.Body || "").trim().slice(0, 40) : params.MessageStatus,
    recipient: inbound ? params.From || null : params.To || null,
    error: params.ErrorCode ? `${params.ErrorCode} ${params.ErrorMessage || ""}`.trim() : null,
    providerId: params.MessageSid || null,
  });

  const text = (params.Body || "").trim().toUpperCase();
  if (inbound && params.From && (params.OptOutType === "STOP" || STOP_KEYWORDS.has(text))) {
    try {
      const client = await clerkClient();
      const user = await findUserByPhone(client, params.From);
      if (user) {
        const notifications = user.unsafeMetadata?.notifications || {};
        await client.users.updateUser(user.id, {
          unsafeMetadata: {
            ...user.unsafeMetadata,
            notifications: { ...notifications, smsEnabled: false, smsOptOutAt: new Date().toISOString() },
          },
        });
      }
    } catch (err) {
      console.error("Twilio inbound webhook error:", err?.message || err);
    }
  }

  return emptyTwiml();
}
