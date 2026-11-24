"use client";

// The iPhone app's hard paywall: inside the app, anyone without a paid account is sent to the
// onboarding (which ends at the paywall). Does nothing on the website.
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { isApp, hasAppAccess, APP_OPEN_PATHS, APP_WEB_ONLY_PATHS } from "@/lib/app-access";
import { onPushTap, nativeTabs } from "@/lib/native";
import AppTour from "./AppTour";

// Drives the app's native tab bar from the page: shows it on screens that have the site's
// .tabbar (hidden in the app), keeps its selected tab in step, and turns native taps into clicks
// on the matching site tab, so each tab keeps doing exactly what it does on the website.
function NativeTabBridge() {
  useEffect(() => {
    if (!isApp()) return;
    const html = document.documentElement;
    let ready = false, off = () => {}, raf = 0;
    const last = { vis: null, idx: null };
    const sync = () => {
      if (!ready) return;
      const bar = document.querySelector(".tabbar");
      const vis = Boolean(bar);
      if (vis !== last.vis) {
        last.vis = vis;
        nativeTabs.call("setVisible", { visible: vis }).then((r) => { if (vis && r?.height) html.style.setProperty("--tabbar-h", `${r.height}px`); }).catch(() => {});
      }
      if (!vis || html.classList.contains("tour-on")) return;
      const idx = [...bar.children].findIndex((t) => t.classList.contains("is-on"));
      if (idx !== last.idx) { last.idx = idx; nativeTabs.call("select", { index: idx }).catch(() => {}); }
    };
    nativeTabs.call("select", { index: -1 }).then(() => {
      ready = true;
      html.classList.add("native-tabs");
      off = nativeTabs.onTap((i) => document.querySelectorAll(".tabbar > *")[i]?.click());
      sync();
    }).catch(() => {});
    const mo = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    return () => { off(); mo.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return null;
}

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
  return (
    <>
      <NativeTabBridge />
      {isLoaded && pathname === "/jobs" && <AppTour />}
    </>
  );
}
