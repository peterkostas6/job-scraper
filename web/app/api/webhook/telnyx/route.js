// POST /api/webhook/telnyx — receives Telnyx delivery status callbacks and inbound texts.
// On inbound STOP-family keywords, turns off SMS for the matching user so the site
// reflects reality (Telnyx already blocks further sends to that number regardless).
// On inbound HELP-family keywords, sends back a short help text.
import { clerkClient } from "@clerk/nextjs/server";
import { telnyxConfig, sendSms } from "@/lib/notif-send";

export const dynamic = "force-dynamic";

const STOP_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const HELP_KEYWORDS = new Set(["HELP", "INFO"]);

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

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const event = body?.data;

  if (event?.event_type === "message.received") {
    const from = event.payload?.from?.phone_number;
    const text = (event.payload?.text || "").trim().toUpperCase();

    if (from && (STOP_KEYWORDS.has(text) || HELP_KEYWORDS.has(text))) {
      try {
        const client = await clerkClient();
        const user = await findUserByPhone(client, from);

        if (user) {
          if (STOP_KEYWORDS.has(text)) {
            const notifications = user.unsafeMetadata?.notifications || {};
            await client.users.updateUser(user.id, {
              unsafeMetadata: {
                ...user.unsafeMetadata,
                notifications: { ...notifications, smsEnabled: false, smsOptOutAt: new Date().toISOString() },
              },
            });
          } else {
            const telnyx = telnyxConfig();
            if (telnyx) {
              const helpMsg = "Pete's Postings: For help, email pete@petespostings.com. Reply STOP to unsubscribe. Msg & data rates may apply.";
              sendSms(telnyx, from, helpMsg).catch((e) => console.error("HELP auto-reply failed:", e.message));
            }
          }
        }
      } catch (err) {
        console.error("Telnyx inbound webhook error:", err?.message || err);
      }
    }
  }

  return Response.json({ received: true }, { status: 200 });
}
