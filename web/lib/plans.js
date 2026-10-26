// The Pro plan, in one place. trialDays is the trial the site advertises; checkout uses the
// trial_days metadata on the Stripe price or product when it is set, so keep the two the same. The price here must match the Stripe price that
// STRIPE_PRICE_ID points to. Subscribers on the old weekly/yearly plans keep them in Stripe.
export const PLANS = {
  monthly: { name: "Monthly", price: 4.99, period: "mo", billed: "Billed monthly", trialDays: 7 },
};

export const PLAN_KEYS = ["monthly"];

export const planPrice = (key) => PLANS[key]?.price ?? PLANS.monthly.price;
