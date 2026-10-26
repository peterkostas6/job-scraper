// POST /api/checkout — creates a Stripe Checkout session for the subscription
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  // One plan. The /start quiz asks to come back to itself so it can finish turning on texts.
  const plan = "monthly";
  let returnTo = "";
  try {
    const body = await req.json();
    if (body.returnTo === "/start") returnTo = body.returnTo;
  } catch {}

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return Response.json({ error: "That plan isn't available right now." }, { status: 500 });
  }

  // Get the user's email from Clerk
  const user = await (await clerkClient()).users.getUser(userId);
  const email = user.emailAddresses[0]?.emailAddress;

  // Meta browser identifiers and plan, stored on the session and subscription so the
  // Stripe webhook can report payments to the ad platforms' Conversions APIs.
  const meta = {
    plan,
    fbp: req.cookies?.get("_fbp")?.value || "",
    fbc: req.cookies?.get("_fbc")?.value || "",
    ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim(),
    ua: (req.headers.get("user-agent") || "").slice(0, 400),
  };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://petespostings.com";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    // Apple Pay and Google Pay appear here as card wallets when they are on in the Stripe dashboard.
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    // Every plan is charged at checkout; there is no free trial.
    subscription_data: {
      // clerkUserId lets renewals and cancellations be tied back to the account.
      metadata: { ...meta, clerkUserId: userId },
    },
    metadata: {
      clerkUserId: userId,
      ...meta,
    },
    success_url: returnTo
      ? `${siteUrl}${returnTo}?paid=true&session_id={CHECKOUT_SESSION_ID}`
      : `${siteUrl}?subscribed=true&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}${returnTo}`,
  });

  return Response.json({ url: session.url });
}
