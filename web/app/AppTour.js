"use client";

// First-time tour of the iPhone app, shown once on /jobs right after onboarding: Pete points out
// the jobs list, Alerts, Saved and Settings. Onboarding sets the flag; finishing
// clears it. It can't be skipped: while it's up, Next is the only thing that responds (the page
// is covered and the native tab bar's taps are switched off).
import { useEffect, useLayoutEffect, useState } from "react";
import { capture } from "@/lib/analytics";
import { nativeTabs } from "@/lib/native";
import { FIRM_LABEL } from "@/lib/firms";
import Pete from "./onboarding/Pete";

export const TOUR_KEY = "pp_app_tour";
export const TOUR_SEEN_KEY = "pp_app_tour_seen"; // set once finished or skipped: never again

const STEPS = [
  { sel: ".jobs-list-browse", title: "Your jobs", body: "The newest roles, matched to your picks.", radius: 22, maxH: 0.42 },
  { sel: ".tabbar .tab-main", title: "Your preferences", body: "Change what I notify you about.", round: true },
  { sel: ".tabbar > :nth-child(3)", title: "Saved roles", body: "Save roles and mark them Applied.", radius: 16 },
  { sel: ".tabbar > :nth-child(5)", title: "Your account", body: "Settings and subscription. Good luck!", radius: 16, happy: true },
];
const PAD = 6;
const TYPE_MS = 28; // one letter every 28ms: types like someone at a keyboard, not a slideshow

export default function AppTour() {
  const [step, setStep] = useState(-1);
  const [box, setBox] = useState(null);
  const [typed, setTyped] = useState(0); // letters of this step's title + body shown so far

  useEffect(() => {
    let pending = false;
    try { pending = localStorage.getItem(TOUR_KEY) === "pending"; } catch {}
    if (!pending) return;
    window.scrollTo(0, 0);
    document.documentElement.classList.add("tour-on");
    nativeTabs.call("setEnabled", { enabled: false }).catch(() => {});
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

  // Type this step's words out letter by letter (all at once for people who turn off motion).
  useEffect(() => {
    if (step < 0 || step >= STEPS.length || !box) return;
    const total = STEPS[step].title.length + STEPS[step].body.length;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setTyped(total); return; }
    setTyped(0);
    const id = setInterval(() => setTyped((n) => { if (n + 1 >= total) clearInterval(id); return n + 1; }), TYPE_MS);
    return () => clearInterval(id);
  }, [step, !!box]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = () => {
    try { localStorage.removeItem(TOUR_KEY); localStorage.setItem(TOUR_SEEN_KEY, "1"); } catch {}
    document.documentElement.classList.remove("tour-on");
    nativeTabs.call("setEnabled", { enabled: true }).catch(() => {});
    const on = [...(document.querySelector(".tabbar")?.children || [])].findIndex((t) => t.classList.contains("is-on"));
    nativeTabs.call("select", { index: on }).catch(() => {});
    capture("app_tour_finished", { step });
    setStep(STEPS.length);
  };

  if (step < 0 || step >= STEPS.length || !box) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  const total = s.title.length + s.body.length;
  const typing = typed < total;
  // Typed letters show; the rest stay invisible so the bubble is full size from the start.
  const part = (text, from) => {
    const n = Math.max(0, Math.min(text.length, typed - from));
    const caret = typed >= from && typed < from + text.length;
    return <><span aria-hidden="true">{text.slice(0, n)}</span>{caret && <span className="tour-caret" aria-hidden="true" />}<span aria-hidden="true" className="tour-rest">{text.slice(n)}</span></>;
  };
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
            <span className="sr-only">{s.title}. {s.body}</span>
            <strong>{part(s.title, 0)}</strong>
            <p>{part(s.body, s.title.length)}</p>
          </div>
        </div>
        <div className="tour-foot">
          <span className="tour-skip-space" />
          <span className="tour-dots" aria-hidden="true">{STEPS.map((_, i) => <span key={i} className={i === step ? "is-on" : ""} />)}</span>
          <button type="button" className="tour-next" onClick={() => (typing ? setTyped(total) : last ? done() : (setTyped(0), setStep(step + 1)))}>{last ? "Let’s go" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
