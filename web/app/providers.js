"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { track } from "@/lib/track";

export function PostHogProvider({ children }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      // Sent through our own domain (see /ingest in next.config.js) so ad blockers don't drop it.
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      capture_pageview: "history_change", // every in-app page change, not just the first load
      capture_pageleave: true,
      autocapture: true, // every click, form submit and input change
      rageclick: true,
      capture_dead_clicks: true, // clicks on things that look clickable but do nothing
      enable_heatmaps: true,
      capture_performance: { web_vitals: true }, // page speed as real visitors see it
      capture_exceptions: true, // JavaScript errors visitors hit
      session_recording: {
        maskAllInputs: true, // phone numbers and search text never appear in recordings
      },
    });
  }, []);

  // The pixels' base code counts the first page; count each in-app page change after it.
  const pathname = usePathname();
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) { firstPath.current = false; return; }
    track("PageView");
  }, [pathname]);

  return (
    <PHProvider client={posthog}>
      <IdentifyUser />
      {children}
    </PHProvider>
  );
}

// Ties a visitor's events to their account once they sign in (and splits them apart on
// sign-out), so funnels, recordings and server events (alerts, payments) line up per person.
function IdentifyUser() {
  const { isLoaded, isSignedIn, user } = useUser();
  const identified = useRef(null);
  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && user && identified.current !== user.id) {
      const meta = user.publicMetadata || {};
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName || undefined,
        subscribed: meta.subscribed === true,
        plan: meta.plan || (meta.subscribed ? "pro" : "free"),
        signed_up_at: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
      });
      identified.current = user.id;
    } else if (!isSignedIn && identified.current) {
      posthog.reset();
      identified.current = null;
    }
  }, [isLoaded, isSignedIn, user]);
  return null;
}
