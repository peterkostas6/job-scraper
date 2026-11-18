// POST /api/checkout — creates a Stripe Checkout session for the subscription
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { PLANS } from "@/lib/plans";
import { guestMetadata } from "@/lib/guest-checkout";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  const { userId } = await auth();

  // One plan. The /start page asks to come back to itself so it can finish turning on texts.
  // Without an account, checkout still opens: Stripe collects the email and the account is
  // made right after payment (lib/guest-checkout.js), then /welcome signs them in.
  const plan = "monthly";
  let returnTo = "";
  let body = {};
  try {
    body = await req.json();
    if (body.returnTo === "/start") returnTo = body.returnTo;
  } catch {}
  const guest = !userId;
  const guestEmail = guest && typeof body.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ? body.email.trim() : "";

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return Response.json({ error: "That plan isn't available right now." }, { status: 500 });
  }

  // The trial length is set in Stripe, as metadata trial_days on the price or its product
  // (0 = no trial). Until it is set there, the site's default applies.
  const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
  const fromStripe = parseInt(price.metadata?.trial_days ?? price.product?.metadata?.trial_days, 10);
  const trialDays = Number.isInteger(fromStripe) && fromStripe >= 0 && fromStripe <= 90 ? fromStripe : PLANS.monthly.trialDays;

  // Signed in: the account's email. Guest: what they typed on /start, if anything (Stripe asks otherwise).
  const email = guest ? guestEmail : (await (await clerkClient()).users.getUser(userId)).emailAddresses[0]?.emailAddress;

  // Meta browser identifiers and plan, stored on the session and subscription so the
  // Stripe webhook can report payments to the ad platforms' Conversions APIs.
  const meta = {
    plan,
    fbp: req.cookies?.get("_fbp")?.value || "",
    fbc: req.cookies?.get("_fbc")?.value || "",
    ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim(),
    ua: (req.headers.get("user-agent") || "").slice(0, 400),
  };

  // Back to the site the visitor came from, so a dev.petespostings.com checkout returns to dev.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    // Apple Pay and Google Pay appear here as card wallets when they are on in the Stripe dashboard.
    payment_method_types: ["card"],
    ...(email && { customer_email: email }),
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    // The card is taken now and charged when the free trial ends, then monthly.
    subscription_data: {
      ...(trialDays > 0 && { trial_period_days: trialDays }),
      // clerkUserId lets renewals and cancellations be tied back to the account.
      metadata: { ...meta, ...(userId && { clerkUserId: userId }) },
    },
    metadata: guest ? { ...meta, ...guestMetadata(body) } : { clerkUserId: userId, ...meta },
    success_url: guest
      ? `${siteUrl}/welcome?session_id={CHECKOUT_SESSION_ID}`
      : returnTo
      ? `${siteUrl}${returnTo}?paid=true&session_id={CHECKOUT_SESSION_ID}`
      : `${siteUrl}?subscribed=true&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}${returnTo}`,
  });

  return Response.json({ url: session.url });
}
