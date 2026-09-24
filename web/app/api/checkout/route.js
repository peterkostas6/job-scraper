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

  // Determine which plan the user selected
  let plan = "monthly";
  try {
    const body = await req.json();
    if (body.plan === "yearly") plan = "yearly";
  } catch {}

  const priceId =
    plan === "yearly" && process.env.STRIPE_PRICE_ID_YEARLY
      ? process.env.STRIPE_PRICE_ID_YEARLY
      : process.env.STRIPE_PRICE_ID;

  // Get the user's email from Clerk
  const user = await (await clerkClient()).users.getUser(userId);
  const email = user.emailAddresses[0]?.emailAddress;

  // Meta browser identifiers and plan, stored on the session and subscription so the
  // Stripe webhook can report trials and payments to Meta's Conversions API.
  const meta = {
    plan,
    fbp: req.cookies?.get("_fbp")?.value || "",
    fbc: req.cookies?.get("_fbc")?.value || "",
    ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim(),
    ua: (req.headers.get("user-agent") || "").slice(0, 400),
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    // 14-day free trial on monthly plan only — card required upfront, auto-charges after trial
    subscription_data: {
      metadata: meta,
      ...(plan === "monthly" && { trial_period_days: 14 }),
    },
    metadata: {
      clerkUserId: userId,
      ...meta,
    },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://petespostings.com"}?subscribed=true&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://petespostings.com"}`,
  });

  return Response.json({ url: session.url });
}
