"use client";

// The iPhone app's hard paywall: inside the app, anyone without a paid account is sent to the
// onboarding (which ends at the paywall). Does nothing on the website.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { isApp, hasAppAccess, APP_OPEN_PATHS, APP_WEB_ONLY_PATHS } from "@/lib/app-access";
import { onPushTap, nativeTabs } from "@/lib/native";
import AppTour from "./AppTour";

// Drives the app's native tab bar from the page: shows it on screens that have the site's
// .tabbar (hidden in the app), keeps its selected tab in step, and turns native taps into clicks
// on the matching site tab, so each tab keeps doing exactly what it does on the website.
// Resolves once the page has stopped changing for `quiet` ms (data loaded, list drawn), or after
// `max` ms, so a fade only ever reveals the finished screen, never an empty card mid-load.
function whenSettled(quiet = 180, max = 2500) {
  return new Promise((resolve) => {
    let timer = setTimeout(done, quiet);
    const hard = setTimeout(done, max);
    const mo = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(done, quiet); });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true });
    function done() {
      if (document.querySelector(".spinner") && Date.now() - start < max) { timer = setTimeout(done, quiet); return; }
      mo.disconnect(); clearTimeout(timer); clearTimeout(hard); resolve();
    }
    const start = Date.now();
  });
}

const SHEETS = ".alx-wrap, .acct-wrap, .mfs-wrap, .modal-overlay, .cl-modalBackdrop, .app-splash";

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
      off = nativeTabs.onTap((i) => {
        const tab = document.querySelectorAll(".tabbar > *")[i];
        if (!tab) return;
        // Jobs and Saved switch the page: fade it out, switch, fade the new one in.
        // Alerts, Request and Settings open sheets (data-sheet), which slide up on their own.
        if (tab.hasAttribute("data-sheet") || tab.classList.contains("is-on")) { tab.click(); return; }
        html.classList.remove("tab-in");
        html.classList.add("tab-out");
        setTimeout(() => {
          tab.click();
          window.scrollTo(0, 0);
          // Fade back in only once the new page has finished drawing.
          whenSettled().then(() => {
            html.classList.remove("tab-out");
            html.classList.add("tab-in");
            setTimeout(() => html.classList.remove("tab-in"), 400);
          });
        }, 160);
      });
      document.addEventListener("click", buzz, true);
      sync();
    }).catch(() => {});
    const mo = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    return () => { off(); mo.disconnect(); cancelAnimationFrame(raf); document.removeEventListener("click", buzz, true); };
  }, []);
  return null;
}

// The app's launch screen: Pete hopping on navy for at least ~1.5 s and until nothing is still
// loading (max 7 s), then the whole screen fades in. It shows again on the way out of sign-in /
// onboarding into the app (AppGate remounts it), so Jobs never appears half-loaded. Rendered for everyone but only visible in
// the app (CSS keys on .in-app, set before first paint); the website removes it on mount.
function AppSplash() {
  const [phase, setPhase] = useState("on"); // on -> out (fading) -> done
  useEffect(() => {
    if (!isApp()) { setPhase("done"); return; }
    const start = Date.now();
    const t = setInterval(() => {
      const waited = Date.now() - start;
      const busy = document.querySelector(".spinner, .ob-loading");
      if ((waited > 1500 && !busy) || waited > 7000) {
        clearInterval(t);
        whenSettled(200, 2000).then(() => {
          setPhase("out");
          setTimeout(() => setPhase("done"), 600);
        });
      }
    }, 100);
    return () => clearInterval(t);
  }, []);
  if (phase === "done") return null;
  return <div className={`app-splash${phase === "out" ? " is-out" : ""}`} aria-hidden="true"><span className="pete-hop" /></div>;
}

export default function AppGate() {
  const pathname = usePathname();
  // Leaving onboarding (signed in, paid) for the app: run the loading screen again, before paint.
  const [splashRun, setSplashRun] = useState(0);
  const prevPath = useRef(pathname);
  useLayoutEffect(() => {
    if (isApp() && prevPath.current?.startsWith("/onboarding") && !pathname.startsWith("/onboarding")) setSplashRun((n) => n + 1);
    prevPath.current = pathname;
  }, [pathname]);
  const { isLoaded, user } = useUser();

  useEffect(() => {
    if (!isLoaded || !isApp()) return;
    if (APP_OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    // Remember this phone has had an account, so signing out (or a lapsed session) lands on the
    // sign-in screen rather than the new-user welcome.
    if (user) { try { localStorage.setItem("pp_had_account", "1"); } catch {} }
    let hadAccount = false;
    try { hadAccount = localStorage.getItem("pp_had_account") === "1"; } catch {}
    if (!hasAppAccess(user)) window.location.replace(!user && hadAccount ? "/onboarding?step=signin" : "/onboarding");
    else if (APP_WEB_ONLY_PATHS.includes(pathname)) window.location.replace("/jobs");
  }, [isLoaded, user, pathname]);

  // Tapping a job notification opens that role.
  useEffect(() => onPushTap((url) => { window.location.href = url; }), []);

  // The first-time tour (flag set at the end of onboarding) runs on the jobs screen.
  return (
    <>
      <AppSplash key={splashRun} />
      <NativeTabBridge />
      {isLoaded && pathname === "/jobs" && <AppTour />}
    </>
  );
}
