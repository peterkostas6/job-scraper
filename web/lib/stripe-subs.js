// Subscriptions that still count as "has Pro" for an email, across every Stripe customer with
// that email (each checkout used to make a new customer). Used to stop a second subscription.
const LIVE = new Set(["active", "trialing", "past_due", "unpaid", "incomplete"]);

export async function liveSubscriptionsForEmail(stripe, email, { exclude } = {}) {
  if (!email) return [];
  // Stripe matches emails case-sensitively; check as typed and lowercased.
  const variants = [...new Set([email.trim(), email.trim().toLowerCase()])];
  const customers = (await Promise.all(variants.map((e) => stripe.customers.list({ email: e, limit: 20 })))).flatMap((r) => r.data);
  const subs = [];
  for (const c of new Map(customers.map((x) => [x.id, x])).values()) {
    const { data } = await stripe.subscriptions.list({ customer: c.id, status: "all", limit: 20 });
    console.log("TEMP subs for", c.id, JSON.stringify(data.map((x) => [x.id, x.status, x.customer])));
    subs.push(...data.filter((s) => LIVE.has(s.status) && s.id !== exclude));
  }
  console.log("TEMP liveSubscriptionsForEmail", JSON.stringify({ variants, customers: customers.map((c) => c.id), subs: subs.map((x) => [x.id, x.status]) }));
  return subs;
}
