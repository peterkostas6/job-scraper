"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, notFound } from "next/navigation";
import { useUser, useClerk, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { BANKS } from "@/lib/banks";
import { decodeEntities } from "@/lib/text";
import { JOB_TYPES as ALERT_JOB_TYPES, AREAS, CITIES, matchesAlertPrefs } from "@/lib/alert-options";
import { track } from "@/lib/track";
import posthog from "posthog-js";
import { useTrackSignup } from "@/lib/use-track-signup";
import { PLANS, PLAN_KEYS, planPrice } from "@/lib/plans";
import { openBillingPortal } from "@/lib/billing";

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



// Shown once when Stripe sends a new subscriber back with ?subscribed=true.
// The Stripe webhook flips the account to Pro a few seconds after checkout, so the
// main button waits for that before sending them to set up alerts.
function ProWelcomeModal({ onClose, onSetupAlerts, activated, timedOut }) {
  const primaryRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    if (activated && primaryRef.current) primaryRef.current.focus();
  }, [activated]);

  const features = [
    ['Text alerts', 'Get a text the instant a bank posts a job that matches your filters.'],
    ['Email alerts', 'The same alerts in your inbox, if you want them there too.'],
    ['Recent postings', `Every job posted in the last 48 hours across all ${Object.keys(BANKS).length} banks, in one list.`],
    ['Saved jobs', 'Bookmark roles as you go and keep track of what you\u2019ve applied to.'],
  ];

  return (
    <div className="modal-overlay" data-state="open" onClick={onClose}>
      <div
        className="modal-card modal-card-prompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pro-welcome-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>

        <div className="modal-success-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 id="pro-welcome-title" className="modal-title">Welcome to Pro</h2>
        <p className="modal-subtitle">Thanks for subscribing. Here&rsquo;s everything you just unlocked:</p>

        <ul className="modal-benefits modal-benefits-detailed">
          {features.map(([name, desc]) => (
            <li key={name}>
              <span className="modal-check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></span>
              <span><strong>{name}</strong> &mdash; {desc}</span>
            </li>
          ))}
        </ul>

        <p className="modal-subtitle">Texts are the fastest way to hear about a new role. Pick your banks and add your number to turn them on.</p>

        <div className="modal-actions">
          <button className="modal-cta-primary" ref={primaryRef} onClick={onSetupAlerts} disabled={!activated}>
            {activated ? "Set up your text alerts" : "Activating Pro\u2026"}
          </button>
        </div>
        {!activated && timedOut && (
          <p className="modal-pending-note">This is taking longer than usual. Refresh the page in a minute, or email pete@petespostings.com if Pro still isn&rsquo;t on.</p>
        )}
        <button className="modal-dismiss-link" onClick={onClose}>I&rsquo;ll do it later</button>
      </div>
    </div>
  );
}

// Alert settings before anything is loaded; saved settings are merged over these.
const NOTIF_DEFAULTS = { enabled: false, banks: [], categories: [], jobType: "all", smsEnabled: false, phoneNumber: "", smsConsent: false, location: "" };
const alertSettingsKey = (p) => JSON.stringify(Object.keys(NOTIF_DEFAULTS).map((k) => p?.[k] ?? null));

// ---- HOMEPAGE ----
const BANK_COUNT = Object.keys(BANKS).length;
const MEMBER_CAP = 2000;
// Every posting is US-based, so ", United States" only pushes the city out of view.
// Job links go through /go so clicks are counted before the visitor reaches the bank's site.
const trackedLink = (link) => `/go?u=${encodeURIComponent(link)}`;
const cleanLocation = (loc) => (loc || "").replace(/,\s*United States( of America)?/gi, "").trim();

// Homepage comparison chart: [row label, on your own, Pete's Postings]
const COMPARE_ROWS = [
  ["Coverage", "20 career sites, checked one by one", "All 20 banks in one feed"],
  ["Speed", "You find out whenever you happen to check", "A text or email within 5 minutes of posting"],
  ["Your applications", "Scattered across tabs and spreadsheets", "Saved jobs, all in one place"],
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

const HERO_NOTIFS = [
  { bank: "Goldman Sachs", title: "2027 Investment Banking Summer Analyst" },
  { bank: "JPMorgan Chase", title: "2026 Markets Analyst, New York" },
  { bank: "Morgan Stanley", title: "M&A Analyst, New York" },
  { bank: "Jefferies", title: "Equity Research Summer Analyst" },
  { bank: "Barclays", title: "Investment Banking Analyst" },
];

// The three quotes that do the most work, in the order a skeptical visitor needs them.
const HOME_QUOTES = [TESTIMONIALS[5], TESTIMONIALS[3], TESTIMONIALS[1]];

const HOME_FAQ = [
  ["Is it really free?", `Yes. A free account gets you every open role at all ${BANK_COUNT} banks, saved jobs, and your first 5 text or email alerts. No credit card. Pro unlocks unlimited alerts and the feed of everything posted in the last 48 hours.`],
  ["How fast are the alerts?", "We check every bank's career site every 5 minutes, around the clock. When a new role matches what you picked, your text or email goes out right away."],
  ["Will I get spammed?", "No. You only hear about roles at the banks, job types and cities you choose. Change them or turn alerts off whenever you like."],
  ["Where do the jobs come from?", "Straight from each bank's own careers site, not LinkedIn or Indeed, with a direct link to apply."],
];

function capture(event, props) {
  try { posthog.capture(event, props); } catch {}
}

// Banks re-date old postings and some only give a date, so use whichever is newer and
// fall back to a day label when all we have is a date.
function feedAge(job) {
  const posted = Date.parse(job.postedDate) || 0;
  if (posted >= job.detectedAt && job.postedDate?.endsWith("T00:00:00.000Z")) {
    const days = Math.floor((Date.now() - posted) / 86400000);
    return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`;
  }
  return timeAgo(Math.max(posted, job.detectedAt));
}

function timeAgo(ms) {
  const mins = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// The homepage feed shows the newest roles people come here for (banking, markets, research),
// one per title, so it reads as "the jobs I want" rather than whatever posted last.
const HOME_FEED_CATEGORIES = new Set(["Investment Banking", "Sales & Trading", "Research", "Quantitative", "Corporate Banking"]);
function homeFeed(jobs) {
  const seen = new Set();
  const picked = [];
  for (const job of jobs || []) {
    if (!HOME_FEED_CATEGORIES.has(job.category) || /associate|\bvp\b|vice president|director/i.test(job.title)) continue;
    if (seen.has(job.title)) continue;
    seen.add(job.title);
    picked.push(job);
    if (picked.length === 6) break;
  }
  return picked;
}

// Every sign-up button on the homepage goes to the /start quiz: a few taps of
// commitment and a list of real matches before we ask for an account.
function StartCta({ where, isSignedIn, className = "h-cta" }) {
  return (
    <Link href="/start" className={className} onClick={() => capture("home_cta_clicked", { where })}>
      {isSignedIn ? "Set up my alerts" : "Get my free alerts"}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    </Link>
  );
}

function HomePage({ onBrowse, isSignedIn, last48hCount, liveJobs }) {
  const liveCount = liveJobs?.length || 0;
  const latest = homeFeed(liveJobs);

  // Hero phone: a new text lands on top every few seconds and pushes the others down.
  const [notifStep, setNotifStep] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setNotifStep((s) => s + 1), 3200);
    return () => clearInterval(id);
  }, []);
  const notifs = ["now", "4m ago", "1h ago"].map((ago, i) => {
    const n = notifStep - i;
    return { ...HERO_NOTIFS[((n % HERO_NOTIFS.length) + HERO_NOTIFS.length) % HERO_NOTIFS.length], ago, key: n };
  });

  // Phones: a sign-up bar pinned to the bottom once the hero button scrolls away,
  // hidden again when the closing section (which has its own button) is on screen.
  const heroCtaRef = useRef(null);
  const closeRef = useRef(null);
  const [showSticky, setShowSticky] = useState(false);
  useEffect(() => {
    let heroPast = false;
    let closeIn = false;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === heroCtaRef.current) heroPast = !e.isIntersecting && e.boundingClientRect.top < 0;
        else closeIn = e.isIntersecting || e.boundingClientRect.top < 0;
      }
      setShowSticky(heroPast && !closeIn);
    });
    [heroCtaRef.current, closeRef.current].forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <>
    {/* HERO · the promise, one button, and the product doing its job on a phone */}
    <section className="h-hero">
      <div className="h-hero-inner">
        <div className="h-hero-copy">
          <p className="h-live"><span className="h-live-dot" aria-hidden="true" />Checking {BANK_COUNT} banks every 5 minutes</p>
          <h1 className="h-title">Get a text the moment a bank posts a job.</h1>
          <p className="h-sub">
            Analyst and internship roles at {BANK_COUNT} banks, texted to you minutes after they go live.
            Apply before everyone else.
          </p>
          <div className="h-cta-row" ref={heroCtaRef}>
            <StartCta where="hero" isSignedIn={isSignedIn} />
            <button className="h-hero-browse" onClick={onBrowse}>
              Browse {liveCount > 0 ? `${liveCount.toLocaleString()} ` : ""}open roles
            </button>
          </div>
          <p className="h-fine">Free account &middot; No credit card &middot; Your first 5 alerts are on us</p>
        </div>

        <div className="h-phone" aria-hidden="true">
          <div className="h-phone-screen">
            <div className="h-phone-clock">9:41</div>
            <div className="h-notifs">
              {notifs.map((n) => (
                <div className="h-notif" key={n.key}>
                  <span className="h-notif-icon">
                    <svg width="18" height="18" viewBox="0 0 64 64" fill="white"><path d="M32 9C17.6 9 6 18.4 6 30c0 6.1 3.3 11.7 8.6 15.6-.5 3.7-2 7.2-4.5 10.1-.3.4 0 1 .5 1 5.5-.5 10.6-2.4 14.6-5.4C27.4 51.7 29.7 52 32 52c14.4 0 26-9.4 26-21S46.4 9 32 9z"/></svg>
                  </span>
                  <div className="h-notif-body">
                    <div className="h-notif-head"><strong>Pete&rsquo;s Postings</strong><span>{n.ago}</span></div>
                    <p>{n.bank} just posted: {n.title}. Apply &rarr;</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* BANKS · who we cover, before anyone has to ask */}
    <section className="h-banks" aria-label="Banks we cover">
      <p className="h-banks-label">Pulled straight from the career sites of</p>
      <ul className="h-banks-list">
        {Object.values(BANKS).map((b) => <li key={b.name}>{b.name}</li>)}
      </ul>
    </section>

    <div className="homepage">

      {/* LIVE FEED · real postings, so the value is proven, not described */}
      {latest.length > 0 && (
        <section className="h-feed">
          <p className="h-eyebrow"><span className="h-live-dot" aria-hidden="true" />Live right now</p>
          <h2 className="h-h2"><span className="tnum">{liveCount.toLocaleString()}</span> open analyst and internship roles.</h2>
          {last48hCount > 0 && (
            <p className="h-lead"><strong className="tnum">{last48hCount}</strong> went up in the last 48 hours. Alerts would have told you about each one.</p>
          )}
          <ol className="h-feed-list">
            {latest.map((job) => (
              <li key={job.link}>
                <button className="h-feed-row" onClick={onBrowse}>
                  <span className="h-feed-main">
                    <span className="h-feed-title">{job.title}</span>
                    <span className="h-feed-meta">{job.bank} &middot; {job.location}</span>
                  </span>
                  <span className="h-feed-time tnum">{feedAge(job)}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="h-feed-foot">
            <StartCta where="feed" isSignedIn={isSignedIn} />
            <button className="h-textlink" onClick={onBrowse}>See all {liveCount.toLocaleString()} roles &rarr;</button>
          </div>
        </section>
      )}

      {/* WHY · the cost of doing it yourself */}
      <section className="h-why">
        <div className="h-why-copy">
          <p className="h-eyebrow">Why it matters</p>
          <h2 className="h-h2">Recruiting doesn&rsquo;t wait for you to refresh a career site.</h2>
          <p className="h-lead">Roles go up at random hours and get pulled within days. Checking one site at a time, you&rsquo;re already behind.</p>
        </div>
        <table className="compare">
          <thead>
            <tr>
              <td></td>
              <th scope="col">Checking yourself</th>
              <th scope="col" className="compare-us">Pete&rsquo;s Postings</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map(([label, them, us]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{them}</td>
                <td className="compare-us"><div className="compare-check">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                  <span>{us}</span>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* HOW IT WORKS · three steps, then the product video */}
      <section className="h-steps">
        <p className="h-eyebrow">How it works</p>
        <h2 className="h-h2">Set it up once. Hear about every match.</h2>
        <ol className="h-steps-list">
          <li>
            <span className="h-step-n">1</span>
            <h3>Pick what you want</h3>
            <p>Internship or full-time, plus the banks and cities you want.</p>
          </li>
          <li>
            <span className="h-step-n">2</span>
            <h3>We watch all {BANK_COUNT} banks</h3>
            <p>Every career site, every 5 minutes, around the clock.</p>
          </li>
          <li>
            <span className="h-step-n">3</span>
            <h3>You get a text and apply</h3>
            <p>The role, the bank and a direct link to apply.</p>
          </li>
        </ol>
      </section>

      {/* PROOF · three readable quotes */}
      <section className="h-proof">
        <h2 className="h-h2">Built for students without a pipeline.</h2>
        <div className="h-quotes">
          {HOME_QUOTES.map((t) => (
            <figure className="h-quote" key={t.name}>
              <blockquote>&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption><strong>{t.name}</strong>{t.role}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* PRICING · answer "what does it cost" before it becomes a reason to leave */}
      <section className="h-plans">
        <div className="h-plans-copy">
          <p className="h-eyebrow">Pricing</p>
          <h2 className="h-h2">Start free. Upgrade when recruiting heats up.</h2>
        </div>
        <div className="h-plan">
          <p className="h-plan-name">Free</p>
          <p className="h-plan-price">$0</p>
          <ul>
            <li>Every open role at all {BANK_COUNT} banks</li>
            <li>Your first 5 text or email alerts</li>
            <li>Save jobs and track applications</li>
          </ul>
          <StartCta where="pricing" isSignedIn={isSignedIn} />
        </div>
        <div className="h-plan h-plan-pro">
          <p className="h-plan-name">Pro</p>
          <p className="h-plan-price">${PLANS.monthly.price}<span>/mo</span></p>
          <p className="h-plan-note">Founding price for the first {MEMBER_CAP.toLocaleString()} members, then $19.99</p>
          <ul>
            <li>Unlimited text and email alerts</li>
            <li>Everything posted in the last 48 hours</li>
            <li>Cancel anytime</li>
          </ul>
          <Link href="/pricing" className="h-textlink" onClick={() => capture("home_cta_clicked", { where: "pricing_pro" })}>See Pro plans &rarr;</Link>
        </div>
      </section>

      {/* FAQ · the objections, answered */}
      <section className="h-faq">
        <h2 className="h-h2">Questions</h2>
        {HOME_FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>

    </div>

    {/* CLOSE · one last push */}
    <section className="h-close" ref={closeRef}>
      <h2 className="h-close-title">The next posting could go up tonight.</h2>
      <p className="h-close-sub">Set up alerts in a minute. Hear about it first.</p>
      <StartCta where="close" isSignedIn={isSignedIn} />
      <p className="h-fine">Free account &middot; No credit card</p>
    </section>

    <div className={`h-sticky${showSticky ? " h-sticky-on" : ""}`}>
      <StartCta where="sticky" isSignedIn={isSignedIn} className="h-cta h-cta-block" />
    </div>
    </>
  );
}


// ---- SIGN-UP GATE ----
// A sentence of context before the Clerk form, so signing up never comes out of nowhere.
// After signing up, a visitor who clicked a job goes straight to it.
const SIGNUP_GATES = {
  job: {
    title: "Create a free account to open this job",
    desc: "It takes 30 seconds. You also get 5 free alerts for new roles like this one.",
    cta: "Continue to the job",
  },
  save: {
    title: "Save jobs with a free account",
    desc: `Keep track of what you\u2019ve saved and applied to across all ${BANK_COUNT} banks.`,
    cta: "Create free account",
  },
  request: {
    title: "Request a bank with a free account",
    desc: "Tell us which bank to add next.",
    cta: "Create free account",
  },
};

function SignUpGate({ gate, onClose }) {
  const clerk = useClerk();
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const redirect = gate.redirect ? { forceRedirectUrl: gate.redirect, signInForceRedirectUrl: gate.redirect } : {};

  return (
    <div className="modal-overlay" data-state="open" onClick={onClose}>
      <div className="modal-card gate-card" role="dialog" aria-modal="true" aria-labelledby="gate-title" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
        <h2 className="gate-title" id="gate-title">{gate.title}</h2>
        {gate.job && (
          <p className="gate-job">
            <strong>{gate.job.title}</strong>
            <span>{gate.job.bank || BANKS[gate.job.bankKey]?.name}{gate.job.location ? ` \u00b7 ${gate.job.location}` : ""}</span>
          </p>
        )}
        <p className="gate-desc">{gate.desc}</p>
        <button className="h-cta gate-cta" onClick={() => { onClose(); clerk.openSignUp(redirect); }}>{gate.cta}</button>
        <p className="gate-fine">
          Free &middot; No credit card &middot; Have an account?{" "}
          <button className="gate-link" onClick={() => { onClose(); clerk.openSignIn(redirect); }}>Sign in</button>
        </p>
      </div>
    </div>
  );
}

// ---- PAYWALL ----
function PaywallOverlay({ isSignedIn, newCount }) {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  function handleSubscribe(plan) {
    track("InitiateCheckout", planPrice(plan));
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
      // After creating an account, carry on to checkout for the plan they picked.
      <SignUpButton mode="modal" forceRedirectUrl={`/pricing?checkout=${plan}`} signInForceRedirectUrl={`/pricing?checkout=${plan}`}>
        <button className={`paywall-plan-cta${primary ? " paywall-plan-cta-primary" : ""}`}>
          {label}
        </button>
      </SignUpButton>
    );

  return (
    <div className="paywall">
      <div className="paywall-header">
        <div className="paywall-badge">Pro</div>
        <h2 className="paywall-title">
          {newCount > 0 ? `${newCount} new ${newCount === 1 ? "role" : "roles"} in the last 48 hours` : "Unlock Pro Features"}
        </h2>
        <p className="paywall-desc">
          Pro shows you every role posted in the last 48 hours and texts you the moment new ones go live.
        </p>
      </div>

      <div className="paywall-unlocks">
        <p className="paywall-includes-label">What you unlock</p>
        <ul className="paywall-unlocks-list">
          {[
            ["Unlimited text alerts", "A text the moment a bank posts a role matching your banks, job type and city. Free accounts get 5."],
            ["Unlimited email alerts", "The same alerts in your inbox, if you want them there too."],
            ["Recent postings", `Every job posted in the last 48 hours across all ${BANK_COUNT} banks, in one list.`],
          ].map(([name, desc]) => (
            <li key={name}>
              <span className="modal-check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></span>
              <span><strong>{name}</strong> &mdash; {desc}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="paywall-plans">
        {PLAN_KEYS.map((key) => {
          const plan = PLANS[key];
          const featured = key === "monthly";
          return (
            <div key={key} className={`paywall-plan${featured ? " paywall-plan-popular" : ""}`}>
              {featured && <div className="paywall-plan-tag">Most popular</div>}
              <h3 className="paywall-plan-name">{plan.name}</h3>
              <div className="paywall-plan-price">
                <span className="paywall-plan-amount">${plan.price}</span>
                <span className="paywall-plan-period">/{plan.period}</span>
              </div>
              <p className="paywall-plan-billing">{plan.perMonth ? `$${plan.perMonth.toFixed(2)}/mo, billed yearly` : plan.billed}</p>
              {ctaBtn(key, `Get ${plan.name}`, featured)}
            </div>
          );
        })}
      </div>

      {!isSignedIn && (
        <p className="paywall-free">
          Not ready to pay? <Link href="/start" className="paywall-link">Start with 5 free alerts &rarr;</Link>
        </p>
      )}

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
// Written for readers and search engines alike: plain headings, real answers, and links to
// every bank's listings. The FAQ below doubles as FAQPage structured data for Google.
const ABOUT_FAQ = [
  ["Is Pete's Postings free?",
    `Yes. Browsing every open analyst and internship posting across all ${BANK_COUNT} banks is free. A free account adds saved jobs and your first 5 text or email alerts, with no credit card. Pro adds unlimited alerts and the 48-hour recent postings feed, weekly, monthly or yearly; see the pricing page for current prices.`],
  ["How fast will I hear about a new posting?",
    "Within minutes. We check every bank every 5 minutes, and as soon as a role that matches your alert settings goes live, you get a text (and an email if you want one) with the title, bank, and a direct link to apply."],
  ["Which banks do you track?",
    `${BANK_COUNT} banks, including JPMorgan Chase, Goldman Sachs, Morgan Stanley, Bank of America, Citi, Deutsche Bank, Barclays, Wells Fargo, Jefferies, Blackstone, and BlackRock. The full list is above.`],
  ["Are the listings real and up to date?",
    "Yes. Every posting comes straight from each bank's own careers system, not from reposts or aggregators, and each one links to the official application page. Roles that are taken down disappear from the site."],
  ["What kinds of roles are listed?",
    "Analyst and internship roles: summer analyst and summer internship programs, off-cycle internships, and full-time analyst positions across investment banking, sales and trading, research, wealth management, risk, technology, and more."],
  ["Can I choose which jobs I get texts about?",
    "Yes. Pick the banks, job type (analyst or internship), categories, and city you care about, and you only hear about matching roles. Reply STOP to any text to turn texts off."],
  ["Can I cancel Pro any time?",
    "Yes. Choose Manage subscription from your account menu to cancel online in a few clicks. You keep Pro until the end of the period you paid for."],
];

function AboutPage({ onBrowse }) {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: ABOUT_FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://petespostings.com" },
        { "@type": "ListItem", position: 2, name: "About", item: "https://petespostings.com/about" },
      ],
    },
  ];

  return (
    <div className="about-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <section className="about-hero">
        <span className="hero-tag">About</span>
        <h1 className="about-title">Instant alerts for investment banking internships and analyst jobs</h1>
        <p className="about-subtitle">
          Pete&rsquo;s Postings tracks every analyst and internship posting at {BANK_COUNT} banks and texts you the moment a role you want goes live.
        </p>
      </section>

      <section className="about-section about-section-first">
        <h2 className="about-heading">Why I built it</h2>
        <p className="about-text">
          Applying to banking internships and analyst roles is brutal. After applying to 300+ internships, I was sick of tracking new postings in an outdated spreadsheet and finding out about roles too late.
        </p>
        <p className="about-text">
          I built this for myself, but after heavy demand decided to make it open to the public.
        </p>
      </section>

      <section className="about-section">
        <h2 className="about-heading">What you get</h2>
        <div className="about-features">
          <div className="about-feature">
            <strong>A text the instant a role posts</strong>
            <span>Choose your banks, job type, categories, and city. When a matching role goes live, you get a text with a direct link to apply, usually before it shows up on LinkedIn.</span>
          </div>
          <div className="about-feature">
            <strong>Every bank in one place</strong>
            <span>All open analyst and internship roles across {BANK_COUNT} banks in one searchable list, instead of checking 20 different career sites every day.</span>
          </div>
          <div className="about-feature">
            <strong>Straight from the source</strong>
            <span>Listings come directly from each bank&rsquo;s own careers system, so there are no fake or expired reposts, and every link goes to the official application.</span>
          </div>
          <div className="about-feature">
            <strong>The last 48 hours at a glance</strong>
            <span>The recent postings feed shows every new role from the past two days across all banks, so you can apply while applications are still being read.</span>
          </div>
          <div className="about-feature">
            <strong>Email alerts too</strong>
            <span>Prefer your inbox? Get the same alerts by email, or both.</span>
          </div>
          <div className="about-feature">
            <strong>Saved jobs</strong>
            <span>Bookmark roles as you go and keep track of what you&rsquo;ve applied to.</span>
          </div>
          <div className="about-feature">
            <strong>Search and filters</strong>
            <span>Filter by bank, location, analyst or internship, and category, such as investment banking, sales and trading, or research.</span>
          </div>
        </div>
        <p className="about-text" style={{ marginTop: "1rem" }}>
          Browsing is free. A free account adds saved jobs and 5 text or email alerts. Unlimited alerts and recent postings are part of <Link href="/pricing" className="text-link">Pro</Link>.
        </p>
      </section>

      <section className="about-section">
        <h2 className="about-heading">Why speed matters</h2>
        <p className="about-text">
          Most applicants find out about new postings days late, through word of mouth or someone else&rsquo;s LinkedIn post. Banks review applications as they come in, and many roles fill quickly, so applying in the first hours puts you ahead of most of the pool. <strong>With alerts on, you hear about new roles minutes after they post.</strong>
        </p>
      </section>

      <section className="about-section">
        <h2 className="about-heading">Banks we track</h2>
        <p className="about-text">Tap a bank to see its open analyst and internship roles.</p>
        <div className="about-banks-grid">
          {Object.entries(BANKS).map(([key, bank]) => (
            <Link key={key} href={`/jobs?bank=${key}`} className="about-bank-card">
              <span className="about-bank-name">{bank.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="about-section">
        <h2 className="about-heading">Who it&rsquo;s for</h2>
        <p className="about-text">
          Students recruiting for summer analyst and investment banking internships, graduates applying for full-time analyst roles, and anyone breaking into finance who doesn&rsquo;t want to miss a posting because they checked the wrong site on the wrong day.
        </p>
      </section>

      <section className="about-section">
        <h2 className="about-heading">Frequently asked questions</h2>
        <div className="about-faq">
          {ABOUT_FAQ.map(([q, a]) => (
            <div key={q} className="about-faq-item">
              <h3 className="about-faq-q">{q}</h3>
              <p className="about-text">{a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="about-section about-section-last" style={{ textAlign: "center" }}>
        <h2 className="about-heading">Hear about the next posting first</h2>
        <div className="about-ctas">
          <Link href="/start" className="h-cta" onClick={() => capture("about_cta_clicked")}>Get my free alerts</Link>
          <button className="about-cta-secondary" onClick={onBrowse}>Browse jobs</button>
        </div>
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
      <a href={trackedLink(job.link)} target="_blank" rel="noopener noreferrer" className="job-row">
        <span className="job-index">{String(index + 1).padStart(2, "0")}</span>
        <span className="job-title">{job.title}</span>
        <span className="job-location">{cleanLocation(job.location) || "—"}</span>
        <div className="job-badges job-badges-wide">
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
      <span className="job-badges job-badges-wide">Type / Posted</span>
      <span className="new-bank-label" style={{ fontSize: "0.62rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-muted)" }}>Bank</span>
      <span style={{ width: 14 }} />
    </div>
  );

  return (
    <div className="new-postings-view">
      <div className="new-section">
        {!isSubscribed ? (
          <>
          <div className="new-paywall">
            <div className="new-paywall-blur">
              {[1,2,3,4].map(i => (
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
              <p className="new-paywall-title">Recent postings is a Pro feature</p>
              <p className="new-paywall-desc">
                {last48hCount > 0 ? `${last48hCount} ${last48hCount === 1 ? "job was" : "jobs were"} posted in the last 48 hours. ` : ""}
                Upgrade to Pro to see them here, or <Link href="/jobs?bank=all" className="text-link">browse every open job</Link> for free in the Browse tab.
              </p>
            </div>
          </div>
          <PaywallOverlay isSignedIn={isSignedIn} newCount={last48hCount} />
          </>
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

  const [activeBank, setActiveBank] = useState("all");
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
  // Signed-out visitors who try something that needs an account see why first (see SignUpGate).
  const [gate, setGate] = useState(null);
  function askToSignUp(kind, job) {
    capture("signup_gate_shown", { kind });
    setGate({ ...SIGNUP_GATES[kind], job, redirect: job ? trackedLink(job.link) : undefined });
  }
  const [notifPrefs, setNotifPrefs] = useState(NOTIF_DEFAULTS);
  const [notifLoading, setNotifLoading] = useState(false);
  // Free accounts: { used, limit } of their free alerts; null for Pro (unlimited).
  const [freeAlerts, setFreeAlerts] = useState(null);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);
  const [pickBanks, setPickBanks] = useState(false);
  // Settings as last saved (null until loaded), and which alert setting row is open.
  const [savedNotifPrefs, setSavedNotifPrefs] = useState(null);
  const [openAlertRow, setOpenAlertRow] = useState(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [companyRequest, setCompanyRequest] = useState("");
  const [companyRequestStatus, setCompanyRequestStatus] = useState(null); // null | "sending" | "sent" | error message
  const [showCompanyRequest, setShowCompanyRequest] = useState(false);
  const [showProWelcome, setShowProWelcome] = useState(false);
  const [proWelcomeTimedOut, setProWelcomeTimedOut] = useState(false);

  // Stripe returns new subscribers to /?subscribed=true. Show the Pro welcome once, drop
  // the flag from the URL, and reload the Clerk user until the webhook has marked it Pro.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("subscribed") !== "true") return;
    // Every plan is paid at checkout. The event ID matches the Stripe webhook's server copy
    // (app/api/webhook/route.js) so the ad platforms count it once.
    const sessionId = url.searchParams.get("session_id") || "";
    track("Purchase", planPrice(url.searchParams.get("plan")), sessionId && `purchase_${sessionId}`);
    url.searchParams.delete("subscribed");
    url.searchParams.delete("plan");
    url.searchParams.delete("session_id");
    window.history.replaceState(null, "", url);
    setShowProWelcome(true);
  }, []);

  useTrackSignup(user);
  useEffect(() => {
    if (!showProWelcome || !user || isSubscribed) return;
    let tries = 0;
    const id = setInterval(() => {
      tries++;
      user.reload().catch(() => {});
      if (tries >= 15) { clearInterval(id); setProWelcomeTimedOut(true); }
    }, 2000);
    return () => clearInterval(id);
  }, [showProWelcome, user, isSubscribed]);

  // ---- URL-driven views ----
  // Each view has its own route. The flags below are derived from the pathname; the
  // setView* functions keep the old call sites working by collecting the flags a handler
  // sets, then pushing the matching route once the handler finishes.
  const pathname = usePathname();
  const VIEW_BY_PATH = { "/": "home", "/jobs": "browse", "/recent": "recent", "/saved": "saved", "/notifications": "notifications", "/about": "about" };
  const routeView = VIEW_BY_PATH[pathname];
  const view = routeView || "browse";
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

  const [newPostingsData, setNewPostingsData] = useState({ last48h: [], thisWeek: [], last48hCount: 0, total: 0 });
  const [last48hCount, setLast48hCount] = useState(null);
  const [newPostingsLoading, setNewPostingsLoading] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState("");

  // Load welcome state from localStorage
  useEffect(() => {
    const welcomed = localStorage.getItem("pp-welcomed");
    if (!welcomed) setShowWelcome(true);
  }, []);

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
    if (!isLoaded || !isSignedIn) return;
    setNotifLoading(true);
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        const loaded = { ...NOTIF_DEFAULTS, ...(data.notifications || {}) };
        setNotifPrefs(loaded);
        setSavedNotifPrefs(loaded);
        setFreeAlerts(data.freeAlerts || null);
      })
      .catch(() => setSavedNotifPrefs((prev) => prev ?? NOTIF_DEFAULTS))
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
        const loaded = (data.jobs || []).map((job) => ({ ...job, title: decodeEntities(job.title), location: cleanLocation(job.location) }));
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
    if (!isSignedIn) { askToSignUp("save"); return; }
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

  function updateNotif(patch) {
    setNotifPrefs((prev) => ({ ...prev, ...patch }));
    setNotifSaved(false);
  }

  // An area is on when all of its categories are; tapping it adds or removes them together.
  function toggleNotifArea(area) {
    setNotifPrefs((prev) => {
      const on = area.categories.every((c) => prev.categories.includes(c));
      const rest = prev.categories.filter((c) => !area.categories.includes(c));
      return { ...prev, categories: on ? rest : [...rest, ...area.categories] };
    });
    setNotifSaved(false);
  }

  // Banks: "All banks" unless someone chose to pick, or already saved specific banks.
  const showBankPicker = pickBanks || notifPrefs.banks.length > 0;
  const notifCity = (notifPrefs.location || "").trim();

  const notifMatches = allJobs
    .filter((job) => matchesAlertPrefs(job, { ...notifPrefs, location: (notifPrefs.location || "").trim() }))
    .sort((x, y) => Math.max(Date.parse(y.postedDate) || 0, y.detectedAt) - Math.max(Date.parse(x.postedDate) || 0, x.detectedAt));
  const notifDirty = savedNotifPrefs !== null && alertSettingsKey(notifPrefs) !== alertSettingsKey(savedNotifPrefs);
  const alertsOn = Boolean(savedNotifPrefs && (savedNotifPrefs.enabled || savedNotifPrefs.smsEnabled));
  const maskedPhone = (num) => { const d = (num || "").replace(/\D/g, "").slice(-4); return d ? `(•••) •••-${d}` : "your phone"; };
  const alertAreasLabel = notifPrefs.categories.length === 0
    ? "Open to anything"
    : [...AREAS.filter((a) => a.categories.every((c) => notifPrefs.categories.includes(c))).map((a) => a.label),
       ...notifPrefs.categories.filter((c) => !AREAS.some((a) => a.categories.includes(c)))].join(", ") || "Open to anything";
  const alertBanksLabel = notifPrefs.banks.length === 0
    ? `All ${BANK_COUNT} banks`
    : notifPrefs.banks.length <= 2 ? notifPrefs.banks.map((k) => BANKS[k]?.shortName || k).join(", ") : `${notifPrefs.banks.length} banks`;

  // One expandable settings row: label and current value; tapping opens its choices.
  const alertRow = (key, label, value, body) => {
    const open = openAlertRow === key;
    return (
      <div className={`al-row${open ? " al-row-open" : ""}`} key={key}>
        <button className="al-row-head" aria-expanded={open} onClick={() => setOpenAlertRow(open ? null : key)}>
          <span className="al-row-label">{label}</span>
          <span className="al-row-value">{value}</span>
          <svg className="al-row-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
        </button>
        {open && <div className="al-row-body">{body}</div>}
      </div>
    );
  };

  // Why Save is disabled, in words, so the button never looks broken.
  const notifBlocker = notifPrefs.smsEnabled && !(notifPrefs.phoneNumber || "").trim()
    ? "Add your mobile number to turn on texts."
    : notifPrefs.smsEnabled && !notifPrefs.smsConsent
      ? "Check the consent box to turn on texts."
      : "";


  async function sendCompanyRequest(e) {
    e.preventDefault();
    setCompanyRequestStatus("sending");
    try {
      const res = await fetch("/api/company-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: companyRequest }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setCompanyRequestStatus(data.error || "Couldn't send your request. Try again."); return; }
      setCompanyRequest("");
      setCompanyRequestStatus("sent");
    } catch {
      setCompanyRequestStatus("Couldn't send your request. Try again.");
    }
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
      .then((data) => { if (data.success) { setNotifSaved(true); setSavedNotifPrefs(notifPrefs); setOpenAlertRow(null); setEditingPhone(false); } })
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
        <span>Your tools</span>
        {!isSubscribed && <Link href="/pricing" className="sidebar-pro-pill">Upgrade</Link>}
      </div>
      <button
        className={`sidebar-item${viewNewPostings ? " sidebar-item-active" : ""}${!isSubscribed ? " sidebar-item-locked" : ""}`}
        onClick={() => {
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
        className={`sidebar-item${viewingSaved && !viewNotifications ? " sidebar-item-active" : ""}`}
        onClick={() => {
          if (!isSignedIn) { askToSignUp("save"); return; }
          setViewingSaved(true); setViewNotifications(false); setSearchQuery(""); setLocationFilter(""); setJobType("all");
        }}
      >
        <span className="sidebar-saved-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill={viewingSaved && !viewNotifications ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          Saved jobs
        </span>
        {savedJobs.length > 0 && <span className="sidebar-count tnum">{savedJobs.length}</span>}
      </button>
      <button
        className={`sidebar-item${viewNotifications ? " sidebar-item-active" : ""}`}
        onClick={() => {
          if (!isSignedIn) { router.push("/start"); return; }
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
        {freeAlerts ? <span className="sidebar-count tnum">{Math.max(0, freeAlerts.limit - freeAlerts.used)} free</span> : notifPrefs.enabled ? <span className="sidebar-notif-dot" /> : null}
      </button>
      <button
        className="sidebar-item"
        onClick={() => { if (!isSignedIn) { askToSignUp("request"); return; } setCompanyRequestStatus(null); setShowCompanyRequest(true); }}
      >
        <span className="sidebar-saved-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Request a company
        </span>
      </button>
      {user?.publicMetadata?.stripeCustomerId && (
        <button className="sidebar-item" onClick={openBillingPortal}>
          <span className="sidebar-saved-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
            </svg>
            Manage subscription
          </span>
        </button>
      )}
      <span className="sidebar-scroll-arrow" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </span>
    </aside>
  );

  if (!routeView) notFound();

  // App views wait for Clerk so Pro members never see a paywall flash. Home and About don't
  // depend on the account, so they render immediately and their text is in the server HTML.
  if (!isLoaded && !viewHome && !viewAbout) {
    return (
      <div className="loading-state">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <nav className={viewHome && !scrolled && !navMenuOpen ? "nav-on-dark" : ""}>
        <div className="nav-inner">
          <Link href="/" className="logo logo-link" aria-label="Pete's Postings home">
            <img src="/logo-mark.png" alt="" className="logo-icon" width="22" height="28" />
            <span className="logo-text">Pete&rsquo;s Postings</span>
          </Link>
          <div className={`nav-center${navMenuOpen ? " nav-center-open" : ""}`} onClick={() => setNavMenuOpen(false)}>
            <Link href="/jobs" className={`nav-link${view === "browse" ? " nav-link-active" : ""}`}>Browse Jobs</Link>
            <Link
              href="/recent"
              className={`nav-link nav-link-new${viewNewPostings ? " nav-link-active" : ""}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              Recent Postings
            </Link>
            <Link href="/notifications" className={`nav-link nav-link-alerts${viewNotifications ? " nav-link-active" : ""}`}>Alerts</Link>
            <Link href="/pricing" className="nav-link">Pricing</Link>
            <Link href="/about" className={`nav-link${viewAbout ? " nav-link-active" : ""}`}>About</Link>
          </div>
          <div className="nav-right">
            {!isLoaded ? null : isSignedIn ? (
              <UserButton>
                {user?.publicMetadata?.stripeCustomerId && (
                  <UserButton.MenuItems>
                    <UserButton.Action label="Manage subscription" labelIcon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>} onClick={openBillingPortal} />
                  </UserButton.MenuItems>
                )}
              </UserButton>
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="nav-signin">Sign in</button>
                </SignInButton>
                <Link href="/start" className="nav-cta" onClick={() => capture("home_cta_clicked", { where: "nav" })}>Get free alerts</Link>
              </>
            )}
          </div>
          {/* Phones only: the nav links don't fit in the bar, so they open as a menu. */}
          <button
            className="nav-menu-btn"
            onClick={() => setNavMenuOpen((v) => !v)}
            aria-label={navMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={navMenuOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {navMenuOpen ? <path d="M18 6L6 18M6 6l12 12"/> : <path d="M4 7h16M4 12h16M4 17h16"/>}
            </svg>
          </button>
        </div>
      </nav>

      {viewHome && !viewAbout && !viewNewPostings && (
        <HomePage
          onBrowse={() => router.push("/jobs")}
          isSignedIn={isSignedIn}
          last48hCount={last48hCount}
          liveJobs={allJobs}
        />
      )}

      {viewAbout && !viewNewPostings && (
        <AboutPage onBrowse={() => router.push("/jobs")} />
      )}

      {viewNewPostings && (
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
                  setViewNewPostings(true); setViewingSaved(false); setViewNotifications(false); setViewHome(false);
                }}
              >
                Last 48h
              </button>
              <button
                className="mobile-pro-pill"
                onClick={() => {
                  if (!isSignedIn) { askToSignUp("save"); return; }
                  setViewNewPostings(false); setViewingSaved(true); setViewNotifications(false); setViewHome(false);
                }}
              >
                Saved
              </button>
              <button
                className="mobile-pro-pill"
                onClick={() => {
                  if (!isSignedIn) { router.push("/start"); return; }
                  setViewNewPostings(false); setViewingSaved(true); setViewNotifications(true); setViewHome(false);
                }}
              >
                Alerts
              </button>
              <button
                className="mobile-pro-pill"
                onClick={() => { if (!isSignedIn) { askToSignUp("request"); return; } setCompanyRequestStatus(null); setShowCompanyRequest(true); }}
              >
                Request
              </button>
            </div>
          </div>
          {/* Sidebar — same as normal view */}
          {sidebar}

          <main className={`content${!isSubscribed ? " content-recent-locked" : ""}`}>
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

            {/* Shortcut to alert settings: everyone sees it; without Pro it opens the paywall. */}
            <div className="welcome-banner alerts-callout">
              <div className="alerts-callout-body">
                <span className="alerts-callout-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                </span>
                <div>
                  <p className="welcome-title">
                    {isSubscribed && (notifPrefs.smsEnabled || notifPrefs.enabled)
                      ? `Your ${notifPrefs.smsEnabled ? "text" : "email"} alerts are on`
                      : "Get a text the instant a new job posts"}
                  </p>
                  <p className="welcome-desc">
                    {isSubscribed && (notifPrefs.smsEnabled || notifPrefs.enabled)
                      ? "Change which banks, roles and cities you hear about."
                      : "Set up text or email alerts for the banks and roles you want, so you never have to check this page."}
                  </p>
                </div>
              </div>
              <button
                className={`alerts-callout-cta${!isSubscribed ? " alerts-callout-cta-locked" : ""}`}
                onClick={() => { setViewingSaved(true); setViewNotifications(true); setViewNewPostings(false); }}
              >
                {!isSubscribed && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                )}
                {!isSubscribed ? "Pro: set up alerts" : isSubscribed && (notifPrefs.smsEnabled || notifPrefs.enabled) ? "Edit alerts" : "Set up alerts"}
              </button>
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
                  setViewNewPostings(true); setViewingSaved(false); setViewNotifications(false); setViewHome(false);
                }}
              >
                Last 48h
              </button>
              <button
                className={`mobile-pro-pill${viewingSaved && !viewNotifications ? " mobile-pro-pill-active" : ""}`}
                onClick={() => {
                  if (!isSignedIn) { askToSignUp("save"); return; }
                  setViewingSaved(true); setViewNotifications(false); setSearchQuery(""); setLocationFilter(""); setJobType("all");
                }}
              >
                Saved
              </button>
              <button
                className={`mobile-pro-pill${viewNotifications ? " mobile-pro-pill-active" : ""}`}
                onClick={() => {
                  if (!isSignedIn) { router.push("/start"); return; }
                  setViewingSaved(true); setViewNotifications(true);
                }}
              >
                Alerts
              </button>
              <button
                className="mobile-pro-pill"
                onClick={() => { if (!isSignedIn) { askToSignUp("request"); return; } setCompanyRequestStatus(null); setShowCompanyRequest(true); }}
              >
                Request
              </button>
            </div>
          </div>
          {/* SIDEBAR */}
          {sidebar}

          {/* MAIN CONTENT */}
          <main className="content">
            {/* Notifications view */}
            {viewNotifications && !isSignedIn && (
              <div className="notif-panel alerts-intro">
                <h2 className="alerts-intro-title">Get a text the moment a bank posts a role you want</h2>
                <p className="alerts-intro-desc">We check all {BANK_COUNT} banks every 5 minutes. Your first 5 alerts are free.</p>
                <div className="alerts-intro-sample" aria-hidden="true">
                  <span className="h-notif-icon">
                    <svg width="18" height="18" viewBox="0 0 64 64" fill="white"><path d="M32 9C17.6 9 6 18.4 6 30c0 6.1 3.3 11.7 8.6 15.6-.5 3.7-2 7.2-4.5 10.1-.3.4 0 1 .5 1 5.5-.5 10.6-2.4 14.6-5.4C27.4 51.7 29.7 52 32 52c14.4 0 26-9.4 26-21S46.4 9 32 9z"/></svg>
                  </span>
                  <div>
                    <div className="h-notif-head"><strong>Pete&rsquo;s Postings</strong><span>now</span></div>
                    <p>Goldman Sachs just posted: 2027 Investment Banking Summer Analyst. Apply &rarr;</p>
                  </div>
                </div>
                <ol className="alerts-intro-steps">
                  <li><strong>Answer 4 quick questions</strong> about the roles, banks and cities you want</li>
                  <li><strong>See the open roles</strong> that already match</li>
                  <li><strong>Choose text, email or both</strong> and you&rsquo;re set</li>
                </ol>
                <Link href="/start" className="h-cta" onClick={() => capture("alerts_tab_cta_clicked")}>
                  Set up my free alerts
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </Link>
                <p className="h-fine">Takes about a minute &middot; No credit card</p>
              </div>
            )}
            {viewNotifications && isSignedIn && (
              <div className="al-page">
                <div className="al-head">
                  <h2 className="al-title">Job alerts</h2>
                  <p className="al-sub">We check every bank every 5 minutes and tell you when a match goes live.</p>
                </div>

                {notifLoading || savedNotifPrefs === null ? (
                  <div className="loading-state" style={{ padding: "3rem" }}><div className="spinner" /></div>
                ) : (
                  <>
                    {/* STATUS · what is on right now, as saved */}
                    <section className={`al-status${alertsOn ? " al-status-on" : ""}`}>
                      <span className="al-status-dot" aria-hidden="true" />
                      <div className="al-status-main">
                        <p className="al-status-title">{alertsOn ? "Your alerts are on" : "Your alerts are off"}</p>
                        <p className="al-status-sub">
                          {alertsOn
                            ? [savedNotifPrefs.smsEnabled && `Texting ${maskedPhone(savedNotifPrefs.phoneNumber)}`, savedNotifPrefs.enabled && `emailing ${user?.primaryEmailAddress?.emailAddress || "you"}`].filter(Boolean).join(" and ")
                            : "Choose what you want, turn on texts or email, then save."}
                        </p>
                      </div>
                      {freeAlerts && (
                        <div className="al-quota">
                          <div className="al-quota-dots" aria-hidden="true">
                            {Array.from({ length: freeAlerts.limit }).map((_, i) => <span key={i} className={i < freeAlerts.used ? "al-quota-used" : ""} />)}
                          </div>
                          <p>
                            {freeAlerts.used < freeAlerts.limit ? `${freeAlerts.limit - freeAlerts.used} of ${freeAlerts.limit} free alerts left` : "Free alerts used up"}
                            {" "}&middot; <Link href="/pricing" className="al-link">Go unlimited</Link>
                          </p>
                        </div>
                      )}
                    </section>

                    <div className="al-grid">
                      <div className="al-settings">
                        {/* WHAT · one row per question; tap to change */}
                        <div className="al-card">
                          <p className="al-card-label">What you&rsquo;ll hear about</p>
                          {alertRow("type", "Recruiting for", ALERT_JOB_TYPES.find((t) => t.key === notifPrefs.jobType)?.label || "Both", (
                            <div className="st-chips">
                              {ALERT_JOB_TYPES.map((t) => (
                                <button key={t.key} className="st-chip" aria-pressed={notifPrefs.jobType === t.key} onClick={() => updateNotif({ jobType: t.key })}>{t.label}</button>
                              ))}
                            </div>
                          ))}
                          {alertRow("areas", "Areas", alertAreasLabel, (
                            <div className="st-chips">
                              <button className="st-chip" aria-pressed={notifPrefs.categories.length === 0} onClick={() => updateNotif({ categories: [] })}>Open to anything</button>
                              {AREAS.map((a) => (
                                <button key={a.key} className="st-chip" aria-pressed={a.categories.every((c) => notifPrefs.categories.includes(c))} onClick={() => toggleNotifArea(a)}>{a.label}</button>
                              ))}
                              {/* Older settings can hold categories no area covers; show them so nothing is hidden. */}
                              {notifPrefs.categories.filter((c) => !AREAS.some((a) => a.categories.includes(c))).map((c) => (
                                <button key={c} className="st-chip" aria-pressed onClick={() => toggleNotifCategory(c)}>{c}</button>
                              ))}
                            </div>
                          ))}
                          {alertRow("banks", "Banks", alertBanksLabel, (
                            <>
                              <div className="st-chips">
                                <button className="st-chip" aria-pressed={!showBankPicker} onClick={() => { setPickBanks(false); updateNotif({ banks: [] }); }}>All {BANK_COUNT} banks</button>
                                <button className="st-chip" aria-pressed={showBankPicker} onClick={() => setPickBanks(true)}>Choose banks</button>
                              </div>
                              {showBankPicker && (
                                <div className="st-chips al-bank-chips">
                                  {Object.entries(BANKS).map(([key, bank]) => (
                                    <button key={key} className="st-chip" aria-pressed={notifPrefs.banks.includes(key)} onClick={() => toggleNotifBank(key)}>{bank.shortName}</button>
                                  ))}
                                </div>
                              )}
                            </>
                          ))}
                          {alertRow("city", "City", notifCity || "Anywhere", (
                            <>
                              <div className="st-chips">
                                <button className="st-chip" aria-pressed={!notifCity} onClick={() => updateNotif({ location: "" })}>Anywhere</button>
                                {CITIES.map((c) => (
                                  <button key={c} className="st-chip" aria-pressed={notifCity.toLowerCase() === c.toLowerCase()} onClick={() => updateNotif({ location: c })}>{c}</button>
                                ))}
                              </div>
                              <input
                                className="notif-phone-input al-city-input"
                                type="text"
                                aria-label="Another city"
                                placeholder="Or type another city"
                                value={CITIES.some((c) => c.toLowerCase() === notifCity.toLowerCase()) ? "" : notifCity}
                                onChange={(e) => updateNotif({ location: e.target.value })}
                              />
                            </>
                          ))}
                        </div>

                        {/* HOW · channels with their switches right on the row */}
                        <div className="al-card">
                          <p className="al-card-label">How we reach you</p>
                          <div className="al-channel">
                            <div className="al-channel-head">
                              <span className="al-channel-icon al-channel-icon-sms" aria-hidden="true">
                                <svg width="16" height="16" viewBox="0 0 64 64" fill="white"><path d="M32 9C17.6 9 6 18.4 6 30c0 6.1 3.3 11.7 8.6 15.6-.5 3.7-2 7.2-4.5 10.1-.3.4 0 1 .5 1 5.5-.5 10.6-2.4 14.6-5.4C27.4 51.7 29.7 52 32 52c14.4 0 26-9.4 26-21S46.4 9 32 9z"/></svg>
                              </span>
                              <div className="al-channel-text">
                                <span className="al-row-label">Text message</span>
                                <span className="al-channel-sub">
                                  {notifPrefs.smsEnabled && notifPrefs.phoneNumber ? maskedPhone(notifPrefs.phoneNumber) : "Fastest. Most people use this."}
                                  {notifPrefs.smsEnabled && savedNotifPrefs.smsEnabled && savedNotifPrefs.phoneNumber && !editingPhone && (
                                    <> &middot; <button className="gate-link" onClick={() => setEditingPhone(true)}>Change</button></>
                                  )}
                                </span>
                              </div>
                              <button
                                className={`notif-toggle ${notifPrefs.smsEnabled ? "notif-toggle-on" : ""}`}
                                role="switch"
                                aria-checked={notifPrefs.smsEnabled}
                                aria-label="Text message alerts"
                                onClick={() => updateNotif({ smsEnabled: !notifPrefs.smsEnabled })}
                              >
                                <span className="notif-toggle-knob" />
                              </button>
                            </div>
                            {notifPrefs.smsEnabled && (editingPhone || !(savedNotifPrefs.smsEnabled && savedNotifPrefs.phoneNumber)) && (
                              <div className="al-channel-body">
                                <label className="notif-field-label" htmlFor="notif-phone">Mobile number</label>
                                <input
                                  id="notif-phone"
                                  className="notif-phone-input"
                                  type="tel"
                                  autoComplete="tel"
                                  placeholder="(555) 000-0000"
                                  value={notifPrefs.phoneNumber || ""}
                                  onChange={(e) => updateNotif({ phoneNumber: e.target.value })}
                                />
                                <label className="notif-consent al-consent">
                                  <input
                                    type="checkbox"
                                    checked={notifPrefs.smsConsent}
                                    onChange={(e) => updateNotif({ smsConsent: e.target.checked })}
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
                          <div className="al-channel">
                            <div className="al-channel-head">
                              <span className="al-channel-icon al-channel-icon-email" aria-hidden="true">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
                              </span>
                              <div className="al-channel-text">
                                <span className="al-row-label">Email</span>
                                <span className="al-channel-sub">{user?.primaryEmailAddress?.emailAddress || "Your account email"}</span>
                              </div>
                              <button
                                className={`notif-toggle ${notifPrefs.enabled ? "notif-toggle-on" : ""}`}
                                role="switch"
                                aria-checked={notifPrefs.enabled}
                                aria-label="Email alerts"
                                onClick={() => updateNotif({ enabled: !notifPrefs.enabled })}
                              >
                                <span className="notif-toggle-knob" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="al-save">
                          <p className={`al-save-note${notifBlocker ? " notif-summary-blocked" : ""}`}>
                            {notifBlocker || (notifDirty ? "You have unsaved changes." : notifSaved ? "Saved." : "All changes saved.")}
                          </p>
                          <button className="h-cta al-save-btn" onClick={saveNotifPrefs} disabled={notifSaving || !!notifBlocker || !notifDirty}>
                            {notifSaving ? "Saving\u2026" : "Save changes"}
                          </button>
                        </div>
                      </div>

                      {/* PREVIEW · what these settings would send, from real postings */}
                      <aside className="al-preview" aria-label="Preview">
                        <p className="al-card-label">Preview</p>
                        <div className="al-preview-msg">
                          <span className={`al-channel-icon ${notifPrefs.smsEnabled || !notifPrefs.enabled ? "al-channel-icon-sms" : "al-channel-icon-email"}`} aria-hidden="true">
                            {notifPrefs.smsEnabled || !notifPrefs.enabled
                              ? <svg width="16" height="16" viewBox="0 0 64 64" fill="white"><path d="M32 9C17.6 9 6 18.4 6 30c0 6.1 3.3 11.7 8.6 15.6-.5 3.7-2 7.2-4.5 10.1-.3.4 0 1 .5 1 5.5-.5 10.6-2.4 14.6-5.4C27.4 51.7 29.7 52 32 52c14.4 0 26-9.4 26-21S46.4 9 32 9z"/></svg>
                              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>}
                          </span>
                          <div>
                            <div className="h-notif-head"><strong>Pete&rsquo;s Postings</strong><span>now</span></div>
                            <p>
                              {notifMatches[0]
                                ? <>{notifMatches[0].bank} just posted: {notifMatches[0].title}. Apply &rarr;</>
                                : "No open roles match right now. You'll hear the moment one posts."}
                            </p>
                          </div>
                        </div>
                        <p className="al-preview-count"><strong className="tnum">{notifMatches.length}</strong> open {notifMatches.length === 1 ? "role matches" : "roles match"} right now</p>
                        {notifMatches.length > 0 && (
                          <ol className="al-preview-list">
                            {notifMatches.slice(0, 4).map((job) => (
                              <li key={job.link}>
                                <span className="al-preview-title">{job.title}</span>
                                <span className="al-preview-meta">{job.bank}{job.location ? ` \u00b7 ${job.location}` : ""}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </aside>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Saved jobs view */}
            {viewingSaved && !viewNotifications && !isSignedIn && (
              <div className="notif-panel">
                <div className="notif-header">
                  <h2 className="notif-title">Save jobs for later</h2>
                  <p className="notif-desc">Create a free account to bookmark roles and keep track of what you&rsquo;ve applied to.</p>
                </div>
                <SignUpButton mode="modal"><button className="notif-save">Create free account</button></SignUpButton>
              </div>
            )}
            {viewingSaved && !viewNotifications && isSignedIn && (
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
                      <a href={trackedLink(job.link)} target="_blank" rel="noopener noreferrer" className={`job-row${job.expiredAt ? " job-row-expired" : ""}`} key={job.link}>
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
                {isSignedIn && !isSubscribed && last48hCount > 0 && (
                  <div className="recent-teaser-strip">
                    <span className="recent-teaser-content">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                      </svg>
                      <strong>{last48hCount}</strong> {last48hCount === 1 ? "job" : "jobs"} posted in the last 48 hours
                    </span>
                    <button className="recent-teaser-cta" onClick={() => router.push("/recent")}>
                      See them →
                    </button>
                  </div>
                )}
                {showWelcome && !isGatedBank && !isSignedIn && (
                  <div className="welcome-banner alerts-callout">
                    <div>
                      <p className="welcome-title">Get a text when the next one posts</p>
                      <p className="welcome-desc">Pick your banks and roles. Your first 5 alerts are free.</p>
                    </div>
                    <div className="welcome-actions">
                      <Link href="/start" className="alerts-callout-cta" onClick={() => capture("browse_alerts_cta_clicked")}>Get free alerts &rarr;</Link>
                      <button className="welcome-dismiss" onClick={dismissWelcome} aria-label="Dismiss">&times;</button>
                    </div>
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
                      if (!isSignedIn) { askToSignUp("save"); return; }
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
                      <a
                        href={trackedLink(job.link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="job-row"
                        key={index}
                        onClick={(e) => { if (!isSignedIn) { e.preventDefault(); askToSignUp("job", job); } }}
                      >
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

      {showCompanyRequest && (
        <div className="modal-overlay" data-state="open" onClick={() => setShowCompanyRequest(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="company-request-title" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowCompanyRequest(false)} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
            <div className="modal-prompt-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            <h2 id="company-request-title" className="modal-title">Request a company</h2>
            {isSubscribed ? (
              <>
                <p className="modal-subtitle">Tell us which company to add and we&rsquo;ll look into tracking its jobs.</p>
                <form className="company-request-form" onSubmit={sendCompanyRequest}>
                  <input
                    className="inquiry-input"
                    type="text"
                    placeholder="Company name"
                    aria-label="Company name"
                    maxLength={100}
                    autoFocus
                    value={companyRequest}
                    onChange={(e) => { setCompanyRequest(e.target.value); if (companyRequestStatus !== "sending") setCompanyRequestStatus(null); }}
                  />
                  <button className="modal-cta-primary" type="submit" disabled={companyRequestStatus === "sending" || companyRequest.trim().length < 2}>
                    {companyRequestStatus === "sending" ? "Sending..." : "Send request"}
                  </button>
                </form>
                {companyRequestStatus === "sent" && <p className="company-request-sent" role="status">Thanks, we got your request.</p>}
                {companyRequestStatus && !["sending", "sent"].includes(companyRequestStatus) && <p className="inquiry-error" role="alert">{companyRequestStatus}</p>}
              </>
            ) : (
              <>
                <p className="modal-subtitle">Requesting companies is a Pro feature. Upgrade to tell us which company to track next.</p>
                <div className="modal-actions">
                  <button className="modal-cta-primary" onClick={() => { setShowCompanyRequest(false); router.push("/pricing"); }}>See Pro plans</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {gate && <SignUpGate gate={gate} onClose={() => setGate(null)} />}

      {showProWelcome && (
        <ProWelcomeModal
          activated={isSubscribed}
          timedOut={proWelcomeTimedOut}
          onClose={() => setShowProWelcome(false)}
          onSetupAlerts={() => { setShowProWelcome(false); router.push("/notifications"); }}
        />
      )}

    </>
  );
}
