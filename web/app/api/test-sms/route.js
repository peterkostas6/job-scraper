import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { to } = await request.json();

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

  if (!twilioSid || !twilioToken || !twilioFrom) {
    return Response.json({
      error: "Twilio not configured",
      sid: !!twilioSid,
      token: !!twilioToken,
      from: !!twilioFrom,
    });
  }

  const encoded = new URLSearchParams({
    To: to,
    From: twilioFrom,
    Body: "Pete's Postings test message — SMS is working!",
  });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
    },
    body: encoded.toString(),
  });

  const data = await res.json();
  return Response.json({ status: res.status, sid: data.sid, error: data.message || null });
}
