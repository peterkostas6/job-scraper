// POST /api/checkout/claim { sessionId } — called by /welcome after someone pays without an
// account. Makes sure the account exists (lib/guest-checkout.js), then:
//  - account made just now by this checkout: returns a one-time sign-in ticket, so they land
//    signed in without a password;
//  - email matched an account that already existed: no ticket (anyone can type any email into
//    Stripe), they sign in the normal way.
import Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";
import { provisionGuestCheckout } from "@/lib/guest-checkout";

export const dynamic = "force-dynamic";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  let sessionId = "";
  try { sessionId = String((await req.json()).sessionId || ""); } catch {}
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return Response.json({ error: "Bad session" }, { status: 400 });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.guest !== "1") return Response.json({ error: "Not a guest checkout" }, { status: 400 });
    if (session.status !== "complete") return Response.json({ status: "pending" });
    // Tickets only for a fresh checkout.
    if (Date.now() / 1000 - session.created > 24 * 3600) return Response.json({ status: "expired" });

    const done = await provisionGuestCheckout(session, { origin: new URL(req.url).origin });
    if (!done) return Response.json({ status: "pending" });

    const email = session.customer_details?.email || session.customer_email || "";
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(done.userId);
    if (done.isNew && user.privateMetadata?.createdFromCheckout === session.id) {
      const token = await clerk.signInTokens.createSignInToken({ userId: done.userId, expiresInSeconds: 600 });
      return Response.json({ status: "ready", ticket: token.token, next: done.next, email });
    }
    return Response.json({ status: "existing", next: done.next, email });
  } catch (err) {
    console.error("Checkout claim failed:", err);
    return Response.json({ status: "error" }, { status: 500 });
  }
}
