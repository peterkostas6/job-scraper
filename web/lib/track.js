// One call per moment that matters; it reports to every ad platform we run.
// Meta uses its own event names; Reddit's closest standard events are mapped below.
import { trackMeta } from "@/lib/meta-pixel";
import { trackReddit } from "@/lib/reddit-pixel";
import { capture } from "@/lib/analytics";

const REDDIT_EVENT = {
  PageView: "PageVisit",
  CompleteRegistration: "SignUp",
  InitiateCheckout: "AddToCart", // Reddit has no checkout-started event
  Purchase: "Purchase",
};

// The same moments in PostHog (page views are captured there automatically).
const POSTHOG_EVENT = {
  CompleteRegistration: "signup_completed",
  InitiateCheckout: "checkout_started",
  Purchase: "purchase_completed",
  StartTrial: "trial_started",
};

// value is in USD. eventId lets each platform de-duplicate against server-side copies.
export function track(event, value, eventId) {
  if (POSTHOG_EVENT[event]) capture(POSTHOG_EVENT[event], value != null ? { value, currency: "USD" } : undefined);
  trackMeta(event, value != null ? { value, currency: "USD" } : undefined, eventId);
  const redditEvent = REDDIT_EVENT[event];
  if (redditEvent) {
    trackReddit(redditEvent, {
      ...(value != null && { value, currency: "USD" }),
      ...(eventId && { conversionId: eventId }),
    });
  }
}
