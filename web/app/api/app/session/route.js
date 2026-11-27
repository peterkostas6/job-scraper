// POST /api/app/session { rcId } — the iPhone app signs someone in after they subscribe or
// restore, with no account to make. rcId is the RevenueCat app user id on that phone. We ask
// RevenueCat whether it has an active Premium subscription; if so we find the app-only account
// already tied to that purchase (same phone, or another phone restored from the same Apple ID) or
// create one, and return a one-time sign-in token the app trades for a session.
//
// { test: true, rcId: "test:<uuid>" } skips the RevenueCat check on dev and localhost only (the
// "Skip payment" button), never on the live site.
import { clerkClient } from "@clerk/nextjs/server";
import { rcSubscriber, premiumActive } from "@/lib/app-store";
import { APP_ONLY_EMAIL_DOMAIN } from "@/lib/app-user";
import { captureServer } from "@/lib/posthog-server";

export const dynamic = "force-dynamic";

const RC_ID = /^(\$RCAnonymousID:[0-9a-f]{32}|user_[A-Za-z0-9]{10,40})$/;
const TEST_ID = /^test:[0-9a-f-]{36}$/;
// Vercel sets VERCEL_ENV=production on petespostings.com only (dev is "preview", localhost unset).
const testAllowed = () => process.env.VERCEL_ENV !== "production";

async function findUser(clerk, ids) {
  for (const id of ids) {
    if (id.startsWith("user_")) {
      const u = await clerk.users.getUser(id).catch(() => null);
      if (u) return u;
    }
  }
  const external = ids.filter((id) => !id.startsWith("user_"));
  if (!external.length) return null;
  const { data } = await clerk.users.getUserList({ externalId: external, limit: 1 });
  return data?.[0] || null;
}

async function createAppOnlyUser(clerk, externalId) {
  const base = {
    externalId,
    skipPasswordRequirement: true,
    publicMetadata: { appOnly: true },
    // Alerts in the app are push notifications; email stays off (there's no inbox to send to).
    unsafeMetadata: { signedUpInApp: true, notifications: { enabled: false, smsEnabled: false } },
  };
  try {
    return await clerk.users.createUser(base);
  } catch (err) {
    // This Clerk instance requires an email on every account: give it one nothing sends to.
    const short = externalId.replace(/[^a-z0-9]/gi, "").slice(-20).toLowerCase();
    return clerk.users.createUser({ ...base, emailAddress: [`member-${short}@${APP_ONLY_EMAIL_DOMAIN}`] });
  }
}

export async function POST(req) {
  const { rcId, test } = await req.json().catch(() => ({}));
  const isTest = test === true && typeof rcId === "string" && TEST_ID.test(rcId);
  if (isTest ? !testAllowed() : typeof rcId !== "string" || !RC_ID.test(rcId)) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const ids = [rcId];
  if (!isTest) {
    let subscriber;
    try { subscriber = await rcSubscriber(rcId); } catch (err) {
      console.error("app session:", err?.message || err);
      return Response.json({ error: "Couldn't check your subscription. Try again." }, { status: 502 });
    }
    if (!premiumActive(subscriber)) return Response.json({ error: "No active subscription for this Apple ID." }, { status: 402 });
    // Restoring on a new phone: RevenueCat links the new phone's id to the first one it saw for
    // this purchase, which is the id the account was created with.
    if (subscriber?.original_app_user_id && !ids.includes(subscriber.original_app_user_id)) ids.push(subscriber.original_app_user_id);
  }

  try {
    const clerk = await clerkClient();
    let user = await findUser(clerk, ids);
    const created = !user;
    if (!user) user = await createAppOnlyUser(clerk, ids[ids.length - 1]);
    // Premium now, from the purchase we just checked. The app then logs RevenueCat in as this
    // account, after which renewals and cancellations reach it through the webhook.
    if (!isTest && user.publicMetadata?.subscribed !== true) {
      await clerk.users.updateUserMetadata(user.id, { publicMetadata: { appStoreActive: true, subscribed: true } });
    }
    const { token } = await clerk.signInTokens.createSignInToken({ userId: user.id, expiresInSeconds: 600 });
    await captureServer(user.id, created ? "app_member_created" : "app_member_signed_in", { $set: { app_only: true } });
    return Response.json({ token, userId: user.id, created });
  } catch (err) {
    console.error("app session:", err?.errors?.[0]?.longMessage || err?.message || err);
    return Response.json({ error: "Couldn't open your account. Try again." }, { status: 500 });
  }
}
