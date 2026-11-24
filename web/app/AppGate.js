"use client";

// The iPhone app's hard paywall: inside the app, anyone without a paid account is sent to the
// onboarding (which ends at the paywall). Does nothing on the website.
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { isApp, hasAppAccess, APP_OPEN_PATHS, APP_WEB_ONLY_PATHS } from "@/lib/app-access";
import { onPushTap } from "@/lib/native";
import AppTour from "./AppTour";

export default function AppGate() {
  const pathname = usePathname();
  const { isLoaded, user } = useUser();

  useEffect(() => {
    if (!isLoaded || !isApp()) return;
    if (APP_OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    if (!hasAppAccess(user)) window.location.replace("/onboarding");
    else if (APP_WEB_ONLY_PATHS.includes(pathname)) window.location.replace("/jobs");
  }, [isLoaded, user, pathname]);

  // Tapping a job notification opens that role.
  useEffect(() => onPushTap((url) => { window.location.href = url; }), []);

  // The first-time tour (flag set at the end of onboarding) runs on the jobs screen.
  return isLoaded && pathname === "/jobs" ? <AppTour /> : null;
}
