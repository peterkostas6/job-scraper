// POST /api/checkout — creates a Stripe Checkout session for the subscription
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  // Get the user's email from Clerk
  const user = await (await clerkClient()).users.getUser(userId);
  const email = user.emailAddresses[0]?.emailAddress;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1,
      },
    ],
    metadata: {
      clerkUserId: userId,
    },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://petespostings.com"}?subscribed=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://petespostings.com"}`,
  });

  return Response.json({ url: session.url });
}
