"use client";
import { useEffect } from "react";
import { track } from "@/lib/track";

// Tell the ad platforms about a brand-new account once: signed in, created in the last 10 minutes,
// and not already reported from this browser.
export function useTrackSignup(user) {
  useEffect(() => {
    if (!user?.id || !user.createdAt) return;
    if (Date.now() - new Date(user.createdAt).getTime() > 10 * 60 * 1000) return;
    const key = `pp-signup-tracked-${user.id}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {}
    track("CompleteRegistration", undefined, `reg_${user.id}`);
  }, [user?.id, user?.createdAt]);
}
