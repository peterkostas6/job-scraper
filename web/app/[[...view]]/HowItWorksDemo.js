"use client";

import { useState, useEffect, useRef } from "react";

// Homepage "See how it works": a looping story in three panels.
// 1) a new role appears in the bank's own careers API, 2) it lands on Pete's Postings
// while LinkedIn still has nothing, 3) it's texted to your phone and you tap through to apply.
// Each step is a number; CSS keys the pops, presses and ripples off the classes below.

const JOB = {
  bank: "JPMorgan Chase",
  title: "Investment Banking – Diversified Industries – Analyst",
  location: "Chicago, IL",
};

const OLDER_ROWS = [
  { title: "Macro Credit Trading Desk – Analyst", bank: "JPMorgan Chase", when: "2d ago" },
  { title: "Summer Analyst 2027 – Internal Audit", bank: "Citi", when: "3d ago" },
  { title: "Agency CMO Trading Analyst", bank: "Barclays", when: "4d ago" },
];

// ms after the loop starts that each step begins
const STEP_AT = [
  0,     // 0  reset
  600,   // 1  new line pops into the bank API
  1500,  // 2  packet travels to the feed
  2100,  // 3  row pops into the feed
  2600,  // 4  LinkedIn check: nothing yet
  3500,  // 5  packet travels to the phone
  4100,  // 6  text arrives (drop + buzz)
  5200,  // 7  cursor moves to the notification
  5800,  // 8  tap
  6150,  // 9  job opens on the phone
  7000,  // 10 cursor moves to Apply
  7500,  // 11 tap Apply
  7700,  // 12 applied + burst
];
const LOOP_MS = 10400;

export default function HowItWorksDemo() {
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const rootRef = useRef(null);

  // Only animate while the section is on screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setStep(12); return; }
    const io = new IntersectionObserver(([entry]) => setRunning(entry.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const timers = [];
    const cycle = () => {
      STEP_AT.forEach((at, i) => timers.push(setTimeout(() => setStep(i), at)));
      timers.push(setTimeout(cycle, LOOP_MS));
    };
    cycle();
    return () => timers.forEach(clearTimeout);
  }, [running]);

  const active = step >= 6 ? 3 : step >= 3 ? 2 : step >= 1 ? 1 : 0;
  const cursorOn = step >= 7 && step <= 12;
  const cursorAt = step >= 10 ? "apply" : "notif";
  const pressing = step === 8 || step === 11;
  const jobOpen = step >= 9;
  const applied = step >= 12;

  const STEPS = [
    { n: 1, title: "Pulled from the bank’s API", desc: "We read each bank’s own careers system, not job boards." },
    { n: 2, title: "On your feed before LinkedIn", desc: "New roles show up here while LinkedIn still has nothing." },
    { n: 3, title: "Texted the second it’s live", desc: "Pick your banks and roles. We text you. You apply first." },
  ];

  return (
    <section className="hiw" ref={rootRef} aria-labelledby="hiw-title">
      <p className="hiw-eyebrow">See how it works</p>
      <h2 className="hiw-title" id="hiw-title">From the bank&rsquo;s API to your phone.</h2>
      <p className="hiw-intro">
        We pull every analyst and intern posting straight from the banks&rsquo; own career APIs, so you see
        it before it hits LinkedIn, and get a text the second it goes live.
      </p>

      <ol className="hiw-steps">
        {STEPS.map((s) => (
          <li key={s.n} className={`hiw-step${active === s.n ? " hiw-step-active" : ""}${active > s.n ? " hiw-step-done" : ""}`}>
            <span className="hiw-step-num">{s.n}</span>
            <span className="hiw-step-text">
              <span className="hiw-step-title">{s.title}</span>
              <span className="hiw-step-desc">{s.desc}</span>
            </span>
            <span className="hiw-step-bar"><span /></span>
          </li>
        ))}
      </ol>

      <div className={`hiw-stage hiw-at-${Math.max(active, 1)}`} aria-hidden="true">
        {/* 1 · Bank API */}
        <div className={`hiw-panel hiw-api${active === 1 ? " hiw-panel-active" : ""}`} data-panel="1">
          <div className="hiw-panel-head">
            <span className="hiw-dot" />
            <span className="hiw-panel-name">JPMorgan Chase &middot; careers API</span>
          </div>
          <div className="hiw-code">
            <div className="hiw-code-line hiw-dim">{"{ \"id\": 21904, \"title\": \"Macro Credit Trading…\" },"}</div>
            <div className="hiw-code-line hiw-dim">{"{ \"id\": 21877, \"title\": \"Market Risk Analyst\" },"}</div>
            {step >= 1 && (
              <div className="hiw-code-line hiw-code-new hiw-pop">
                {"{ \"id\": 21931, \"title\": \"IB – Diversified Industries – Analyst\", \"status\": \"live\" }"}
              </div>
            )}
          </div>
          <div className="hiw-panel-foot">Straight from the source</div>
        </div>

        <div className={`hiw-link${step === 2 ? " hiw-link-live" : ""}`}><span className="hiw-packet" /></div>

        {/* 2 · Pete's Postings feed vs LinkedIn */}
        <div className="hiw-mid" data-panel="2">
          <div className={`hiw-panel hiw-feed${active === 2 ? " hiw-panel-active" : ""}`}>
            <div className="hiw-panel-head">
              <img src="/logo-mark.png" alt="" className="hiw-logo" />
              <span className="hiw-panel-name">Pete&rsquo;s Postings</span>
              <span className="hiw-live"><i />Live</span>
            </div>
            <div className="hiw-rows">
              {step >= 3 && (
                <div className="hiw-row hiw-row-new hiw-pop">
                  <span className="hiw-new">New</span>
                  <span className="hiw-row-main">
                    <span className="hiw-row-title">{JOB.title}</span>
                    <span className="hiw-row-meta">{JOB.bank} &middot; {JOB.location}</span>
                  </span>
                  <span className="hiw-row-when">just now</span>
                </div>
              )}
              {OLDER_ROWS.map((r) => (
                <div className="hiw-row" key={r.title}>
                  <span className="hiw-row-main">
                    <span className="hiw-row-title">{r.title}</span>
                    <span className="hiw-row-meta">{r.bank}</span>
                  </span>
                  <span className="hiw-row-when">{r.when}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`hiw-panel hiw-linkedin${step >= 4 ? " hiw-linkedin-checked" : ""}`}>
            <span className="hiw-li-badge">in</span>
            <span className="hiw-li-text">
              <span className="hiw-li-title">LinkedIn search: &ldquo;JPMorgan IB Analyst&rdquo;</span>
              <span className="hiw-li-result">
                {step >= 4 ? (
                  <span className="hiw-pop">Not posted yet</span>
                ) : (
                  <span className="hiw-li-searching">Searching<span className="hiw-ellipsis" /></span>
                )}
              </span>
            </span>
          </div>
        </div>

        <div className={`hiw-link${step === 5 ? " hiw-link-live" : ""}`}><span className="hiw-packet" /></div>

        {/* 3 · Phone */}
        <div className={`hiw-phone${step === 6 ? " hiw-buzz" : ""}${active === 3 ? " hiw-phone-active" : ""}`} data-panel="3">
          <div className="hiw-phone-screen">
            <div className="hiw-island" />

            <div className={`hiw-lock${jobOpen ? " hiw-hide" : ""}`}>
              <div className="hiw-lock-time">9:47</div>
              <div className="hiw-lock-date">Monday, September 28</div>
              {step >= 6 && (
                <div className={`hiw-sms hiw-drop${pressing && !jobOpen ? " hiw-pressed" : ""}`}>
                  <span className="hiw-sms-icon">
                    <svg width="16" height="16" viewBox="0 0 64 64" fill="#fff"><path d="M32 9C17.6 9 6 18.4 6 30c0 6.1 3.3 11.7 8.6 15.6-.5 3.7-2 7.2-4.5 10.1-.3.4 0 1 .5 1 5.5-.5 10.6-2.4 14.6-5.4C27.4 51.7 29.7 52 32 52c14.4 0 26-9.4 26-21S46.4 9 32 9z"/></svg>
                  </span>
                  <span className="hiw-sms-body">
                    <span className="hiw-sms-top"><b>Pete&rsquo;s Postings</b><span>now</span></span>
                    <span className="hiw-sms-text">JPMorgan Chase just posted: IB – Diversified Industries – Analyst. Tap to apply &rarr;</span>
                  </span>
                </div>
              )}
            </div>

            <div className={`hiw-job${jobOpen ? " hiw-job-open" : ""}`}>
              <span className="hiw-job-bank">{JOB.bank}</span>
              <span className="hiw-job-title">{JOB.title}</span>
              <span className="hiw-job-meta">{JOB.location} &middot; Posted just now</span>
              <span className="hiw-job-tags"><span>Analyst</span><span>Investment Banking</span></span>
              <span className={`hiw-apply${pressing && jobOpen ? " hiw-pressed" : ""}${applied ? " hiw-applied" : ""}`}>
                {applied ? "Applied ✓" : "Apply now"}
                {applied && (
                  <span className="hiw-burst">
                    {Array.from({ length: 8 }).map((_, i) => <i key={i} style={{ "--a": `${i * 45}deg` }} />)}
                  </span>
                )}
              </span>
              <span className="hiw-job-first">You&rsquo;re one of the first to apply.</span>
            </div>

            <div className={`hiw-cursor hiw-cursor-${cursorAt}${cursorOn ? " hiw-cursor-on" : ""}${pressing ? " hiw-cursor-press" : ""}`}>
              <span className="hiw-ripple" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
