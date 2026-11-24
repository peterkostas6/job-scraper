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
const SHEETS = ".alx-wrap, .acct-wrap, .mfs-wrap, .modal-overlay, .cl-modalBackdrop";

// A light buzz on every tap of a button or link, a softer tick on switches and chips, and a
// firmer one on the big coral buttons, like a native iPhone app. Only real taps (not the clicks
// the native tab bar sends, which buzz on their own).
function buzz(e) {
  if (!e.isTrusted) return;
  const el = e.target.closest?.('button, a[href], [role="switch"], [role="button"], input[type="checkbox"], input[type="radio"], label');
  if (!el || el.disabled) return;
  const style = el.matches('[role="switch"], [aria-pressed], input[type="checkbox"], input[type="radio"], label') ? "selection"
    : el.matches(".ob-btn, .alx-save, .tour-next, .nav-upgrade") ? "medium" : "light";
  nativeTabs.call("haptic", { style }).catch(() => {});
}

function NativeTabBridge() {
  useEffect(() => {
    if (!isApp()) return;
    const html = document.documentElement;
    let ready = false, off = () => {}, raf = 0;
    const last = { vis: null, idx: null };
    const sync = () => {
      if (!ready) return;
      const bar = document.querySelector(".tabbar");
      // Like any iPhone app, the tab bar steps aside while a sheet is up (it would cover the
      // sheet's buttons): alerts, account, filters, pop-ups, and Clerk's sign-in/profile.
      const vis = Boolean(bar) && !document.querySelector(SHEETS);
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
      document.addEventListener("click", buzz, true);
      sync();
    }).catch(() => {});
    const mo = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    return () => { off(); mo.disconnect(); cancelAnimationFrame(raf); document.removeEventListener("click", buzz, true); };
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
