// One call per moment that matters; it reports to every ad platform we run.
// Meta uses its own event names; Reddit's closest standard events are mapped below.
import { trackMeta } from "@/lib/meta-pixel";
import { trackReddit } from "@/lib/reddit-pixel";

const REDDIT_EVENT = {
  PageView: "PageVisit",
  CompleteRegistration: "SignUp",
  InitiateCheckout: "AddToCart", // Reddit has no checkout-started event
  StartTrial: "Lead",            // nor a trial event; Lead is its closest standard one
  Purchase: "Purchase",
};

// value is in USD. eventId lets each platform de-duplicate against server-side copies.
export function track(event, value, eventId) {
  trackMeta(event, value != null ? { value, currency: "USD" } : undefined, eventId);
  const redditEvent = REDDIT_EVENT[event];
  if (redditEvent) {
    trackReddit(redditEvent, {
      ...(value != null && { value, currency: "USD" }),
      ...(eventId && { conversionId: eventId }),
    });
  }
}
