"use client";

// First-time tour of the iPhone app, shown once on /jobs right after onboarding: Pete points out
// the jobs list, Recent, Alerts, Saved and the account button. Onboarding sets the flag; finishing
// or skipping clears it. Each step highlights the real element (dimming everything else).
import { useEffect, useLayoutEffect, useState } from "react";
import { capture } from "@/lib/analytics";
import { nativeTabs } from "@/lib/native";
import { FIRM_LABEL } from "@/lib/firms";
import Pete from "./onboarding/Pete";

export const TOUR_KEY = "pp_app_tour";

const STEPS = [
  { sel: ".jobs-list-browse", title: "These are your jobs", body: `Every open role from ${FIRM_LABEL} firms, already filtered to what you picked. Tap Filters to change it.`, radius: 22, maxH: 0.42 },
  { sel: '.tabbar a[href="/recent"]', title: "Fresh from the last 48 hours", body: "Recent shows every role posted in the last two days, newest first. Apply before everyone else does.", radius: 16 },
  { sel: ".tabbar .tab-main", title: "Your notifications", body: "Tap here to change which firms, roles and cities I notify you about, or to pause notifications.", round: true },
  { sel: ".tabbar > :nth-child(4)", title: "No more spreadsheets", body: "Tap the bookmark on any role to save it. Mark it Applied here and you’ll always know where you stand.", radius: 16 },
  { sel: ".nav-acct", title: "Your account", body: "Add a profile photo, manage your subscription and change your settings up here. That’s the tour. Good luck out there!", round: true, happy: true },
];
const PAD = 6;

export default function AppTour() {
  const [step, setStep] = useState(-1);
  const [box, setBox] = useState(null);

  useEffect(() => {
    let pending = false;
    try { pending = localStorage.getItem(TOUR_KEY) === "pending"; } catch {}
    if (!pending) return;
    window.scrollTo(0, 0);
    document.documentElement.classList.add("tour-on");
    setStep(0);
    capture("app_tour_started");
  }, []);

  // Find this step's element (it may still be loading) and measure it; skip it if it never shows.
  useLayoutEffect(() => {
    if (step < 0 || step >= STEPS.length) return;
    const s = STEPS[step];
    let tries = 0, timer;
    const measure = () => {
      const el = document.querySelector(s.sel);
      if (!el) {
        if (++tries > 25) setStep((n) => n + 1);
        else timer = setTimeout(measure, 200);
        return;
      }
      // In the app the tabs are Apple's native bar, drawn over the page: select the tab there and
      // leave the whole bar lit (the dim stops at its top edge).
      if (s.sel.startsWith(".tabbar") && document.documentElement.classList.contains("native-tabs")) {
        nativeTabs.call("select", { index: [...el.parentElement.children].indexOf(el) }).catch(() => {});
        const tabH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tabbar-h")) || 83;
        setBox({ left: -4, top: window.innerHeight - tabH, width: window.innerWidth + 8, height: tabH + 4, radius: 0 });
        return;
      }
      const r = el.getBoundingClientRect();
      const h = s.maxH ? Math.min(r.height, window.innerHeight * s.maxH) : r.height;
      if (s.round) {
        const d = Math.max(r.width, r.height) + PAD * 2;
        setBox({ left: r.left + r.width / 2 - d / 2, top: r.top + r.height / 2 - d / 2, width: d, height: d, radius: d / 2 });
      } else {
        setBox({ left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: h + PAD * 2, radius: s.radius || 16 });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => { clearTimeout(timer); window.removeEventListener("resize", measure); };
  }, [step]);

  const done = (how) => {
    try { localStorage.removeItem(TOUR_KEY); } catch {}
    document.documentElement.classList.remove("tour-on");
    const on = [...(document.querySelector(".tabbar")?.children || [])].findIndex((t) => t.classList.contains("is-on"));
    nativeTabs.call("select", { index: on }).catch(() => {});
    capture(how === "skip" ? "app_tour_skipped" : "app_tour_finished", { step });
    setStep(STEPS.length);
  };

  if (step < 0 || step >= STEPS.length || !box) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  // The bubble goes below a target in the top half of the screen, above one in the bottom half.
  const below = box.top + box.height / 2 < window.innerHeight / 2;
  const bubblePos = below ? { top: box.top + box.height + 18 } : { bottom: window.innerHeight - box.top + 18 };

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={`App tour, step ${step + 1} of ${STEPS.length}`}>
      <div className="tour-catch" />
      <div className="tour-spot" style={{ left: box.left, top: box.top, width: box.width, height: box.height, borderRadius: box.radius }} />
      <div className="tour-card" style={bubblePos}>
        <div className={`tour-say${below ? " tour-say-down" : ""}`}>
          <Pete size={56} mood={s.happy ? "happy" : "smile"} />
          <div className="tour-bubble">
            <strong>{s.title}</strong>
            <p>{s.body}</p>
          </div>
        </div>
        <div className="tour-foot">
          {last ? <span className="tour-skip-space" /> : <button type="button" className="tour-skip" onClick={() => done("skip")}>Skip tour</button>}
          <span className="tour-dots" aria-hidden="true">{STEPS.map((_, i) => <span key={i} className={i === step ? "is-on" : ""} />)}</span>
          <button type="button" className="tour-next" onClick={() => (last ? done("finish") : setStep(step + 1))}>{last ? "Let’s go" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
