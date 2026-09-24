// POST /api/billing-portal — opens Stripe's customer portal for the signed-in subscriber,
// where they can cancel, change plan, update their card and download invoices.
import Stripe from "stripe";
import { auth, clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });

  const user = await (await clerkClient()).users.getUser(userId);
  const customer = user.publicMetadata?.stripeCustomerId;
  if (!customer) {
    return Response.json({ error: "No subscription found. Email pete@petespostings.com if you think this is wrong." }, { status: 404 });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = new URL(req.url).origin;
    const session = await stripe.billingPortal.sessions.create({ customer, return_url: `${origin}/jobs` });
    return Response.json({ url: session.url });
  } catch (err) {
    console.error("Billing portal failed:", err?.message || err);
    return Response.json({ error: "Couldn't open billing. Email pete@petespostings.com to manage your subscription." }, { status: 500 });
  }
}
