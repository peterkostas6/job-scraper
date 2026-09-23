"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, notFound } from "next/navigation";
import { useUser, useClerk, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { BANKS } from "@/lib/banks";

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

// "Sep 18" from the bank's posted date, or "Sep 18, 9:55 PM" when all we have is the
// minute our cron first saw it. Banks publish a date, not a time, so the date alone is honest.
function formatPostedAt(job) {
  if (job.postedDate) {
    return new Date(job.postedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (job.detectedAt) {
    const d = new Date(job.detectedAt);
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  return "—";
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
// Every posting is US-based, so ", United States" only pushes the city out of view.
const cleanLocation = (loc) => (loc || "").replace(/,\s*United States( of America)?/gi, "").trim();
const NOTIF_CATEGORIES = ["Investment Banking", "Sales & Trading", "Risk & Compliance", "Technology", "Wealth Management", "Research", "Operations", "Corporate Banking", "Finance", "Human Resources", "Legal", "Quantitative", "Other"];

const PREVIEW_JOBS = [
  { title: "Investment Banking Analyst", bank: "Goldman Sachs", location: "New York, NY", time: "1h ago", isNew: true, type: "Analyst" },
  { title: "Summer Analyst Program 2026", bank: "JPMorgan Chase", location: "New York, NY", time: "2h ago", isNew: true, type: "Internship" },
  { title: "Credit Analyst, Fixed Income", bank: "Morgan Stanley", location: "Chicago, IL", time: "4h ago", isNew: false, type: "Analyst" },
  { title: "M&A Analyst", bank: "Barclays", location: "New York, NY", time: "7h ago", isNew: false, type: "Analyst" },
  { title: "Risk Analyst", bank: "Bank of America", location: "Charlotte, NC", time: "11h ago", isNew: false, type: "Analyst" },
];

const HERO_NOTIFS = [
  { bank: "Goldman Sachs", title: "Investment Banking Analyst 2026" },
  { bank: "JPMorgan Chase", title: "Summer Analyst Program 2026" },
  { bank: "Morgan Stanley", title: "M&A Analyst, Fixed Income" },
  { bank: "Barclays", title: "Investment Banking Analyst" },
];

const TESTIMONIALS = [
  {
    quote: "My school doesn’t get bulge-bracket recruiters on campus, so I used to hear about openings secondhand, usually too late. Now I see the same postings as everyone else, the same day they go up.",
    name: "Jordan M.",
    role: "Junior, University of Delaware",
  },
  {
    quote: "I don’t have connections at these banks. Getting a text the moment a role opens means I’m not relying on someone else to tip me off.",
    name: "Priya S.",
    role: "Sophomore, University of Illinois Chicago",
  },
  {
    quote: "Kids at target schools find out about roles through clubs and info sessions I’ve never been invited to. This is the closest I’ve gotten to an even playing field.",
    name: "Marcus T.",
    role: "Junior, Rutgers University",
  },
  {
    quote: "I go to a state school with no investment banking club. I didn’t even know half of these roles existed until I started getting the alerts.",
    name: "Sam O.",
    role: "Senior, University of Massachusetts Amherst",
  },
  {
    quote: "Postings disappear fast. Getting them straight from the bank instead of a forwarded email three days late actually mattered.",
    name: "Elena V.",
    role: "Junior, Temple University",
  },
  {
    quote: "I applied to a Citi analyst posting a few minutes after it went up. Got an interview the following week. I don’t think that happens if I’m only checking once a day.",
    name: "Tyler B.",
    role: "Sophomore, Indiana University",
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

  // Stat-Led reveal: tick the hero figure from 0 to the live count over ~2.2s, then pop it.
  const hasCount = last48hCount > 0;
  const [shownCount, setShownCount] = useState(0);
  const [countDone, setCountDone] = useState(false);
  const [photoOk, setPhotoOk] = useState(true);

  // Hero notification banner: loops through mock "you just got a text" alerts
  const [heroNotifIndex, setHeroNotifIndex] = useState(0);
  const [heroNotifVisible, setHeroNotifVisible] = useState(false);
  useEffect(() => {
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let alive = true;
    let timer;
    if (reduceMotion) {
      timer = setTimeout(() => { if (alive) setHeroNotifVisible(true); }, 900);
      return () => { alive = false; clearTimeout(timer); };
    }
    const HOLD_MS = 4200;
    const GAP_MS = 1400;
    const cycle = () => {
      if (!alive) return;
      setHeroNotifVisible(true);
      timer = setTimeout(() => {
        if (!alive) return;
        setHeroNotifVisible(false);
        timer = setTimeout(() => {
          if (!alive) return;
          setHeroNotifIndex((i) => (i + 1) % HERO_NOTIFS.length);
          cycle();
        }, GAP_MS);
      }, HOLD_MS);
    };
    timer = setTimeout(cycle, 1000);
    return () => { alive = false; clearTimeout(timer); };
  }, []);
  const heroNotif = HERO_NOTIFS[heroNotifIndex];
  useEffect(() => {
    if (!hasCount) return;
    setCountDone(false);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShownCount(last48hCount); setCountDone(true); return; }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 2200);
      const eased = 1 - Math.pow(1 - t, 3);
      setShownCount(Math.round(last48hCount * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setCountDone(true);
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
          Get <mark className="hero-mark">a text</mark> the instant a bank posts your job.
        </h1>
        {isSignedIn ? (
          <button className="hero-photo-cta" onClick={onBrowse}>Browse jobs</button>
        ) : (
          <SignUpButton mode="modal">
            <button className="hero-photo-cta">Get free access</button>
          </SignUpButton>
        )}
        <p className="hero-photo-links">
          <button className="hero-photo-link tnum" onClick={onBrowse}>
            {hasCount ? (
              <>
                <span className={`count-pop${countDone ? " count-pop-done" : ""}`}>{shownCount}</span> new roles in the last 48 hours
              </>
            ) : (
              `${BANK_COUNT} bank career sites, updated instantly`
            )}
          </button>
          <span className="hero-photo-dot" aria-hidden="true">&middot;</span>
          <Link href="/pricing" className="hero-photo-link">See pricing</Link>
        </p>
      </div>

      {/* Animated "you just got a text" banner — styled as an iPhone Messages notification */}
      <div className={`hero-notif${heroNotifVisible ? ' hero-notif-visible' : ''}`} aria-hidden="true">
        <div className="hero-notif-icon">
          <svg width="26" height="26" viewBox="0 0 64 64" fill="white" aria-hidden="true">
            <path d="M32 9C17.6 9 6 18.4 6 30c0 6.1 3.3 11.7 8.6 15.6-.5 3.7-2 7.2-4.5 10.1-.3.4 0 1 .5 1 5.5-.5 10.6-2.4 14.6-5.4C27.4 51.7 29.7 52 32 52c14.4 0 26-9.4 26-21S46.4 9 32 9z"/>
          </svg>
        </div>
        <div className="hero-notif-body">
          <div className="hero-notif-header">
            <span className="hero-notif-app">Messages</span>
            <span className="hero-notif-time">now</span>
          </div>
          <div className="hero-notif-title">Pete&rsquo;s Postings</div>
          <div className="hero-notif-text">
            {heroNotif.bank} just posted &mdash; {heroNotif.title}. Tap to apply &rarr;
          </div>
        </div>
      </div>
    </section>

    <div className="homepage">

      {/* WHAT YOU GET + DEMO · side by side on desktop */}
      <div className="spec-demo">
      <section className="spec">
        <h2 className="spec-title">Recruiting doesn&rsquo;t wait for you to refresh a career site.</h2>
        <p className="spec-intro">
          Banking role postings can surprise you at random hours across dozens of banks, then get pulled
          again within days. If you&rsquo;re checking one site at a time, you&rsquo;re already behind.
        </p>
        <dl className="spec-sheet">
          <div className="spec-row">
            <dt>One spot</dt>
            <dd className="spec-desc">We pull every analyst and intern posting directly from banks&rsquo; APIs — no more checking dozens of career sites by hand.</dd>
            <dd className="spec-val">Instant</dd>
          </div>
          <div className="spec-row">
            <dt>48-hour feed</dt>
            <dd className="spec-desc">See every role the moment it&rsquo;s posted, not just what&rsquo;s still live. Candidates who apply within 24&ndash;48 hours see a 33% higher chance of landing an interview.</dd>
            <dd className="spec-val">+33% interview odds</dd>
          </div>
          <div className="spec-row">
            <dt>Alerts</dt>
            <dd className="spec-desc">Get a text or email the second a role goes live at a bank you&rsquo;re watching, customized to what you&rsquo;re looking for — before it shows up on LinkedIn.</dd>
            <dd className="spec-val">Text and email</dd>
          </div>
          <div className="spec-row">
            <dt>Saved jobs</dt>
            <dd className="spec-desc">Bookmark roles as you find them so you always know what you&rsquo;ve applied to and what&rsquo;s still open.</dd>
            <dd className="spec-val">Pro</dd>
          </div>
        </dl>
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
      </div>

      {/* PROOF · two-row auto-scrolling testimonial marquee */}
      <section className="proof-marquee">
        {[TESTIMONIALS.slice(0, 3), TESTIMONIALS.slice(3, 6)].map((row, rowIndex) => (
          <div className={`marquee-row${rowIndex === 1 ? " marquee-row-reverse" : ""}`} key={rowIndex}>
            <div className="marquee-track">
              {row.concat(row).map((t, i) => (
                <div className="testimonial-card" key={`${t.name}-${i}`}>
                  <div className="testimonial-stars" aria-hidden="true">★★★★★</div>
                  <blockquote className="testimonial-quote">&ldquo;{t.quote}&rdquo;</blockquote>
                  <div className="testimonial-attr">
                    <span className="testimonial-avatar">{t.name.split(" ").map((w) => w[0]).join("")}</span>
                    <span>
                      <strong>{t.name}</strong>
                      <br />
                      {t.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* CLOSE · one button */}
      <section className="close-cta">
        <h2 className="close-title">Get Notified With A Text, Instantly</h2>
        <p className="close-desc">Stop refreshing job boards.</p>
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
          Most applicants find out about new postings days late — through word of mouth or a LinkedIn post from someone else. Your odds of getting an interview drop massively if you don't apply within the first few hours or days. <strong>Pro subscribers see new roles the instant they post</strong>, before most people even know they exist.
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
        <span className="job-location">{cleanLocation(job.location) || "—"}</span>
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
    if (b && (BANKS[b] || b === "all")) setActiveBank(b);
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
  const [allJobs, setAllJobs] = useState([]);
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
  const [notifPrefs, setNotifPrefs] = useState({ enabled: false, banks: [], categories: [], jobType: "all", smsEnabled: false, phoneNumber: "", smsConsent: false, location: "" });
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

  // Load every live job once. The cron refreshes the table every 5 minutes, so the
  // page never has to call a bank's own API.
  useEffect(() => {
    if (!isLoaded) return;
    fetch("/api/jobs-live")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch jobs");
        return res.json();
      })
      .then((data) => {
        const loaded = (data.jobs || []).map((job) => ({ ...job, location: cleanLocation(job.location) }));
        setAllJobs(loaded);
        const counts = Object.fromEntries(Object.keys(BANKS).map((key) => [key, 0]));
        for (const job of loaded) if (job.bankKey in counts) counts[job.bankKey]++;
        setBankCounts(counts);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
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

  // Show the active bank's jobs from the loaded list
  useEffect(() => {
    if (activeBank !== "all" && !FREE_BANKS.has(activeBank) && (!isSignedIn || !isSubscribed)) {
      setJobs([]);
      return;
    }

    setSearchQuery("");
    setLocationFilter("");
    setCategoryFilter("");
    setShowSavedOnly(false);

    const bankJobs = activeBank === "all"
      ? allJobs.filter((job) => FREE_BANKS.has(job.bankKey) || (isSignedIn && isSubscribed))
      : allJobs.filter((job) => job.bankKey === activeBank);
    setJobs(bankJobs);

    const locs = [...new Set(
      bankJobs.flatMap((job) => (job.location || "").split(";").map((l) => l.trim())).filter(Boolean)
    )].sort();
    setAvailableLocations(locs);

    const cats = [...new Set(bankJobs.map((job) => job.category).filter(Boolean))].sort();
    setAvailableCategories(cats);
  }, [activeBank, allJobs, isSignedIn, isSubscribed]);

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
        next = [...prev, { title: job.title, link: job.link, location: job.location || "", bank: job.bank || BANKS[activeBank]?.name || "" }];
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

  // Why Save is disabled, in words, so the button never looks broken.
  const notifBlocker = notifPrefs.smsEnabled && !(notifPrefs.phoneNumber || "").trim()
    ? "Add your mobile number to turn on texts."
    : notifPrefs.smsEnabled && !notifPrefs.smsConsent
      ? "Check the consent box to turn on texts."
      : "";

  // One plain sentence describing exactly what the current settings will send.
  const notifSummary = (() => {
    const channels = [notifPrefs.smsEnabled && "a text", notifPrefs.enabled && "an email"].filter(Boolean);
    if (channels.length === 0) return "Alerts are off.";
    const list = (items) => items.length === 2 ? items.join(" or ") : items.join(", ");
    const type = { internship: "internship", fulltime: "analyst" }[notifPrefs.jobType] || "analyst and internship";
    const cats = notifPrefs.categories.length === 0 ? "" : notifPrefs.categories.length <= 2 ? ` in ${list(notifPrefs.categories)}` : ` in ${notifPrefs.categories.length} categories`;
    const banks = notifPrefs.banks.length === 0 ? `at all ${BANK_COUNT} banks` : notifPrefs.banks.length <= 2 ? `at ${list(notifPrefs.banks.map((k) => BANKS[k]?.name || k))}` : `at ${notifPrefs.banks.length} banks`;
    const city = (notifPrefs.location || "").trim() ? ` in ${notifPrefs.location.trim()}` : "";
    return `You'll get ${channels.join(" and ")} for new ${type} roles${cats} ${banks}${city}.`;
  })();

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
  const isGatedBank = activeBank !== "all" && !FREE_BANKS.has(activeBank) && (!isSignedIn || !isSubscribed);

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
        {!bankQuery && (
          <button
            className={`sidebar-item sidebar-item-all${activeBank === "all" && !viewingSaved && !viewNewPostings ? " sidebar-item-active" : ""}`}
            onClick={() => { setViewingSaved(false); setViewNotifications(false); setViewNewPostings(false); setActiveBank("all"); }}
            aria-current={activeBank === "all" && !viewingSaved && !viewNewPostings ? "page" : undefined}
          >
            <span>All banks</span>
            {countsLoaded > 0 && <span className="sidebar-count tnum">{totalOpen}</span>}
          </button>
        )}
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
            <img src="/logo-mark.png" alt="" className="logo-icon" width="22" height="28" />
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
                <option value="all">All banks</option>
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
                <option value="all">All banks</option>
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
                  <h2 className="notif-title">Job alerts</h2>
                  <p className="notif-desc">When a role matching your filters goes live, you hear about it instantly.</p>
                </div>
                {notifLoading ? (
                  <div className="loading-state" style={{ padding: "3rem" }}><div className="spinner" /></div>
                ) : (
                  <>
                    <div className="notif-section">
                      <h3 className="notif-section-title">How should we reach you?</h3>

                      <div className="notif-channel">
                        <div className="notif-toggle-row">
                          <div>
                            <span className="notif-toggle-label">Text message</span>
                            <p className="notif-toggle-sub">The fastest way to hear about a new role.</p>
                          </div>
                          <button
                            className={`notif-toggle ${notifPrefs.smsEnabled ? "notif-toggle-on" : ""}`}
                            role="switch"
                            aria-checked={notifPrefs.smsEnabled}
                            aria-label="Text message alerts"
                            onClick={() => { setNotifPrefs((p) => ({ ...p, smsEnabled: !p.smsEnabled })); setNotifSaved(false); }}
                          >
                            <span className="notif-toggle-knob" />
                          </button>
                        </div>
                        {notifPrefs.smsEnabled && (
                          <div className="notif-sms-setup">
                            <label className="notif-field-label" htmlFor="notif-phone">Mobile number</label>
                            <input
                              id="notif-phone"
                              className="notif-phone-input"
                              type="tel"
                              autoComplete="tel"
                              placeholder="(555) 000-0000"
                              value={notifPrefs.phoneNumber || ""}
                              onChange={(e) => { setNotifPrefs((p) => ({ ...p, phoneNumber: e.target.value })); setNotifSaved(false); }}
                            />
                            <label className="notif-consent">
                              <input
                                type="checkbox"
                                checked={notifPrefs.smsConsent}
                                onChange={(e) => { setNotifPrefs((p) => ({ ...p, smsConsent: e.target.checked })); setNotifSaved(false); }}
                              />
                              <span>
                                I agree to receive recurring automated text messages from Pete's Postings about new job postings matching my preferences. Message frequency varies based on new job postings matching your preferences, up to a few times per day. Message and data rates may apply. Reply <strong>STOP</strong> to cancel, <strong>HELP</strong> for help. Consent is not required to use Pete's Postings. See our{" "}
                                <Link href="/privacy" className="text-link" target="_blank">Privacy Policy</Link> and{" "}
                                <Link href="/terms" className="text-link" target="_blank">Terms of Service</Link>.
                              </span>
                            </label>
                          </div>
                        )}
                      </div>

                      <div className="notif-channel">
                        <div className="notif-toggle-row">
                          <div>
                            <span className="notif-toggle-label">Email</span>
                            <p className="notif-toggle-sub">{user?.primaryEmailAddress?.emailAddress ? `Sent to ${user.primaryEmailAddress.emailAddress}` : "Sent to your account email."}</p>
                          </div>
                          <button
                            className={`notif-toggle ${notifPrefs.enabled ? "notif-toggle-on" : ""}`}
                            role="switch"
                            aria-checked={notifPrefs.enabled}
                            aria-label="Email alerts"
                            onClick={() => { setNotifPrefs((p) => ({ ...p, enabled: !p.enabled })); setNotifSaved(false); }}
                          >
                            <span className="notif-toggle-knob" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {(notifPrefs.enabled || notifPrefs.smsEnabled) && (
                      <div className="notif-section">
                        <h3 className="notif-section-title">Which jobs?</h3>

                        <div className="notif-group">
                          <div className="notif-field-label">Job type</div>
                          <div className="notif-radio-group">
                            {[["all", "Analyst & internship"], ["fulltime", "Analyst"], ["internship", "Internship"]].map(([val, label]) => (
                              <label className="notif-radio" key={val}>
                                <input type="radio" name="notifJobType" value={val} checked={notifPrefs.jobType === val} onChange={() => { setNotifPrefs((p) => ({ ...p, jobType: val })); setNotifSaved(false); }} />
                                <span>{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="notif-group">
                          <div className="notif-field-label">Banks</div>
                          <div className="notif-checkboxes">
                            <label className="notif-checkbox">
                              <input type="checkbox" checked={notifPrefs.banks.length === 0} onChange={() => { setNotifPrefs((p) => ({ ...p, banks: [] })); setNotifSaved(false); }} />
                              <span>All banks</span>
                            </label>
                            {Object.entries(BANKS).map(([key, bank]) => (
                              <label className="notif-checkbox" key={key}>
                                <input type="checkbox" checked={notifPrefs.banks.includes(key)} onChange={() => toggleNotifBank(key)} />
                                <span>{bank.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="notif-group">
                          <div className="notif-field-label">Categories</div>
                          <div className="notif-checkboxes">
                            <label className="notif-checkbox">
                              <input type="checkbox" checked={notifPrefs.categories.length === 0} onChange={() => { setNotifPrefs((p) => ({ ...p, categories: [] })); setNotifSaved(false); }} />
                              <span>All categories</span>
                            </label>
                            {NOTIF_CATEGORIES.map((cat) => (
                              <label className="notif-checkbox" key={cat}>
                                <input type="checkbox" checked={notifPrefs.categories.includes(cat)} onChange={() => toggleNotifCategory(cat)} />
                                <span>{cat}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="notif-group">
                          <label className="notif-field-label" htmlFor="notif-location">City</label>
                          <input
                            id="notif-location"
                            className="notif-phone-input"
                            type="text"
                            placeholder="Any city"
                            value={notifPrefs.location || ""}
                            onChange={(e) => { setNotifPrefs((p) => ({ ...p, location: e.target.value })); setNotifSaved(false); }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="notif-actions">
                      <p className={`notif-summary${notifBlocker ? " notif-summary-blocked" : ""}`}>{notifBlocker || notifSummary}</p>
                      <button
                        className="notif-save"
                        onClick={saveNotifPrefs}
                        disabled={notifSaving || !!notifBlocker}
                      >
                        {notifSaving ? "Saving..." : notifSaved ? "Saved" : "Save"}
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
                          <span className="job-badge" title={cleanLocation(job.location)}>{cleanLocation(job.location) || "—"}</span>
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
                        Live postings from 20 banks. Hit <strong>⚡ Recent</strong> to see everything posted in the last 48 hours — or upgrade to Pro for SMS &amp; email alerts the moment a role goes live.
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
                      {displayJobs.length} {displayJobs.length === 1 ? "position" : "positions"} {activeBank === "all" ? "across all banks" : `at ${BANKS[activeBank].name}`}
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
                      Loading jobs...
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
                      <span className="job-posted">Posted</span>
                      <span className="job-badges">Type</span>
                      {activeBank === "all" && <span className="new-bank-label">Bank</span>}
                      <span style={{ width: 14 }} />
                      <span style={{ width: 14 }} />
                    </div>
                    {displayJobs.map((job, index) => (
                      <a href={job.link} target="_blank" rel="noopener noreferrer" className="job-row" key={index}>
                        <span className="job-index">{String(index + 1).padStart(2, "0")}</span>
                        <span className="job-title">{job.title}</span>
                        <span className="job-location">{job.location || "—"}</span>
                        <span className="job-posted tnum">{formatPostedAt(job)}</span>
                        <div className="job-badges">
                          <span className={`job-badge ${isInternship(job.title) ? "badge-intern" : "badge-analyst"}`}>
                            {isInternship(job.title) ? "Internship" : "Analyst"}
                          </span>
                        </div>
                        {activeBank === "all" && <span className="new-bank-label">{job.bank}</span>}
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
            <p>Pulled live from bank career sites &middot; Updated instantly</p>
            <p>&copy; 2026 Pete's Postings</p>
            <p className="footer-links">
              <Link href="/privacy" className="text-link">Privacy Policy</Link>
              <span aria-hidden="true"> &middot; </span>
              <Link href="/terms" className="text-link">Terms of Service</Link>
            </p>
          </div>
        </div>
      </footer>

      {showAccountPrompt && !isSignedIn && !viewHome && (
        <AccountPromptModal onClose={dismissAccountPrompt} last48hCount={last48hCount} />
      )}
    </>
  );
}
