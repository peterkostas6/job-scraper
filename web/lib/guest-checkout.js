// Checkout before an account: someone can pay on Stripe first, and the account is made
// afterward from the email Stripe collected. Both the Stripe webhook and the page they come
// back to (/welcome) call provisionGuestCheckout; a row in checkout_claims makes sure only
// one of them does the work, so nobody gets two accounts or two welcome texts.
import Stripe from "stripe";
import { sql } from "@vercel/postgres";
import { clerkClient } from "@clerk/nextjs/server";
import { saveAlertPrefs } from "@/lib/alert-prefs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Where someone lands after paying, chosen by the page that sent them to Stripe.
const NEXT_PAGES = new Set(["/recent", "/notifications?welcome=1"]);

// Stripe metadata values hold up to 500 characters, so the picks are stored one per key.
export function guestMetadata(body) {
  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => x.slice(0, 40)) : []);
  const prefs = body.prefs && typeof body.prefs === "object" ? body.prefs : null;
  return {
    guest: "1",
    next: NEXT_PAGES.has(body.next) ? body.next : "/recent",
    ...(prefs && {
      p_banks: list(prefs.banks).join(",").slice(0, 490),
      p_cats: list(prefs.categories).join("|").slice(0, 490),
      p_type: ["all", "internship", "fulltime"].includes(prefs.jobType) ? prefs.jobType : "all",
      p_city: typeof prefs.location === "string" ? prefs.location.slice(0, 60) : "",
      p_phone: typeof body.phone === "string" ? body.phone.replace(/\D/g, "").slice(0, 15) : "",
      p_sms: body.smsConsent === true ? "1" : "",
      p_email: body.wantsEmail === false ? "" : "1",
    }),
  };
}

function prefsFromMetadata(m) {
  if (!("p_type" in m)) return null;
  const phone = m.p_phone || "";
  const sms = m.p_sms === "1" && phone.length >= 10;
  return {
    enabled: m.p_email === "1",
    banks: m.p_banks ? m.p_banks.split(",") : [],
    categories: m.p_cats ? m.p_cats.split("|") : [],
    jobType: m.p_type || "all",
    location: m.p_city || "",
    smsEnabled: sms,
    smsConsent: sms,
    phoneNumber: sms ? phone : "",
  };
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS checkout_claims (
      session_id TEXT PRIMARY KEY,
      user_id TEXT,
      is_new BOOLEAN,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

// Returns { userId, isNew, next } once the account exists, or null if this session isn't a
// completed guest checkout. Safe to call any number of times, from anywhere.
export async function provisionGuestCheckout(sessionOrId, { origin } = {}) {
  const session = typeof sessionOrId === "string" ? await stripe.checkout.sessions.retrieve(sessionOrId) : sessionOrId;
  const m = session.metadata || {};
  if (m.guest !== "1" || session.status !== "complete" || session.mode !== "subscription") return null;
  const next = NEXT_PAGES.has(m.next) ? m.next : "/recent";

  await ensureTable();
  const { rows: won } = await sql`INSERT INTO checkout_claims (session_id) VALUES (${session.id}) ON CONFLICT DO NOTHING RETURNING session_id`;
  if (won.length === 0) {
    // Someone else is (or was) doing it; wait briefly for their result.
    for (let i = 0; i < 20; i++) {
      const { rows } = await sql`SELECT user_id, is_new FROM checkout_claims WHERE session_id = ${session.id}`;
      if (rows[0]?.user_id) return { userId: rows[0].user_id, isNew: rows[0].is_new, next };
      if (!rows[0]) break; // the other attempt failed and gave the claim back
      await new Promise((r) => setTimeout(r, 500));
    }
    return null;
  }

  try {
    const email = (session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
    if (!email) throw new Error("checkout has no email");
    const clerk = await clerkClient();

    // Same email as an existing account: attach Pro to it (no automatic sign-in for those).
    const found = await clerk.users.getUserList({ emailAddress: [email], limit: 1 });
    let user = found.data[0];
    let isNew = false;
    if (!user) {
      try {
        user = await clerk.users.createUser({ emailAddress: [email], skipPasswordRequirement: true, privateMetadata: { createdFromCheckout: session.id } });
        isNew = true;
      } catch (err) {
        const again = await clerk.users.getUserList({ emailAddress: [email], limit: 1 });
        user = again.data[0];
        if (!user) throw err;
      }
    }

    await clerk.users.updateUserMetadata(user.id, {
      publicMetadata: { subscribed: true, stripeCustomerId: session.customer, stripeSubscriptionId: session.subscription },
    });
    // Renewals and cancellations find the account through this.
    if (session.subscription) await stripe.subscriptions.update(session.subscription, { metadata: { clerkUserId: user.id } });

    // Only for an account made just now: anyone can type any email into Stripe, so an existing
    // account's alert settings are never changed from here (that person signs in first).
    const prefs = isNew ? prefsFromMetadata(m) : null;
    if (prefs) await saveAlertPrefs({ userId: user.id, body: prefs, origin: origin || process.env.NEXT_PUBLIC_SITE_URL || "https://petespostings.com" });

    await sql`UPDATE checkout_claims SET user_id = ${user.id}, is_new = ${isNew} WHERE session_id = ${session.id}`;
    return { userId: user.id, isNew, next };
  } catch (err) {
    // Give the claim back so the webhook's retry (or the next page load) can try again.
    await sql`DELETE FROM checkout_claims WHERE session_id = ${session.id} AND user_id IS NULL`;
    throw err;
  }
}
