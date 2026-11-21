// The one paid plan (Premium, "Get first in the stack"), in one place. Alerts are free for
// 3 days (lib/alert-trial.js), so checkout charges right away: trialDays is 0. Checkout uses the
// trial_days metadata on the Stripe price or product when it is set, so keep the two the same. The price here must match the Stripe price that
// STRIPE_PRICE_ID points to. Subscribers on the old weekly/yearly plans keep them in Stripe.
export const PLANS = {
  monthly: { name: "Get first in the stack", price: 4.99, period: "mo", billed: "Billed monthly", trialDays: 0 },
};

export const PLAN_KEYS = ["monthly"];

export const planPrice = (key) => PLANS[key]?.price ?? PLANS.monthly.price;
