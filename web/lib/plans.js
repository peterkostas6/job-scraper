// The Pro plans, in one place. Prices here must match the Stripe prices that
// STRIPE_PRICE_ID_WEEKLY / STRIPE_PRICE_ID / STRIPE_PRICE_ID_YEARLY point to.
export const PLANS = {
  weekly: { name: "Weekly", price: 3.99, period: "wk", billed: "Billed weekly" },
  monthly: { name: "Monthly", price: 7.99, period: "mo", billed: "Billed monthly" },
  yearly: { name: "Yearly", price: 59.99, period: "yr", billed: "Billed yearly", perMonth: 5.0 },
};

export const PLAN_KEYS = ["weekly", "monthly", "yearly"];

export const planPrice = (key) => PLANS[key]?.price ?? PLANS.monthly.price;
