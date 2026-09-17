// One-click unsubscribe from job alerts. Linked from every alert email and from the
// List-Unsubscribe header. No login needed; the link carries a signed token for the user.
// GET shows a confirmation page after turning alerts off; POST (mailbox one-click) returns 200.
import { clerkClient } from "@clerk/nextjs/server";
import { verifyUnsubscribeToken } from "@/lib/email";

export const dynamic = "force-dynamic";

async function disableAlerts(userId) {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const current = user.unsafeMetadata?.notifications || {};
  await client.users.updateUserMetadata(userId, {
    unsafeMetadata: { ...user.unsafeMetadata, notifications: { ...current, enabled: false, smsEnabled: false } },
  });
}

function page(title, body) {
  return new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937}main{max-width:480px;margin:12vh auto;padding:0 24px}h1{font-size:24px;color:#1e293b;margin:0 0 12px}p{font-size:16px;line-height:1.6;margin:0 0 16px}a{color:#2563eb}</style></head>
<body><main><h1>${title}</h1>${body}</main></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function handle(request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("u");
  const token = url.searchParams.get("t");
  if (!verifyUnsubscribeToken(userId, token)) {
    return page("This link is not valid", `<p>The unsubscribe link is missing or has changed. You can turn alerts off from your <a href="https://petespostings.com/notifications">notification settings</a>.</p>`);
  }
  try {
    await disableAlerts(userId);
  } catch (err) {
    console.error("Unsubscribe failed:", err?.message || err);
    return page("Something went wrong", `<p>We could not update your settings. Please try again or turn alerts off from your <a href="https://petespostings.com/notifications">notification settings</a>.</p>`);
  }
  return page("You are unsubscribed from job alerts", `<p>Email and text alerts are off. Your account and saved jobs are unchanged.</p><p>Changed your mind? <a href="https://petespostings.com/notifications">Turn alerts back on</a>.</p>`);
}

export async function GET(request) { return handle(request); }
export async function POST(request) {
  const res = await handle(request);
  // Mailbox providers only need a 200 for one-click unsubscribe.
  return new Response(null, { status: res.status === 200 ? 200 : 400 });
}
