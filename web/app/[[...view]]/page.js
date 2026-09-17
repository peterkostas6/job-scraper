"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, notFound } from "next/navigation";
import { useUser, useClerk, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

const BANKS = {
  jpmc: { name: "JPMorgan Chase", shortName: "JPMC", endpoint: "/api/jobs" },
  gs: { name: "Goldman Sachs", shortName: "Goldman", endpoint: "/api/jobs-gs" },
  ms: { name: "Morgan Stanley", shortName: "Morgan", endpoint: "/api/jobs-ms" },
  bofa: { name: "Bank of America", shortName: "BofA", endpoint: "/api/jobs-bofa" },
  citi: { name: "Citi", shortName: "Citi", endpoint: "/api/jobs-citi" },
  db: { name: "Deutsche Bank", shortName: "Deutsche", endpoint: "/api/jobs-db" },
  barclays: { name: "Barclays", shortName: "Barclays", endpoint: "/api/jobs-barclays" },
  wells: { name: "Wells Fargo", shortName: "Wells Fargo", endpoint: "/api/jobs-wells" },
  mufg: { name: "MUFG", shortName: "MUFG", endpoint: "/api/jobs-mufg" },
  td: { name: "TD Securities", shortName: "TD", endpoint: "/api/jobs-td" },
  mizuho: { name: "Mizuho", shortName: "Mizuho", endpoint: "/api/jobs-mizuho" },
  bmo: { name: "BMO", shortName: "BMO", endpoint: "/api/jobs-bmo" },
  hl: { name: "Houlihan Lokey", shortName: "HL", endpoint: "/api/jobs-hl" },
  guggenheim: { name: "Guggenheim", shortName: "Guggenheim", endpoint: "/api/jobs-guggenheim" },
  macquarie: { name: "Macquarie", shortName: "Macquarie", endpoint: "/api/jobs-macquarie" },
  piper: { name: "Piper Sandler", shortName: "Piper", endpoint: "/api/jobs-piper" },
  stifel: { name: "Stifel", shortName: "Stifel", endpoint: "/api/jobs-stifel" },
  blackstone: { name: "Blackstone", shortName: "Blackstone", endpoint: "/api/jobs-blackstone" },
  blackrock: { name: "BlackRock", shortName: "BlackRock", endpoint: "/api/jobs-blackrock" },
  jefferies: { name: "Jefferies", shortName: "Jefferies", endpoint: "/api/jobs-jefferies" },
};

const FREE_BANKS = new Set(["jpmc", "gs", "ms", "bofa", "citi", "db", "barclays", "wells", "mufg", "td", "mizuho", "bmo", "hl", "guggenheim", "macquarie", "piper", "stifel", "blackstone", "blackrock", "jefferies"]);

const JOB_TYPES = {
  all: "All Types",
  internship: "Internship",
  fulltime: "Analyst",
};

function isInternship(title) {
  const t = title.toLowerCase();
  return (
    /\bintern\b/.test(t) ||
    t.includes("internship") ||
    t.includes("summer") ||
    t.includes("co-op") ||
    t.includes("coop")
  );
}

function isGraduateProgram(title) {
  const t = title.toLowerCase();
  return /\bgraduate\b/.test(t) || /\bgrad\s+program/.test(t) || /\bgrad\s+programme/.test(t);
}

function isFinanceRole(title) {
  const t = title.toLowerCase();
  if (t.includes("software engineer") || t.includes("software developer")) return false;
  if (t.includes("application developer") || t.includes("web developer") || t.includes("full stack") || t.includes("fullstack")) return false;
  if (/\btechnology analyst\b/.test(t) || /\btech analyst\b/.test(t)) return false;
  if (t.includes("cybersecurity") || t.includes("cyber security") || t.includes("information security") || t.includes("infosec")) return false;
  if (t.includes("cloud engineer") || t.includes("cloud architect") || t.includes("devops") || t.includes("site reliability")) return false;
  if (t.includes("infrastructure engineer") || t.includes("network engineer") || t.includes("network administrator")) return false;
  if (t.includes("data engineer") || t.includes("machine learning engineer") || t.includes("ai engineer")) return false;
  if (/\bit\s+(analyst|support|intern|associate)\b/.test(t) || t.includes("it helpdesk") || t.includes("help desk")) return false;
  return true;
}

function formatRelativeDate(effectiveTime, hasActualDate) {
  const now = Date.now();
  const diffMs = now - effectiveTime;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  return `${diffDays}d ago`;
}

// ---- ACCOUNT PROMPT MODAL ----
// Entrance: scrim fades, card rises + settles (280ms soft ease), content staggers in.
// Exit: reverse over 180ms, then unmount. Esc closes. Body scroll is locked while open.
function AccountPromptModal({ onClose, last48hCount = 0 }) {
  const [closing, setClosing] = useState(false);
  const primaryRef = useRef(null);

  const close = () => {
    if (closing) return;
    setClosing(true);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(onClose, reduce ? 0 : 180);
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => primaryRef.current && primaryRef.current.focus(), 320);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const benefits = [
    'SMS and email alerts when new positions open',
    'Every posting from the last 48 hours, free',
    'Save and track jobs across all banks',
  ];

  return (
    <div className="modal-overlay" data-state={closing ? 'closing' : 'open'} onClick={close}>
      <div
        className="modal-card modal-card-prompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-prompt-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={close} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>

        <div className="modal-stagger" style={{ '--i': 0 }}>
          <div className="modal-prompt-icon">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
        </div>

        {last48hCount > 0 && (
          <p className="modal-stat modal-stagger" style={{ '--i': 1 }}>
            <span className="modal-stat-dot" aria-hidden="true" />
            <strong className="tnum">{last48hCount}</strong>&nbsp;roles posted in the last 48 hours
          </p>
        )}

        <h2 id="account-prompt-title" className="modal-title modal-stagger" style={{ '--i': 2 }}>Don&rsquo;t miss the window</h2>
        <p className="modal-subtitle modal-stagger" style={{ '--i': 3 }}>
          Banks fill roles within days of posting. Create a free account and get notified when they go live.
        </p>

        <ul className="modal-benefits">
          {benefits.map((text, i) => (
            <li key={text} className="modal-stagger" style={{ '--i': 4 + i }}>
              <span className="modal-check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></span>
              {text}
            </li>
          ))}
        </ul>

        <div className="modal-actions modal-stagger" style={{ '--i': 7 }}>
          <SignUpButton mode="modal">
            <button className="modal-cta-primary" ref={primaryRef}>Create free account</button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button className="modal-cta-secondary">Sign in</button>
          </SignInButton>
        </div>
        <button className="modal-dismiss-link modal-stagger" style={{ '--i': 8 }} onClick={close}>Maybe later</button>
      </div>
    </div>
  );
}

// ---- HOMEPAGE ----
const BANK_COUNT = Object.keys(BANKS).length;

const PREVIEW_JOBS = [
  { title: "Investment Banking Analyst", bank: "Goldman Sachs", location: "New York, NY", time: "1h ago", isNew: true, type: "Analyst" },
  { title: "Summer Analyst Program 2026", bank: "JPMorgan Chase", location: "New York, NY", time: "2h ago", isNew: true, type: "Internship" },
  { title: "Credit Analyst, Fixed Income", bank: "Morgan Stanley", location: "Chicago, IL", time: "4h ago", isNew: false, type: "Analyst" },
  { title: "M&A Analyst", bank: "Barclays", location: "New York, NY", time: "7h ago", isNew: false, type: "Analyst" },
  { title: "Risk Analyst", bank: "Bank of America", location: "Charlotte, NC", time: "11h ago", isNew: false, type: "Analyst" },
];

const TESTIMONIALS = [
  {
    quote: "I got my JPMorgan offer after applying within an hour of Pete's alert. The role was filled 3 days after it posted — I would have missed it completely.",
    name: "Alex K.",
    role: "Incoming Analyst, JPMorgan Chase",
  },
  {
    quote: "Every finance student at my school uses this now. LinkedIn is always 2 days behind. Pete's Postings is the only way to actually stay ahead.",
    name: "Maya R.",
    role: "NYU Stern, Class of 2025",
  },
  {
    quote: "The 48-hour feed showed me 12 Goldman postings I had no idea existed. Applied to 4 and got 2 interviews. Worth every penny.",
    name: "David L.",
    role: "Wharton, Class of 2025",
  },
];

function HomePage({ onBrowse, isSignedIn, last48hCount }) {
  const [animStep, setAnimStep] = useState(0);
  const [phoneText, setPhoneText] = useState('');

  // Steps 0-2: scroll through job rows; step 3+: click Alerts and set up notifications
  const DELAYS = [1000, 900, 900, 900, 800, 700, 500, 700, 350, 600, 1300, 700, 350, 700, 350, 700, 1600, 900, 2200];

  useEffect(() => {
    const timeouts = [];
    const runCycle = () => {
      setAnimStep(0);
      setPhoneText('');
      let t = 0;
      DELAYS.forEach((d, i) => {
        t += d;
        const id = setTimeout(() => setAnimStep(i + 1), t);
        timeouts.push(id);
      });
    };
    runCycle();
    const total = DELAYS.reduce((a, b) => a + b, 0);
    const interval = setInterval(runCycle, total + 300);
    return () => { timeouts.forEach(clearTimeout); clearInterval(interval); };
  }, []);

  const PHONE_NUM = '(212) 555-0147';
  useEffect(() => {
    if (animStep !== 10) return;
    let i = 0;
    setPhoneText('');
    const id = setInterval(() => {
      i++;
      setPhoneText(PHONE_NUM.slice(0, i));
      if (i >= PHONE_NUM.length) clearInterval(id);
    }, 90);
    return () => clearInterval(id);
  }, [animStep]);

  const inNotif = animStep >= 6;
  const smsOn = animStep >= 8;
  const phoneFocused = animStep >= 9;
  const goldmanOn = animStep >= 12;
  const internOn = animStep >= 14;
  const saved = animStep >= 16;
  const showIosNotif = animStep >= 17;
  const clicking = [6, 8, 12, 14, 16].includes(animStep);

  // Which element the cursor points at on each step. Positions are measured
  // from the DOM so the cursor lands on the real target at any viewport width.
  const TARGETS = [
    'row-0', 'row-1', 'row-2', 'row-3', 'row-4',   // 0-4: hover each job row
    'tab-alerts', 'tab-alerts',                    // 5-6: move to, click Alerts
    'toggle-sms', 'toggle-sms',                    // 7-8: move to, click SMS toggle
    'field-phone', 'field-phone',                  // 9-10: focus, type phone
    'chip-goldman', 'chip-goldman',                // 11-12: move to, click Goldman
    'radio-intern', 'radio-intern',                // 13-14: move to, click Internship
    'btn-save', 'btn-save', 'btn-save', 'btn-save',// 15-18: move to, click Save, notif, pause
  ];
  const previewRef = useRef(null);
  const [cursorXY, setCursorXY] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const measure = () => {
      const root = previewRef.current;
      if (!root) return;
      const key = TARGETS[Math.min(animStep, TARGETS.length - 1)];
      const el = root.querySelector(`[data-demo="${key}"]`);
      if (!el) return;
      const r = root.getBoundingClientRect();
      const t = el.getBoundingClientRect();
      // Rows: aim a little left of center so the arrow sits on the title.
      const fx = key.startsWith('row-') ? 0.35 : 0.5;
      setCursorXY({ x: t.left - r.left + t.width * fx, y: t.top - r.top + t.height * 0.55 });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [animStep]);

  const hoveredRow = animStep <= 4 ? animStep : -1;

  // Stat-Led reveal: tick the hero figure from 0 to the live count over ~500ms.
  const hasCount = last48hCount > 0;
  const [shownCount, setShownCount] = useState(0);
  const [photoOk, setPhotoOk] = useState(true);
  useEffect(() => {
    if (!hasCount) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShownCount(last48hCount); return; }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 500);
      const eased = 1 - Math.pow(1 - t, 3);
      setShownCount(Math.round(last48hCount * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [last48hCount, hasCount]);

  return (
    <>
    {/* HERO · photographic fold, marquee statement. Photo slot: public/hero.jpg (see caption below). */}
    <section className="hero-photo" data-photo={photoOk ? "on" : "off"}>
      <div className="hero-photo-bg" aria-hidden="true">
        {/* TODO: Replace with a real photograph — a Wall Street street at dawn works. Target 2400×1400, under 400 KB. */}
        <img
          src="/hero.jpg"
          alt=""
          className="hero-photo-img"
          fetchpriority="high"
          decoding="async"
          onError={() => setPhotoOk(false)}
        />
        <span className="hero-photo-glow" />
        <span className="hero-photo-grain" />
      </div>
      <div className="hero-photo-copy">
        <h1 className="hero-photo-title">
          Be first to every <mark className="hero-mark">banking job</mark> posting.
        </h1>
        <SignUpButton mode="modal">
          <button className="hero-photo-cta">Get free access</button>
        </SignUpButton>
        <p className="hero-photo-links">
          <button className="hero-photo-link" onClick={onBrowse}>Browse {BANK_COUNT} banks</button>
          <span className="hero-photo-dot" aria-hidden="true">&middot;</span>
          <Link href="/pricing" className="hero-photo-link">See pricing</Link>
        </p>
      </div>
      <p className="hero-photo-caption tnum">
        {hasCount ? `${shownCount} new roles in the last 48 hours` : `${BANK_COUNT} bank career sites, refreshed every 5 minutes`}
      </p>
    </section>

    <div className="homepage">

      {/* STATS · T4 strip, real numbers only */}
      <section className="stat-strip" aria-label="Live numbers">
        <div className="stat">
          <p className="stat-num tnum">{hasCount ? shownCount : BANK_COUNT}</p>
          <p className="stat-label">{hasCount ? "new roles in the last 48 hours" : "bank career sites tracked"}</p>
        </div>
        <div className="stat">
          <p className="stat-num tnum">{hasCount ? BANK_COUNT : "48h"}</p>
          <p className="stat-label">{hasCount ? "banks tracked, analyst and intern roles" : "window on the Recent tab"}</p>
        </div>
        <div className="stat">
          <p className="stat-num tnum">5<span className="stat-unit">min</span></p>
          <p className="stat-label">between feed refreshes</p>
        </div>
      </section>

      {/* DEMO · captioned figure, no fake chrome */}
      <figure className="app-demo">
        <div className="app-preview" ref={previewRef}>
          <div className="app-preview-tabs">
            <span className={`app-preview-tab${!inNotif ? ' app-preview-tab-active' : ''}`}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Recent
            </span>
            <span className="app-preview-tab">Browse</span>
            <span className={`app-preview-tab${inNotif ? ' app-preview-tab-active' : ''}`} data-demo="tab-alerts">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              Alerts
            </span>
          </div>

          <div className="app-preview-body">
            {!inNotif ? (
              PREVIEW_JOBS.map((job, i) => (
                <div className={`app-preview-row${hoveredRow === i ? ' app-preview-row-hover' : ''}`} key={i}>
                  <div className="app-preview-row-left">
                    {job.isNew && <span className="app-preview-new">New</span>}
                    <div>
                      <div className="app-preview-job-title" data-demo={`row-${i}`}>{job.title}</div>
                      <div className="app-preview-job-meta">{job.bank} &middot; {job.location}</div>
                    </div>
                  </div>
                  <div className="app-preview-row-right">
                    <span className={`app-preview-type ${job.type === "Internship" ? "app-preview-type-intern" : "app-preview-type-analyst"}`}>{job.type}</span>
                    <span className="app-preview-time">{job.time}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="demo-notif-panel">
                <div className="demo-notif-row">
                  <div>
                    <div className="demo-notif-label">SMS Alerts</div>
                    <div className="demo-notif-sublabel">Instant text messages</div>
                  </div>
                  <div className={`demo-toggle${smsOn ? ' demo-toggle-on' : ''}`} data-demo="toggle-sms">
                    <div className="demo-toggle-knob"></div>
                  </div>
                </div>

                <div className="demo-phone-row">
                  <div className={`demo-phone-field${phoneFocused ? ' focused' : ''}`} data-demo="field-phone">
                    <span>{phoneText}</span>
                    {phoneFocused && animStep <= 10 && <span className="demo-caret">|</span>}
                  </div>
                </div>

                <div className="demo-section-label">Banks</div>
                <div className="demo-chips-row">
                  <span className={`demo-chip${goldmanOn ? ' demo-chip-on' : ''}`} data-demo="chip-goldman">Goldman</span>
                  <span className="demo-chip">JPMorgan</span>
                  <span className="demo-chip">Morgan Stanley</span>
                  <span className="demo-chip">BofA</span>
                </div>

                <div className="demo-section-label">Job Type</div>
                <div className="demo-radios-row">
                  <span className={`demo-radio-option${!internOn ? ' demo-radio-on' : ''}`}>All</span>
                  <span className="demo-radio-option">Analyst</span>
                  <span className={`demo-radio-option${internOn ? ' demo-radio-on' : ''}`} data-demo="radio-intern">Internship</span>
                </div>

                <div className="demo-save-row">
                  <button className={`demo-save-btn${saved ? ' demo-save-btn-saved' : ''}`} data-demo="btn-save">
                    {saved ? 'Saved \u2713' : 'Save Settings'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* iOS-style notification banner */}
          <div className={`demo-ios-notif${showIosNotif ? ' demo-ios-notif-visible' : ''}`}>
            <div className="demo-ios-notif-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div className="demo-ios-notif-body">
              <div className="demo-ios-notif-header">
                <span className="demo-ios-notif-app">Pete&rsquo;s Postings</span>
                <span className="demo-ios-notif-time">now</span>
              </div>
              <div className="demo-ios-notif-text">Goldman Sachs · Investment Banking Analyst 2026. Tap to apply →</div>
            </div>
          </div>

          <div
            className={`demo-cursor${clicking ? ' demo-cursor-clicking' : ''}`}
            style={{ transform: `translate(${cursorXY.x}px, ${cursorXY.y}px)` }}
            aria-hidden="true"
          >
            <span className="demo-cursor-ripple" />
            <svg className="demo-cursor-arrow" width="20" height="24" viewBox="0 0 20 24" fill="none">
              <path d="M3 2.2v16.3l4.3-3.9 2.9 6.6 3-1.3-2.9-6.5h6.1z"
                fill="#fff" stroke="var(--navy)" strokeWidth="1.6" strokeLinejoin="round"/>
            </svg>
          </div>

        </div>
        <figcaption className="app-demo-caption">Browse the feed, then set alerts for the banks you follow.</figcaption>
      </figure>

      {/* SOURCES · T2 hairline wall */}
      <section className="sources">
        <h2 className="sources-title">Sourced from {BANK_COUNT} bank career sites</h2>
        <ul className="logo-wall">
          {Object.values(BANKS).slice(0, 8).map((bank) => (
            <li key={bank.name}>{bank.name}</li>
          ))}
          <li>
            <button className="text-link" onClick={onBrowse}>
              All {BANK_COUNT} banks <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </li>
        </ul>
      </section>

      {/* PROOF · T1 quote rows with margin attribution */}
      <section className="proof">
        <h2 className="proof-title">What students say</h2>
        {TESTIMONIALS.map((t) => (
          <div className="proof-row" key={t.name}>
            <blockquote className="proof-quote">&ldquo;{t.quote}&rdquo;</blockquote>
            <p className="proof-attr"><strong>{t.name}</strong><br />{t.role}</p>
          </div>
        ))}
      </section>

      {/* WHAT YOU GET · F3 spec sheet */}
      <section className="spec">
        <h2 className="spec-title">What you get</h2>
        <dl className="spec-sheet">
          <div className="spec-row">
            <dt>Alerts</dt>
            <dd className="spec-desc">Get a text or email when a new role opens at a bank you follow, before it shows up on LinkedIn.</dd>
            <dd className="spec-val">Text and email</dd>
          </div>
          <div className="spec-row">
            <dt>Feed</dt>
            <dd className="spec-desc">Every analyst and intern role across {BANK_COUNT} banks in one feed, newest first.</dd>
            <dd className="spec-val tnum">Every 5 min</dd>
          </div>
          <div className="spec-row">
            <dt>Saved jobs</dt>
            <dd className="spec-desc">Bookmark roles across all banks and keep everything you&rsquo;ve applied to in one list.</dd>
            <dd className="spec-val">Free</dd>
          </div>
        </dl>
      </section>

      {/* CLOSE · one button */}
      <section className="close-cta">
        <h2 className="close-title">Stop refreshing job boards.</h2>
        <p className="close-desc">Free to browse. Upgrade to Pro for instant alerts the moment a role goes live.</p>
        <SignUpButton mode="modal">
          <button className="hero-cta-primary">Get Free Access</button>
        </SignUpButton>
        <p className="close-fine">
          No credit card required &middot; Free account in 30 seconds &middot; <Link href="/pricing" className="text-link">See pricing</Link>
        </p>
      </section>

    </div>
    </>
  );
}

// ---- PAYWALL ----
function PaywallOverlay({ isSignedIn }) {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  function handleSubscribe(plan) {
    setLoading(true);
    setSelectedPlan(plan);
    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.url) window.location.href = data.url;
      })
      .catch(() => { setLoading(false); setSelectedPlan(null); });
  }

  const ctaBtn = (plan, label, primary) =>
    isSignedIn ? (
      <button
        className={`paywall-plan-cta${primary ? " paywall-plan-cta-primary" : ""}`}
        onClick={() => handleSubscribe(plan)}
        disabled={loading}
      >
        {loading && selectedPlan === plan ? "Redirecting..." : label}
      </button>
    ) : (
      <SignUpButton mode="modal">
        <button className={`paywall-plan-cta${primary ? " paywall-plan-cta-primary" : ""}`}>
          {label}
        </button>
      </SignUpButton>
    );

  return (
    <div className="paywall">
      <div className="paywall-header">
        <div className="paywall-badge">Pro</div>
        <h2 className="paywall-title">Unlock Pro Features</h2>
        <p className="paywall-desc">
          Get SMS &amp; email alerts the moment new positions post, and save jobs across all banks.
        </p>
      </div>

      <div className="paywall-plans">
        <div className="paywall-plan">
          <h3 className="paywall-plan-name">Monthly</h3>
          <div className="paywall-plan-price">
            <span className="paywall-plan-amount">$4.99</span>
            <span className="paywall-plan-period">/mo</span>
          </div>
          <p className="paywall-plan-billing">Billed monthly</p>
          {ctaBtn("monthly", "Get Monthly", false)}
        </div>

        <div className="paywall-plan paywall-plan-popular">
          <div className="paywall-plan-tag">Best Value</div>
          <h3 className="paywall-plan-name">Yearly</h3>
          <div className="paywall-plan-price">
            <span className="paywall-plan-amount">$3.33</span>
            <span className="paywall-plan-period">/mo</span>
          </div>
          <p className="paywall-plan-billing">Billed $39.99/year</p>
          {ctaBtn("yearly", "Get Yearly", true)}
        </div>
      </div>

      <div className="paywall-includes">
        <p className="paywall-includes-label">Pro includes</p>
        <div className="paywall-includes-list">
          {["SMS text alerts", "Email alerts", "Save & bookmark jobs", "All banks"].map((item) => (
            <span className="paywall-includes-item" key={item}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {item}
            </span>
          ))}
        </div>
      </div>

      {!isSignedIn && (
        <p className="paywall-signin">
          Already subscribed?{" "}
          <SignInButton mode="modal">
            <button className="paywall-link">Sign in</button>
          </SignInButton>
        </p>
      )}

      <p className="paywall-fine">Cancel anytime &middot; <Link href="/pricing" style={{ color: "inherit" }}>See all plans</Link></p>
    </div>
  );
}

// ---- ABOUT PAGE ----
function AboutPage({ onBrowse }) {
  return (
    <div className="about-page">
      <section className="about-hero">
        <span className="hero-tag">About</span>
        <h1 className="about-title">Applying to banking internships and analyst positions sucks.</h1>
      </section>

      <section className="about-section about-section-first">
        <p className="about-text">
          I built this for myself, but after heavy demand decided to make it open to the public.
        </p>
        <p className="about-text">
          After applying to 300+ internships, I was sick of tracking new banking roles in an outdated spreadsheet and applying to roles too late.
        </p>
      </section>

      <section className="about-section">
        <h2 className="about-heading">What you get</h2>
        <p className="about-text">
          This site lets you look at each bank in one place, sourced directly from their API — so no fake listings.
        </p>
        <p className="about-text">
          For me, what was most valuable was the text alerts. You set what jobs you want text alerts for, and get a message as soon as they go live. No more stress of checking 20+ different sites.
        </p>
      </section>

      <section className="about-section">
        <h2 className="about-heading">Why it matters</h2>
        <p className="about-text">
          Most applicants find out about new postings days late — through word of mouth or a LinkedIn post from someone else. Your odds of getting an interview drop massively if you don't apply within the first few hours or days. <strong>Pro subscribers see new roles within the hour they post</strong>, before most people even know they exist.
        </p>
      </section>

      <section className="about-section about-section-last" style={{ textAlign: "center", borderTop: "none", paddingTop: "0.5rem" }}>
        <button className="hero-cta-primary" onClick={onBrowse}>Browse Active Postings</button>
      </section>
    </div>
  );
}

// ---- SKELETON ----
function SkeletonRows() {
  return (
    <div className="jobs-list">
      {Array.from({ length: 8 }).map((_, i) => (
        <div className="job-row skeleton-row" key={i}>
          <div className="skeleton skeleton-index" />
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-location" />
          <div className="skeleton skeleton-badge" />
        </div>
      ))}
    </div>
  );
}

// ---- RECENT POSTINGS VIEW ----
function NewPostingsView({ isSubscribed, isSignedIn, data, loading, onSetupAlerts }) {
  const [rpSearch, setRpSearch] = useState("");
  const [rpJobType, setRpJobType] = useState("all");
  const [rpBank, setRpBank] = useState("");
  const [rpCategory, setRpCategory] = useState("");

  if (loading) return <SkeletonRows />;

  const { last48h = [], last48hCount = 0 } = data || {};

  const availableBanks = [...new Set(last48h.map((j) => j.bank).filter(Boolean))].sort();
  const availableCategories = [...new Set(last48h.map((j) => j.category).filter(Boolean))].sort();

  const displayJobs = last48h.filter((job) => {
    if (rpSearch && !job.title.toLowerCase().includes(rpSearch.toLowerCase())) return false;
    if (rpJobType === "internship" && !isInternship(job.title)) return false;
    if (rpJobType === "fulltime" && isInternship(job.title)) return false;
    if (rpBank && job.bank !== rpBank) return false;
    if (rpCategory && job.category !== rpCategory) return false;
    return true;
  });

  const hasActiveFilter = rpSearch || rpJobType !== "all" || rpBank || rpCategory;

  function JobCard({ job, index }) {
    const effectiveTime = job.effectiveTime || job.detectedAt || 0;
    const timeLabel = formatRelativeDate(effectiveTime, job.hasActualDate);

    return (
      <a href={job.link} target="_blank" rel="noopener noreferrer" className="job-row">
        <span className="job-index">{String(index + 1).padStart(2, "0")}</span>
        <span className="job-title">{job.title}</span>
        <span className="job-location">{job.location || "—"}</span>
        <div className="job-badges">
          <span className={`job-badge ${isInternship(job.title) ? "badge-intern" : "badge-analyst"}`}>
            {isInternship(job.title) ? "Internship" : "Analyst"}
          </span>
          <span className="job-badge badge-new-time">{timeLabel}</span>
        </div>
        <span className="new-bank-label">{job.bank}</span>
        <svg className="job-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </a>
    );
  }

  const tableHeader = (
    <div className="job-row-header">
      <span className="job-index">#</span>
      <span className="job-title">Title</span>
      <span className="job-location">Location</span>
      <span className="job-badges">Type / Posted</span>
      <span className="new-bank-label" style={{ fontSize: "0.62rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-muted)" }}>Bank</span>
      <span style={{ width: 14 }} />
    </div>
  );

  return (
    <div className="new-postings-view">
      <div className="new-section">
        {!isSubscribed ? (
          <div className="new-paywall">
            <div className="new-paywall-blur">
              {[1,2,3].map(i => (
                <div className="job-row new-paywall-fake" key={i}>
                  <div className="skeleton skeleton-index" />
                  <div className="skeleton skeleton-title" />
                  <div className="skeleton skeleton-location" />
                  <div className="skeleton skeleton-badge" />
                </div>
              ))}
            </div>
            <div className="new-paywall-overlay">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <p className="new-paywall-title">
                {last48hCount > 0 ? `${last48hCount} jobs posted in the last 48 hours` : "See the freshest postings"}
              </p>
              <p className="new-paywall-desc">Upgrade to Pro to see jobs posted in the last 48 hours.</p>
              <PaywallOverlay isSignedIn={isSignedIn} />
            </div>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="filters-container">
              <div className="filters">
                <div className="search-wrapper">
                  <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                  </svg>
                  <input
                    className="search-bar"
                    type="text"
                    placeholder="Search job titles..."
                    value={rpSearch}
                    onChange={(e) => setRpSearch(e.target.value)}
                  />
                  {rpSearch && (
                    <button className="search-clear" onClick={() => setRpSearch("")}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
                <select className="filter-dropdown" value={rpBank} onChange={(e) => setRpBank(e.target.value)}>
                  <option value="">All Banks</option>
                  {availableBanks.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <select className="filter-dropdown" value={rpJobType} onChange={(e) => setRpJobType(e.target.value)}>
                  {Object.entries(JOB_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <select className="filter-dropdown" value={rpCategory} onChange={(e) => setRpCategory(e.target.value)}>
                  <option value="">All Categories</option>
                  {availableCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>

            <div className="results-bar">
              <span className="results-text">
                {displayJobs.length} {displayJobs.length === 1 ? "position" : "positions"} in the last 48 hours
              </span>
              {hasActiveFilter && (
                <button className="search-clear" style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.78rem", color: "#64748b", background: "none", border: "none", cursor: "pointer" }}
                  onClick={() => { setRpSearch(""); setRpJobType("all"); setRpBank(""); setRpCategory(""); }}>
                  Clear filters
                </button>
              )}
            </div>

            {last48h.length === 0 ? (
              <div className="empty-state" style={{ padding: "2rem" }}>
                <p className="empty-title">No new postings in the last 48 hours</p>
                <p className="empty-desc">Banks post most heavily Monday–Wednesday. Check back soon.</p>
                <button
                  style={{ marginTop: "1.25rem", padding: "0.6rem 1.5rem", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
                  onClick={onSetupAlerts}
                >
                  Set up alerts
                </button>
              </div>
            ) : displayJobs.length === 0 ? (
              <div className="empty-state" style={{ padding: "2rem" }}>
                <p className="empty-title">No results match your filters</p>
                <p className="empty-desc">Try adjusting or clearing your filters.</p>
              </div>
            ) : (
              <div className="jobs-list fade-in">
                {tableHeader}
                {displayJobs.map((job, i) => <JobCard key={job.link} job={job} index={i} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---- MAIN ----
export default function Home() {
  const { isSignedIn, isLoaded, user } = useUser();
  const clerk = useClerk();
  const router = useRouter();
  const isSubscribed = user?.publicMetadata?.subscribed === true;

  const [activeBank, setActiveBank] = useState("jpmc");
  // Keep ?bank= in sync on /jobs so a bank view can be linked to.
  useEffect(() => {
    if (typeof window === "undefined" || window.location.pathname !== "/jobs") return;
    const b = new URLSearchParams(window.location.search).get("bank");
    if (b && BANKS[b]) setActiveBank(b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (typeof window === "undefined" || window.location.pathname !== "/jobs") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("bank") !== activeBank) {
      url.searchParams.set("bank", activeBank);
      window.history.replaceState(null, "", url);
    }
  }, [activeBank]);
  const [jobType, setJobType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bankCounts, setBankCounts] = useState({});
  const [bookmarks, setBookmarks] = useState(new Set());
  const [savedJobs, setSavedJobs] = useState([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [availableLocations, setAvailableLocations] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [availableCategories, setAvailableCategories] = useState([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({ enabled: false, banks: [], categories: [], jobType: "all", smsEnabled: false, phoneNumber: "", location: "" });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);

  // ---- URL-driven views ----
  // Each view has its own route. The flags below are derived from the pathname; the
  // setView* functions keep the old call sites working by collecting the flags a handler
  // sets, then pushing the matching route once the handler finishes.
  const pathname = usePathname();
  const VIEW_BY_PATH = { "/": "home", "/jobs": "browse", "/recent": "recent", "/saved": "saved", "/notifications": "notifications", "/about": "about" };
  const routeView = VIEW_BY_PATH[pathname];
  const view = routeView === "recent" && isLoaded && !isSignedIn ? "browse" : (routeView || "browse");
  const viewHome = view === "home";
  const viewAbout = view === "about";
  const viewNewPostings = view === "recent";
  const viewNotifications = view === "notifications";
  const viewingSaved = view === "saved" || view === "notifications";

  const pendingView = useRef(null);
  function queueView(key, value) {
    if (!pendingView.current) {
      pendingView.current = { home: viewHome, about: viewAbout, recent: viewNewPostings, saved: viewingSaved, notifications: viewNotifications };
      Promise.resolve().then(() => {
        const f = pendingView.current;
        pendingView.current = null;
        const target = f.home ? "/" : f.about ? "/about" : f.recent ? "/recent" : f.notifications ? "/notifications" : f.saved ? "/saved" : "/jobs";
        if (target !== pathname) router.push(target);
      });
    }
    pendingView.current[key] = value;
  }
  const setViewHome = (v) => queueView("home", v);
  const setViewAbout = (v) => queueView("about", v);
  const setViewNewPostings = (v) => queueView("recent", v);
  const setViewingSaved = (v) => queueView("saved", v);
  const setViewNotifications = (v) => queueView("notifications", v);

  // /recent is Pro-only: signed-out visitors land on the browse view and get the sign-up sheet.
  useEffect(() => {
    if (routeView === "recent" && isLoaded && !isSignedIn) {
      router.replace("/jobs");
      clerk.openSignUp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeView, isLoaded, isSignedIn]);
  const [newPostingsData, setNewPostingsData] = useState({ last48h: [], thisWeek: [], last48hCount: 0, total: 0 });
  const [last48hCount, setLast48hCount] = useState(0);
  const [newPostingsLoading, setNewPostingsLoading] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState("");

  // Load welcome state from localStorage
  useEffect(() => {
    const welcomed = localStorage.getItem("pp-welcomed");
    if (!welcomed) setShowWelcome(true);
  }, []);

  // 8-second account prompt for anonymous users browsing outside the landing page
  useEffect(() => {
    if (!isLoaded || isSignedIn || viewHome) return;
    const dismissed = sessionStorage.getItem("pp-prompt-dismissed");
    if (dismissed) return;
    const timer = setTimeout(() => {
      if (!isSignedIn) setShowAccountPrompt(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, [isLoaded, isSignedIn, viewHome]);

  // Load saved jobs from Clerk unsafeMetadata
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    const clerkSaved = user.unsafeMetadata?.savedJobs;
    if (Array.isArray(clerkSaved) && clerkSaved.length > 0) {
      setSavedJobs(clerkSaved);
      setBookmarks(new Set(clerkSaved.map((j) => j.link)));
    } else {
      const localData = JSON.parse(localStorage.getItem("pp-saved-jobs") || "[]");
      if (localData.length > 0) {
        setSavedJobs(localData);
        setBookmarks(new Set(localData.map((j) => j.link)));
        user.update({ unsafeMetadata: { ...user.unsafeMetadata, savedJobs: localData } });
        localStorage.removeItem("pp-saved-jobs");
        localStorage.removeItem("pp-bookmarks");
      }
    }
  }, [isLoaded, isSignedIn, user]);

  // Load notification preferences
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !isSubscribed) return;
    setNotifLoading(true);
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => { if (data.notifications) setNotifPrefs(data.notifications); })
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, [isLoaded, isSignedIn, isSubscribed]);

  // Fetch 48h count on load for persistent banner
  useEffect(() => {
    if (!isLoaded) return;
    fetch("/api/jobs-new")
      .then((res) => res.json())
      .then((data) => setLast48hCount(data.last48hCount || 0))
      .catch(() => {});
  }, [isLoaded]);

  // Signed-in users skip homepage
  useEffect(() => {
    if (isLoaded && isSignedIn) setViewHome(false);
  }, [isLoaded, isSignedIn]);

  // Fetch all bank counts on load
  useEffect(() => {
    if (!isLoaded) return;
    Object.entries(BANKS).forEach(([key, bank]) => {
      fetch(bank.endpoint)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data?.jobs) {
            const filtered = data.jobs.filter((j) => !isGraduateProgram(j.title) && isFinanceRole(j.title));
            setBankCounts((prev) => ({ ...prev, [key]: filtered.length }));
          }
        })
        .catch(() => {});
    });
  }, [isLoaded]);

  // Fetch recent postings data when that view is opened
  useEffect(() => {
    if (!viewNewPostings) return;
    setNewPostingsLoading(true);
    fetch("/api/jobs-new")
      .then((res) => res.json())
      .then((data) => {
        setNewPostingsData(data);
        setLast48hCount(data.last48hCount || 0);
      })
      .catch(() => {})
      .finally(() => setNewPostingsLoading(false));
  }, [viewNewPostings]);

  // Fetch jobs when bank changes
  useEffect(() => {
    setViewingSaved(false);
    setViewNotifications(false);
    setViewNewPostings(false);

    if (!FREE_BANKS.has(activeBank) && (!isSignedIn || !isSubscribed)) {
      setJobs([]);
      setLoading(false);
      return;
    }

    if (!isLoaded) return;

    setLoading(true);
    setError(null);
    setJobs([]);
    setSearchQuery("");
    setLocationFilter("");
    setCategoryFilter("");
    setShowSavedOnly(false);

    const controller = new AbortController();

    fetch(BANKS[activeBank].endpoint, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch jobs");
        return res.json();
      })
      .then((data) => {
        const filtered = data.jobs.filter((j) => !isGraduateProgram(j.title) && isFinanceRole(j.title));
        setJobs(filtered);
        setBankCounts((prev) => ({ ...prev, [activeBank]: filtered.length }));

        const locs = [...new Set(
          data.jobs.flatMap((job) => (job.location || "").split(";").map((l) => l.trim())).filter(Boolean)
        )].sort();
        setAvailableLocations(locs);

        const cats = [...new Set(data.jobs.map((job) => job.category).filter(Boolean))].sort();
        setAvailableCategories(cats);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [activeBank, isSignedIn, isSubscribed, isLoaded]);

  function toggleBookmark(e, job) {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) { clerk.openSignUp(); return; }
    if (!isSubscribed) { setViewingSaved(true); setViewNotifications(false); return; }
    const link = job.link;
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(link)) next.delete(link); else next.add(link);
      return next;
    });
    setSavedJobs((prev) => {
      let next;
      if (prev.some((j) => j.link === link)) {
        next = prev.filter((j) => j.link !== link);
      } else {
        next = [...prev, { title: job.title, link: job.link, location: job.location || "", bank: BANKS[activeBank]?.name || "" }];
      }
      user.update({ unsafeMetadata: { ...user.unsafeMetadata, savedJobs: next } });
      return next;
    });
  }

  function dismissWelcome() {
    setShowWelcome(false);
    localStorage.setItem("pp-welcomed", "true");
  }

  function dismissAccountPrompt() {
    setShowAccountPrompt(false);
    sessionStorage.setItem("pp-prompt-dismissed", "true");
  }

  function toggleNotifBank(bankKey) {
    setNotifPrefs((prev) => ({
      ...prev,
      banks: prev.banks.includes(bankKey) ? prev.banks.filter((b) => b !== bankKey) : [...prev.banks, bankKey],
    }));
    setNotifSaved(false);
  }

  function toggleNotifCategory(cat) {
    setNotifPrefs((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat) ? prev.categories.filter((c) => c !== cat) : [...prev.categories, cat],
    }));
    setNotifSaved(false);
  }

  function saveNotifPrefs() {
    setNotifSaving(true);
    setNotifSaved(false);
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notifPrefs),
    })
      .then((res) => res.json())
      .then((data) => { if (data.success) setNotifSaved(true); })
      .catch(() => {})
      .finally(() => setNotifSaving(false));
  }

  const filteredJobs = jobs.filter((job) => {
    const matchesType = jobType === "all" ? true : jobType === "internship" ? isInternship(job.title) : !isInternship(job.title);
    const matchesSearch = searchQuery === "" || job.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation = locationFilter === "" || (job.location || "").toLowerCase().includes(locationFilter.toLowerCase());
    const matchesCategory = categoryFilter === "" || (job.category || "") === categoryFilter;
    return matchesType && matchesSearch && matchesLocation && matchesCategory;
  });

  const displayJobs = showSavedOnly ? filteredJobs.filter((job) => bookmarks.has(job.link)) : filteredJobs;
  const savedCount = [...bookmarks].filter((link) => filteredJobs.some((job) => job.link === link)).length;
  const isGatedBank = !FREE_BANKS.has(activeBank) && (!isSignedIn || !isSubscribed);

  // Homepage: the root background goes dark so overscroll above the hero shows navy, not cream.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-dark-top", viewHome);
    return () => document.documentElement.removeAttribute("data-dark-top");
  }, [viewHome]);

  // Nav sits transparent over the dark homepage hero; frosts once the page scrolls.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { setScrolled(window.scrollY > 24); raf = 0; });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // ---- Sidebar (shared by the browse and recent views) ----
  const BULGE = ["jpmc", "gs", "ms", "bofa", "citi", "db", "barclays"];
  const bankQuery = bankSearch.trim().toLowerCase();
  const matchesBank = (bank) => !bankQuery || bank.name.toLowerCase().includes(bankQuery) || bank.shortName.toLowerCase().includes(bankQuery);
  // Keep source order, but sink banks with zero open roles to the end of their group.
  const orderBanks = (keys) => {
    const known = keys.filter((k) => bankCounts[k] === undefined || bankCounts[k] > 0);
    const empty = keys.filter((k) => bankCounts[k] === 0);
    return [...known, ...empty];
  };
  const bankGroups = bankQuery
    ? [{ label: null, keys: Object.keys(BANKS).filter((k) => matchesBank(BANKS[k])) }]
    : [
        { label: "Bulge bracket", keys: orderBanks(BULGE) },
        { label: "More banks", keys: orderBanks(Object.keys(BANKS).filter((k) => !BULGE.includes(k))) },
      ];
  const totalOpen = Object.values(bankCounts).reduce((sum, c) => sum + c, 0);
  const countsLoaded = Object.keys(bankCounts).length;

  const renderBankRow = (key) => {
    const bank = BANKS[key];
    const needsAuth = !FREE_BANKS.has(key) && (!isSignedIn || !isSubscribed);
    const count = bankCounts[key];
    const isActive = activeBank === key && !viewingSaved && !viewNewPostings;
    return (
      <button
        key={key}
        className={`sidebar-item${isActive ? " sidebar-item-active" : ""}${needsAuth ? " sidebar-item-locked" : ""}${count === 0 ? " sidebar-item-empty" : ""}`}
        onClick={() => { setViewingSaved(false); setViewNotifications(false); setViewNewPostings(false); setActiveBank(key); }}
        aria-current={isActive ? "page" : undefined}
      >
        <span><span className="bank-name-full">{bank.name}</span><span className="bank-name-short">{bank.shortName}</span></span>
        {needsAuth ? (
          <svg className="sidebar-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        ) : count === undefined ? (
          <span className="sidebar-count sidebar-count-pending" aria-label="Loading">&middot;&middot;&middot;</span>
        ) : (
          <span className="sidebar-count tnum">{count}</span>
        )}
      </button>
    );
  };

  const sidebar = (
    <aside className="sidebar" aria-label="Banks and Pro features">
      <div className="sidebar-header">
        <span>Banks</span>
        {countsLoaded > 0 && <span className="sidebar-total tnum">{totalOpen} open</span>}
      </div>
      <div className="bank-search-wrap">
        <svg className="bank-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          className="bank-search-input"
          type="text"
          placeholder="Find a bank"
          aria-label="Find a bank"
          value={bankSearch}
          onChange={(e) => setBankSearch(e.target.value)}
        />
        {bankSearch && (
          <button className="bank-search-clear" onClick={() => setBankSearch("")} aria-label="Clear">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      <div className="sidebar-banks">
        {bankGroups.map((group) => (
          <div key={group.label || "results"} className="sidebar-group">
            {group.label && <div className="sidebar-group-label">{group.label}</div>}
            {group.keys.length === 0 ? (
              <p className="sidebar-empty">No bank matches &ldquo;{bankSearch.trim()}&rdquo;</p>
            ) : group.keys.map(renderBankRow)}
          </div>
        ))}
      </div>

      <div className="sidebar-divider" />
      <div className="sidebar-header">
        <span>Pro</span>
        {!isSubscribed && <Link href="/pricing" className="sidebar-pro-pill">Upgrade</Link>}
      </div>
      <button
        className={`sidebar-item${viewNewPostings ? " sidebar-item-active" : ""}${!isSubscribed ? " sidebar-item-locked" : ""}`}
        onClick={() => {
          if (!isSubscribed) { router.push("/pricing"); return; }
          setViewNewPostings(true); setViewingSaved(false); setViewNotifications(false); setViewHome(false);
        }}
      >
        <span className="sidebar-saved-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          Recent postings
        </span>
        {!isSubscribed ? (
          last48hCount > 0 ? <span className="sidebar-count sidebar-count-teaser tnum">{last48hCount} new</span> : <svg className="sidebar-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        ) : last48hCount > 0 ? <span className="sidebar-count tnum">{last48hCount}</span> : null}
      </button>
      <button
        className={`sidebar-item${viewingSaved && !viewNotifications ? " sidebar-item-active" : ""}${!isSubscribed ? " sidebar-item-locked" : ""}`}
        onClick={() => {
          if (!isSignedIn) { clerk.openSignUp(); return; }
          if (!isSubscribed) { setViewingSaved(true); setViewNotifications(false); return; }
          setViewingSaved(true); setViewNotifications(false); setSearchQuery(""); setLocationFilter(""); setJobType("all");
        }}
      >
        <span className="sidebar-saved-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill={viewingSaved && !viewNotifications ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          Saved jobs
        </span>
        {!isSubscribed ? <svg className="sidebar-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> : savedJobs.length > 0 && <span className="sidebar-count tnum">{savedJobs.length}</span>}
      </button>
      <button
        className={`sidebar-item${viewNotifications ? " sidebar-item-active" : ""}${!isSubscribed ? " sidebar-item-locked" : ""}`}
        onClick={() => {
          if (!isSignedIn) { clerk.openSignUp(); return; }
          if (!isSubscribed) { setViewNotifications(true); setViewingSaved(true); return; }
          setViewNotifications(true); setViewingSaved(true);
        }}
      >
        <span className="sidebar-saved-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill={viewNotifications ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          Notifications
        </span>
        {!isSubscribed ? <svg className="sidebar-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> : notifPrefs.enabled ? <span className="sidebar-notif-dot" /> : null}
      </button>
      <span className="sidebar-scroll-arrow" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </span>
    </aside>
  );

  if (!routeView) notFound();

  if (!isLoaded) {
    return (
      <div className="loading-state">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <nav className={viewHome && !scrolled ? "nav-on-dark" : ""}>
        <div className="nav-inner">
          <Link href="/" className="logo logo-link" aria-label="Pete's Postings home">
            <svg className="logo-icon" width="30" height="30" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="var(--navy)"/>
              <text x="16" y="23" textAnchor="middle" fontFamily="inherit" fontWeight="800" fontSize="20" fill="#fff">P</text>
            </svg>
            <span className="logo-text">Pete&rsquo;s Postings</span>
          </Link>
          <div className="nav-center">
            <Link href="/jobs" className={`nav-link${view === "browse" ? " nav-link-active" : ""}`}>Browse Jobs</Link>
            <Link
              href="/recent"
              className={`nav-link nav-link-new${viewNewPostings ? " nav-link-active" : ""}`}
              onClick={(e) => {
                if (!isSignedIn) { e.preventDefault(); clerk.openSignUp(); return; }
                if (!isSubscribed) { e.preventDefault(); router.push("/pricing"); }
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              Recent Postings
            </Link>
            <Link href="/pricing" className="nav-link">Pricing</Link>
            <Link href="/about" className={`nav-link${viewAbout ? " nav-link-active" : ""}`}>About</Link>
          </div>
          <div className="nav-right">
            {isSignedIn && (
              <button
                className={`nav-bell${viewNotifications ? " nav-bell-active" : ""}`}
                onClick={() => { setViewHome(false); setViewAbout(false); setViewNewPostings(false); setViewingSaved(true); setViewNotifications(true); }}
                title="Notifications"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {(notifPrefs.enabled || notifPrefs.smsEnabled) && <span className="nav-bell-dot" />}
              </button>
            )}
            {isSignedIn ? (
              <UserButton />
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="nav-signin">Sign in</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="nav-cta">Get free access</button>
                </SignUpButton>
              </>
            )}
          </div>
        </div>
      </nav>

      {viewHome && !viewAbout && !viewNewPostings && (
        <HomePage
          onBrowse={() => router.push("/jobs")}
          isSignedIn={isSignedIn}
          last48hCount={last48hCount}
        />
      )}

      {viewAbout && !viewNewPostings && (
        <AboutPage onBrowse={() => router.push("/jobs")} />
      )}

      {isSignedIn && viewNewPostings && (
        <div className="app-layout">
          {/* Mobile top bar — replaces sidebar on mobile */}
          <div className="mobile-top-bar">
            <div className="mobile-top-bar-bank-row">
              <select
                className="mobile-bank-select"
                value={activeBank}
                onChange={(e) => {
                  setViewNewPostings(false);
                  setViewingSaved(false);
                  setViewNotifications(false);
                  setViewHome(false);
                  setActiveBank(e.target.value);
                }}
              >
                {Object.entries(BANKS).map(([key, bank]) => (
                  <option key={key} value={key}>{bank.name}</option>
                ))}
              </select>
            </div>
            <div className="mobile-top-bar-pro-row">
              <button
                className="mobile-pro-pill mobile-pro-pill-active"
                onClick={() => {
                  if (!isSubscribed) { router.push("/pricing"); return; }
                  setViewNewPostings(true); setViewingSaved(false); setViewNotifications(false); setViewHome(false);
                }}
              >
                ⚡ Last 48h
              </button>
              <button
                className={`mobile-pro-pill${!isSubscribed ? " mobile-pro-pill-locked" : ""}`}
                onClick={() => {
                  if (!isSignedIn) { clerk.openSignUp(); return; }
                  if (!isSubscribed) { router.push("/pricing"); return; }
                  setViewNewPostings(false); setViewingSaved(true); setViewNotifications(false); setViewHome(false);
                }}
              >
                Saved
              </button>
              <button
                className={`mobile-pro-pill${!isSubscribed ? " mobile-pro-pill-locked" : ""}`}
                onClick={() => {
                  if (!isSignedIn) { clerk.openSignUp(); return; }
                  if (!isSubscribed) { router.push("/pricing"); return; }
                  setViewNewPostings(false); setViewingSaved(true); setViewNotifications(true); setViewHome(false);
                }}
              >
                Alerts
              </button>
            </div>
          </div>
          {/* Sidebar — same as normal view */}
          {sidebar}

          <main className="content">
            <div className="new-postings-header">
              <h1 className="new-postings-page-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
                Recent Postings
              </h1>
              <p className="new-postings-page-desc">
                Jobs posted in the last 48 hours across all banks. Apply early — roles fill fast.
              </p>
            </div>
            <NewPostingsView
              isSubscribed={isSubscribed}
              isSignedIn={isSignedIn}
              data={newPostingsData}
              loading={newPostingsLoading}
              onSetupAlerts={() => { setViewingSaved(true); setViewNotifications(true); setViewNewPostings(false); }}
            />
          </main>
        </div>
      )}

      {!viewHome && !viewAbout && !viewNewPostings && (
        <div className="app-layout">
          {/* Mobile top bar — replaces sidebar on mobile */}
          <div className="mobile-top-bar">
            <div className="mobile-top-bar-bank-row">
              <select
                className="mobile-bank-select"
                value={activeBank}
                onChange={(e) => {
                  setViewingSaved(false);
                  setViewNotifications(false);
                  setViewNewPostings(false);
                  setActiveBank(e.target.value);
                }}
              >
                {Object.entries(BANKS).map(([key, bank]) => (
                  <option key={key} value={key}>{bank.name}</option>
                ))}
              </select>
            </div>
            <div className="mobile-top-bar-pro-row">
              <button
                className={`mobile-pro-pill${viewNewPostings ? " mobile-pro-pill-active" : ""}${!isSubscribed ? " mobile-pro-pill-locked" : ""}`}
                onClick={() => {
                  if (!isSubscribed) { router.push("/pricing"); return; }
                  setViewNewPostings(true); setViewingSaved(false); setViewNotifications(false); setViewHome(false);
                }}
              >
                ⚡ Last 48h
              </button>
              <button
                className={`mobile-pro-pill${viewingSaved && !viewNotifications ? " mobile-pro-pill-active" : ""}${!isSubscribed ? " mobile-pro-pill-locked" : ""}`}
                onClick={() => {
                  if (!isSignedIn) { clerk.openSignUp(); return; }
                  if (!isSubscribed) { router.push("/pricing"); return; }
                  setViewingSaved(true); setViewNotifications(false); setSearchQuery(""); setLocationFilter(""); setJobType("all");
                }}
              >
                Saved
              </button>
              <button
                className={`mobile-pro-pill${viewNotifications ? " mobile-pro-pill-active" : ""}${!isSubscribed ? " mobile-pro-pill-locked" : ""}`}
                onClick={() => {
                  if (!isSignedIn) { clerk.openSignUp(); return; }
                  if (!isSubscribed) { router.push("/pricing"); return; }
                  setViewingSaved(true); setViewNotifications(true);
                }}
              >
                Alerts
              </button>
            </div>
          </div>
          {/* SIDEBAR */}
          {sidebar}

          {/* MAIN CONTENT */}
          <main className="content">
            {/* Notifications view */}
            {viewNotifications && !isSubscribed && <PaywallOverlay isSignedIn={isSignedIn} />}
            {viewNotifications && isSubscribed && (
              <div className="notif-panel">
                <div className="notif-header">
                  <h2 className="notif-title">Manage Notifications</h2>
                  <p className="notif-desc">Get notified when new jobs matching your preferences are posted. We check daily.</p>
                </div>
                {notifLoading ? (
                  <div className="loading-state" style={{ padding: "3rem" }}><div className="spinner" /></div>
                ) : (
                  <>
                    <div className="notif-section">
                      <div className="notif-toggle-row">
                        <span className="notif-toggle-label">Email notifications</span>
                        <button
                          className={`notif-toggle ${notifPrefs.enabled ? "notif-toggle-on" : ""}`}
                          onClick={() => { setNotifPrefs((p) => ({ ...p, enabled: !p.enabled })); setNotifSaved(false); }}
                        >
                          <span className="notif-toggle-knob" />
                        </button>
                      </div>
                    </div>

                    <div className="notif-section">
                      <div className="notif-toggle-row">
                        <div>
                          <span className="notif-toggle-label">SMS notifications</span>
                          <p className="notif-section-desc" style={{ margin: "0.2rem 0 0" }}>Get a text when new matching jobs are posted.</p>
                        </div>
                        <button
                          className={`notif-toggle ${notifPrefs.smsEnabled ? "notif-toggle-on" : ""}`}
                          onClick={() => { setNotifPrefs((p) => ({ ...p, smsEnabled: !p.smsEnabled })); setNotifSaved(false); }}
                        >
                          <span className="notif-toggle-knob" />
                        </button>
                      </div>
                      {notifPrefs.smsEnabled && (
                        <div style={{ marginTop: "0.875rem" }}>
                          <label className="notif-section-title" style={{ display: "block", marginBottom: "0.4rem" }}>Phone number</label>
                          <input
                            className="notif-phone-input"
                            type="tel"
                            placeholder="+1 (555) 000-0000"
                            value={notifPrefs.phoneNumber || ""}
                            onChange={(e) => { setNotifPrefs((p) => ({ ...p, phoneNumber: e.target.value })); setNotifSaved(false); }}
                          />
                          <p style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "0.5rem", lineHeight: 1.5 }}>
                            By enabling SMS, you agree to receive transactional job alert messages from Pete's Postings. Reply <strong>STOP</strong> to unsubscribe at any time. Reply <strong>HELP</strong> for help. Message and data rates may apply.
                          </p>
                        </div>
                      )}
                    </div>

                    {(notifPrefs.enabled || notifPrefs.smsEnabled) && (
                      <>
                        <div className="notif-section">
                          <h3 className="notif-section-title">Banks</h3>
                          <p className="notif-section-desc">Select which banks to get alerts for. Leave empty for all banks.</p>
                          <div className="notif-checkboxes">
                            {Object.entries(BANKS).map(([key, bank]) => (
                              <label className="notif-checkbox" key={key}>
                                <input type="checkbox" checked={notifPrefs.banks.includes(key)} onChange={() => toggleNotifBank(key)} />
                                <span>{bank.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="notif-section">
                          <h3 className="notif-section-title">Categories</h3>
                          <p className="notif-section-desc">Select which categories to get alerts for. Leave empty for all categories.</p>
                          <div className="notif-checkboxes">
                            {["Investment Banking", "Sales & Trading", "Risk & Compliance", "Technology", "Wealth Management", "Research", "Operations", "Corporate Banking", "Finance", "Human Resources", "Legal", "Quantitative", "Other"].map((cat) => (
                              <label className="notif-checkbox" key={cat}>
                                <input type="checkbox" checked={notifPrefs.categories.includes(cat)} onChange={() => toggleNotifCategory(cat)} />
                                <span>{cat}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="notif-section">
                          <h3 className="notif-section-title">Job Type</h3>
                          <div className="notif-radio-group">
                            {[["all", "All Types"], ["internship", "Internship Only"], ["fulltime", "Analyst Only"]].map(([val, label]) => (
                              <label className="notif-radio" key={val}>
                                <input type="radio" name="notifJobType" value={val} checked={notifPrefs.jobType === val} onChange={() => { setNotifPrefs((p) => ({ ...p, jobType: val })); setNotifSaved(false); }} />
                                <span>{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="notif-section">
                          <h3 className="notif-section-title">Location</h3>
                          <p className="notif-section-desc">Only get alerts for jobs in a specific city. Leave blank for all locations.</p>
                          <input
                            className="notif-phone-input"
                            type="text"
                            placeholder="e.g. New York, Chicago, Houston..."
                            value={notifPrefs.location || ""}
                            onChange={(e) => { setNotifPrefs((p) => ({ ...p, location: e.target.value })); setNotifSaved(false); }}
                          />
                        </div>
                      </>
                    )}
                    <div className="notif-actions">
                      <button className="notif-save" onClick={saveNotifPrefs} disabled={notifSaving}>
                        {notifSaving ? "Saving..." : notifSaved ? "Saved" : "Save Preferences"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Saved jobs view */}
            {viewingSaved && !viewNotifications && !isSubscribed && <PaywallOverlay isSignedIn={isSignedIn} />}
            {viewingSaved && !viewNotifications && isSubscribed && (
              <>
                <div className="results-bar">
                  <span className="results-text">{savedJobs.length} saved {savedJobs.length === 1 ? "job" : "jobs"}</span>
                </div>
                {savedJobs.length === 0 && (
                  <div className="empty-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                    <p className="empty-title">No saved jobs yet</p>
                    <p className="empty-desc">Bookmark jobs from any bank to see them here.</p>
                  </div>
                )}
                {savedJobs.length > 0 && (
                  <div className="jobs-list fade-in">
                    <div className="job-row-header">
                      <span className="job-index">#</span>
                      <span className="job-title">Title</span>
                      <span className="job-location">Bank</span>
                      <span className="job-badges">Location</span>
                      <span style={{ width: 14 }} />
                      <span style={{ width: 14 }} />
                    </div>
                    {savedJobs.map((job, index) => (
                      <a href={job.link} target="_blank" rel="noopener noreferrer" className={`job-row${job.expiredAt ? " job-row-expired" : ""}`} key={job.link}>
                        <span className="job-index">{String(index + 1).padStart(2, "0")}</span>
                        <span className="job-title">{job.title}</span>
                        <span className="job-location"><span className="saved-bank-badge">{job.bank}</span></span>
                        <div className="job-badges">
                          {job.expiredAt && <span className="job-badge badge-intern" title="No longer live on the bank's site">Expired</span>}
                          <span className="job-badge" title={job.location}>{job.location || "—"}</span>
                        </div>
                        <button className="job-bookmark job-bookmark-active" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleBookmark(e, job); }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                          </svg>
                        </button>
                        <svg className="job-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Bank jobs view */}
            {!viewingSaved && !viewNotifications && (
              <>
                {!isSubscribed && last48hCount > 0 && (
                  <div className="recent-teaser-strip">
                    <span className="recent-teaser-content">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                      </svg>
                      <strong>{last48hCount}</strong> {last48hCount === 1 ? "job" : "jobs"} posted in the last 48 hours
                    </span>
                    <button className="recent-teaser-cta" onClick={() => router.push("/pricing")}>
                      See them →
                    </button>
                  </div>
                )}
                {showWelcome && !isGatedBank && !isSubscribed && (
                  <div className="welcome-banner">
                    <div>
                      <p className="welcome-title">Welcome to Pete's Postings</p>
                      <p className="welcome-desc">
                        Live postings from 20 banks. Hit <strong>⚡ Recent</strong> to see everything posted in the last 7 days — or upgrade to Pro for SMS &amp; email alerts the moment a role goes live.
                      </p>
                    </div>
                    <button className="welcome-dismiss" onClick={dismissWelcome}>Got it</button>
                  </div>
                )}

                {/* Filters */}
                {!isGatedBank && (
                  <div className="filters-container">
                    <button className="filters-toggle-mobile" onClick={() => setMobileFiltersOpen((v) => !v)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="12" y1="18" x2="20" y2="18"/>
                      </svg>
                      Filters
                      {(searchQuery || locationFilter || jobType !== "all" || categoryFilter) && (
                        <span className="filters-active-dot" />
                      )}
                    </button>
                    <div className={`filters${mobileFiltersOpen ? " filters-mobile-open" : ""}`}>
                      <div className="search-wrapper">
                        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                        </svg>
                        <input
                          className="search-bar"
                          type="text"
                          placeholder="Search job titles..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                          <button className="search-clear" onClick={() => setSearchQuery("")}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6 6 18M6 6l12 12"/>
                            </svg>
                          </button>
                        )}
                      </div>
                      <select className="filter-dropdown" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
                        <option value="">All Locations</option>
                        {availableLocations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                      </select>
                      <select className="filter-dropdown" value={jobType} onChange={(e) => setJobType(e.target.value)}>
                        {Object.entries(JOB_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                      </select>
                      <select className="filter-dropdown" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                        <option value="">All Categories</option>
                        {availableCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {!isGatedBank && !loading && !error && (
                  <div className="results-bar">
                    <span className="results-text">
                      {displayJobs.length} {displayJobs.length === 1 ? "position" : "positions"} at {BANKS[activeBank].name}
                    </span>
                    <button className={`saved-toggle ${viewingSaved ? "saved-toggle-active" : ""}`} onClick={() => {
                      if (!isSignedIn) { clerk.openSignUp(); return; }
                      setViewingSaved(true); setViewNotifications(false); setSearchQuery(""); setLocationFilter(""); setJobType("all");
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill={viewingSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                      Saved{savedJobs.length > 0 ? ` (${savedJobs.length})` : ""}
                    </button>
                  </div>
                )}

                {isGatedBank && <PaywallOverlay isSignedIn={isSignedIn} />}
                {error && <div className="error-banner">Something went wrong: {error}</div>}
                {!isGatedBank && loading && (
                  <>
                    <div style={{ padding: "12px 16px 4px", fontSize: "13px", color: "#94a3b8" }}>
                      Calling {BANKS[activeBank].name} API to pull accurate jobs...
                    </div>
                    <SkeletonRows />
                  </>
                )}

                {!isGatedBank && !loading && !error && displayJobs.length === 0 && (
                  <div className="empty-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                    </svg>
                    <p className="empty-title">No matching positions</p>
                    <p className="empty-desc">Try adjusting your filters or search terms.</p>
                  </div>
                )}

                {!isGatedBank && !loading && !error && displayJobs.length > 0 && (
                  <div className="jobs-list fade-in">
                    <div className="job-row-header">
                      <span className="job-index">#</span>
                      <span className="job-title">Title</span>
                      <span className="job-location">Location</span>
                      <span className="job-badges">Type</span>
                      <span style={{ width: 14 }} />
                      <span style={{ width: 14 }} />
                    </div>
                    {displayJobs.map((job, index) => (
                      <a href={job.link} target="_blank" rel="noopener noreferrer" className="job-row" key={index}>
                        <span className="job-index">{String(index + 1).padStart(2, "0")}</span>
                        <span className="job-title">{job.title}</span>
                        <span className="job-location">{job.location || "—"}</span>
                        <div className="job-badges">
                          <span className={`job-badge ${isInternship(job.title) ? "badge-intern" : "badge-analyst"}`}>
                            {isInternship(job.title) ? "Internship" : "Analyst"}
                          </span>
                        </div>
                        <button className={`job-bookmark ${bookmarks.has(job.link) ? "job-bookmark-active" : ""}`} onClick={(e) => toggleBookmark(e, job)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={bookmarks.has(job.link) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                          </svg>
                        </button>
                        <svg className="job-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      )}

      <footer>
        <div className="footer-inner">
          <div className="footer-left">
            <span className="footer-brand">Pete's Postings</span>
            <p>Data sourced from public careers APIs. Not affiliated with any listed company.</p>
          </div>
          <div className="footer-right">
            <p>Pulled live from bank career sites &middot; Checked every 5 minutes</p>
            <p>&copy; 2026 Pete's Postings</p>
          </div>
        </div>
      </footer>

      {showAccountPrompt && !isSignedIn && !viewHome && (
        <AccountPromptModal onClose={dismissAccountPrompt} last48hCount={last48hCount} />
      )}
    </>
  );
}
