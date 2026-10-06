"use client";
// One call for every product event we send to PostHog from the browser.
// Never throws: analytics must not break a click.
import posthog from "posthog-js";

export function capture(event, props) {
  try { posthog.capture(event, props); } catch {}
}
