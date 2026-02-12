// POST /api/webhook — Stripe sends payment events here
// When a subscription is created or deleted, we update the user's Clerk metadata
import Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const clerk = await clerkClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const clerkUserId = session.metadata?.clerkUserId;

    if (clerkUserId) {
      await clerk.users.updateUserMetadata(clerkUserId, {
        publicMetadata: {
          subscribed: true,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
        },
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const customerId = subscription.customer;

    // Find the Clerk user by Stripe customer ID
    const users = await clerk.users.getUserList({ limit: 100 });
    const user = users.data.find(
      (u) => u.publicMetadata?.stripeCustomerId === customerId
    );

    if (user) {
      await clerk.users.updateUserMetadata(user.id, {
        publicMetadata: {
          subscribed: false,
          stripeSubscriptionId: null,
        },
      });
    }
  }

  return Response.json({ received: true });
}
