// POST /api/webhook — Stripe sends payment events here
// When a subscription is created or deleted, we update the user's Clerk metadata
import Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";
import { sendMetaServerEvent } from "@/lib/meta-capi";

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

    // Same event IDs the browser uses on the welcome step, so Meta counts each once.
    const m = session.metadata || {};
    const who = { email: session.customer_details?.email || session.customer_email, externalId: clerkUserId, ip: m.ip, userAgent: m.ua, fbp: m.fbp, fbc: m.fbc };
    if (m.plan === "yearly") {
      await sendMetaServerEvent({ eventName: "Purchase", eventId: `purchase_${session.id}`, value: (session.amount_total || 0) / 100, ...who });
    } else {
      await sendMetaServerEvent({ eventName: "StartTrial", eventId: `trial_${session.id}`, value: 7.99, ...who });
    }
  }

  // A trial turning paid and every renewal. The first invoice of a subscription is
  // skipped: it is $0 for a trial, and yearly's first payment was reported above.
  if (event.type === "invoice.paid") {
    const invoice = event.data.object;
    if (invoice.amount_paid > 0 && invoice.billing_reason !== "subscription_create") {
      // Newer Stripe API versions nest subscription details under invoice.parent.
      const m = invoice.parent?.subscription_details?.metadata || invoice.subscription_details?.metadata || {};
      await sendMetaServerEvent({
        eventName: "Purchase",
        eventId: `purchase_${invoice.id}`,
        value: invoice.amount_paid / 100,
        email: invoice.customer_email,
        ip: m.ip, userAgent: m.ua, fbp: m.fbp, fbc: m.fbc,
      });
    }
  }

  // Trial ended and card was declined / subscription went past_due or unpaid
  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object;
    const status = subscription.status;
    if (status === "past_due" || status === "unpaid" || status === "canceled") {
      const customerId = subscription.customer;
      const users = await clerk.users.getUserList({ limit: 100 });
      const user = users.data.find(
        (u) => u.publicMetadata?.stripeCustomerId === customerId
      );
      if (user) {
        await clerk.users.updateUserMetadata(user.id, {
          publicMetadata: { subscribed: false },
        });
      }
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
