"use client";

import { useNavMenuLock, usePullToRefresh } from "@/lib/use-nav-menu";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, notFound } from "next/navigation";
import { useUser, useClerk, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { BANKS } from "@/lib/banks";
import BankLogo from "@/lib/bank-logo";
import { decodeEntities } from "@/lib/text";
import { JOB_TYPES as ALERT_JOB_TYPES, AREAS, CITIES, matchesAlertPrefs } from "@/lib/alert-options";
import { jobLevel, LEVEL_LABEL, LEVELS } from "@/lib/levels";
import { track } from "@/lib/track";
import { capture } from "@/lib/analytics";
import { useTrackSignup } from "@/lib/use-track-signup";
import { PLANS, PLAN_KEYS, planPrice } from "@/lib/plans";
import { trialFor } from "@/lib/alert-trial-days";
import { openBillingPortal } from "@/lib/billing";
import StartFlow from "@/app/start/StartFlow";
import AlertsPanel from "./AlertsPanel";

const FREE_BANKS = new Set(Object.keys(BANKS));

// Browse/Recent "Level" filter (lib/levels.js sorts each title into one of these).
const JOB_TYPES = { all: "All levels", ...LEVEL_LABEL };

// Postel's law: accept the way people actually type a search. Case, punctuation,
// "&" vs "and", word order and common shorthand ("gs", "s&t", "nyc") all match.
const SEARCH_ALIASES = {
  gs: "goldman", goldman: "goldman", jpm: "jpmorgan", jp: "jpmorgan", chase: "jpmorgan", ms: "morgan stanley",
  bofa: "bank of america", boa: "bank of america", baml: "bank of america", db: "deutsche", wf: "wells",
  hl: "houlihan", ib: "investment banking", ibd: "investment banking", st: "sales trading", snt: "sales trading",
  er: "research", pwm: "wealth", wm: "wealth", am: "asset management", pe: "private equity", quant: "quant",
  nyc: "new york", ny: "new york", sf: "san francisco", la: "los angeles", intern: "intern", internship: "intern",
};
function normalizeText(s) {
  return (s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\band\b/g, " ").replace(/\s+/g, " ").trim();
}
function matchesQuery(job, query) {
  const raw = (query || "").toLowerCase().replace(/s\s*&\s*t/g, "st");
  const tokens = normalizeText(raw).split(" ").filter(Boolean);
  if (!tokens.length) return true;
  // Each word typed must start a word in the job ("trad" finds "Trading"; "st" won't hit "analyst").
  const words = normalizeText(`${job.title} ${job.bank || ""} ${job.location || ""} ${job.category || ""}`).split(" ");
  const has = (t) => words.some((w) => w.startsWith(t));
  return tokens.every((t) => has(t) || (SEARCH_ALIASES[t] && SEARCH_ALIASES[t].split(" ").every(has)));
}

// "New" means posted in the last 48 hours: the bank's own posted date when it gives one (what the
// Posted column shows), otherwise when we first saw it. Same rule as /api/jobs-new.
const postedAt = (job) => Date.parse(job.postedDate) || job.detectedAt || 0;
const isLast48h = (job) => postedAt(job) > Date.now() - 48 * 3600 * 1000;

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
        <h2 id="pro-welcome-title" className="modal-title">Welcome to Premium</h2>
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
            {activated ? "Set up your text alerts" : "Activating Premium\u2026"}
          </button>
        </div>
        {!activated && timedOut && (
          <p className="modal-pending-note">This is taking longer than usual. Refresh the page in a minute, or email pete@petespostings.com if Premium still isn&rsquo;t on.</p>
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
// Every posting is US-based, so ", United States" only pushes the city out of view.
// Job links go through /go so clicks are counted before the visitor reaches the bank's site.
const trackedLink = (link) => `/go?u=${encodeURIComponent(link)}`;
const cleanLocation = (loc) => (loc || "").replace(/,\s*United States( of America)?/gi, "").trim();

// Banks write the same city many ways ("New York", "New York, NY, USA", "NEW YORK, New York (1271 6th Ave)").
// cityKeys turns a raw location into clean "City, ST" names so the Location filter lists each city once.
const US_STATES = { alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "district of columbia": "DC" };
const STATE_CODES = new Set(Object.values(US_STATES));
// Cities banks often list without a state.
const CITY_STATE = { "new york": "NY", charlotte: "NC", jacksonville: "FL", atlanta: "GA", houston: "TX", dallas: "TX", phoenix: "AZ", chandler: "AZ", chicago: "IL", "san francisco": "CA", "los angeles": "CA", scranton: "PA", boston: "MA", miami: "FL", tampa: "FL", "salt lake city": "UT", "jersey city": "NJ", wilmington: "DE", pennington: "NJ", columbus: "OH", denver: "CO", seattle: "WA", irving: "TX", plano: "TX", whippany: "NJ", purchase: "NY", cary: "NC", hialeah: "FL", richmond: "VA", baltimore: "MD", philadelphia: "PA", "west palm beach": "FL" };
const MULTI_CITY = "Multiple locations";
const titleCase = (s) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
function cityKeys(raw) {
  const out = [];
  for (let part of (raw || "").split(";")) {
    part = part.replace(/\(.*?\)/g, "").replace(/,?\s*(United States( of America)?|USA|US)\s*$/i, "").trim();
    if (!part) continue;
    if (/^\d+\s+locations?$|^multiple locations$/i.test(part)) { out.push(MULTI_CITY); continue; }
    const bits = part.split(",").map((b) => b.trim()).filter(Boolean);
    // Drop building numbers and suffixes: "Charlotte #2", "New York 601 Lex", "Va – U.S.", "Tx-Main Street".
    let city = bits[0].replace(/\s*#?\d.*$/, "").replace(/^new york city$/i, "New York");
    let state = (bits[1] || "").replace(/\s*[-–].*$/, "").trim();
    if (STATE_CODES.has(city.toUpperCase()) && !state) { state = city.toUpperCase(); city = Object.keys(US_STATES).find((k) => US_STATES[k] === state); }
    const code = STATE_CODES.has(state.toUpperCase()) ? state.toUpperCase() : US_STATES[state.toLowerCase()] || (state ? "" : CITY_STATE[city.toLowerCase()]);
    out.push(code ? `${titleCase(city)}, ${code}` : bits.length > 1 && !code ? `${titleCase(city)}, ${titleCase(state)}` : titleCase(city));
  }
  return [...new Set(out)];
}
// [value, count] pairs, biggest first; "Other" / "Multiple locations" always last.
function rankCounts(values, last) {
  const counts = {};
  for (const v of values) if (v) counts[v] = (counts[v] || 0) + 1;
  return Object.entries(counts).sort((a, b) => (a[0] === last) - (b[0] === last) || b[1] - a[1] || a[0].localeCompare(b[0]));
}

// Homepage comparison chart: [row label, on your own, Pete's Postings]
const COMPARE_ROWS = [
  ["Coverage", `${BANK_COUNT} career sites, checked one by one`, `All ${BANK_COUNT} banks in one feed`],
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
  ["Is it really free?", `Browsing is. A free account gets you every open role at all ${BANK_COUNT} banks and saved jobs, with no credit card. Text and email alerts are free too. After your first 3 days, opening roles from your alerts and the feed of everything posted in the last 48 hours take Premium, $4.99 a month.`],
  ["How fast are the alerts?", "We check every bank's career site every 5 minutes, around the clock. When a new role matches what you picked, your text or email goes out right away."],
  ["Will I get spammed?", "No. You only hear about roles at the banks, job types and cities you choose. Change them or turn alerts off whenever you like."],
  ["Where do the jobs come from?", "Straight from each bank's own careers site, not LinkedIn or Indeed, with a direct link to apply."],
];


// Banks re-date old postings and some only give a date, so use whichever is newer and
// fall back to a day label when all we have is a date.
// Phone filter panel: the main banking areas first, everything else after (alphabetical).
const AREA_ORDER = ["Investment Banking", "Sales & Trading", "Corporate Banking", "Wealth Management", "Research", "Quantitative", "Alternative Investments"];
function areaRank(cat) {
  const i = AREA_ORDER.indexOf(cat);
  return i === -1 ? AREA_ORDER.length : i;
}

// Ages always follow the bank's own posted date. Most banks give only a date (no time), so those
// read "Today" / "Yesterday" / "3d ago". Our detection time is used only when a bank gives no date.
function feedAge(job) {
  const posted = Date.parse(job.postedDate) || 0;
  if (posted && job.postedDate.endsWith("T00:00:00.000Z")) {
    const today = new Date(); const d = new Date(posted);
    const days = Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / 86400000);
    return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`;
  }
  return timeAgo(posted || job.detectedAt);
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

// Every "Set up alerts" button on the homepage goes to the Alerts tab.
function StartCta({ where, className = "h-cta" }) {
  return (
    <Link href="/start" className={className} onClick={() => capture("home_cta_clicked", { where })}>
      Set up alerts
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    </Link>
  );
}

// Counts up from 0 the first time it scrolls into view.
function CountUp({ value, format = (n) => n.toLocaleString() }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || !value) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setShown(value); return; }
    let raf = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / 1100);
        setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]);
  return <span ref={ref} className="tnum">{format(shown)}</span>;
}

const ARROW = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
const MSG_ICON = <svg width="16" height="16" viewBox="0 0 64 64" fill="white" aria-hidden="true"><path d="M32 9C17.6 9 6 18.4 6 30c0 6.1 3.3 11.7 8.6 15.6-.5 3.7-2 7.2-4.5 10.1-.3.4 0 1 .5 1 5.5-.5 10.6-2.4 14.6-5.4C27.4 51.7 29.7 52 32 52c14.4 0 26-9.4 26-21S46.4 9 32 9z"/></svg>;

// Alerts tab (signed out): same promise as /start. Real recent roles land on a phone lock
// screen one by one; the one action goes straight to the preferences on /start.
const SMS_ICON = <svg width="16" height="16" viewBox="0 0 64 64" fill="#fff" aria-hidden="true"><path d="M32 9C17.6 9 6 18.4 6 30c0 6.1 3.3 11.7 8.6 15.6-.5 3.7-2 7.2-4.5 10.1-.3.4 0 1 .5 1 5.5-.5 10.6-2.4 14.6-5.4C27.4 51.7 29.7 52 32 52c14.4 0 26-9.4 26-21S46.4 9 32 9z"/></svg>;
function AlertsPhoneDemo({ jobs, onStart }) {
  const feed = [...(jobs || [])].filter((j) => j.title && j.title.length < 70).sort((a, b) => postedAt(b) - postedAt(a)).slice(0, 10);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setTick((t) => t + 1), 1400);
    return () => clearInterval(id);
  }, []);
  const landed = Math.floor((tick + 1) / 3) + 1; // a new text every third beat, on "Your phone buzzes"
  const shown = feed.length ? Array.from({ length: Math.min(3, landed) }, (_, k) => feed[(landed - 1 - k) % feed.length]) : [];
  const minute = String((41 + landed * 3) % 60).padStart(2, "0");
  return (
    <div className="ap">
      <div className="ap-copy">
        <h2 className="ap-title">Be first to apply. Not last to find out.</h2>
        <div className="ap-cta">
          <svg className="ap-arrow" viewBox="0 0 120 90" aria-hidden="true">
            <path d="M110 6 C 112 46, 78 70, 22 72" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="1 9" />
            <path d="M34 60 L 18 72 L 34 84" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {/* Opens the preferences right below, on this page */}
          <button className="h-cta ap-go" onClick={() => { capture("alerts_tab_cta_clicked"); onStart(); }}>
            Set up text alerts
          </button>
        </div>
      </div>
      <div className="ap-side">
      <span className="ap-label">What lands on your phone</span>
      <div className="ap-phone" role="img" aria-label="Example text alerts arriving on a phone">
        <div className="ap-screen">
          <span className="ap-date">Today</span>
          <span className="ap-clock">9:{minute}</span>
          {shown.map((job, k) => (
            <div key={`${landed - k}`} className={`ap-notif${k === 0 ? " is-new" : ""}`}>
              <span className="ap-icon">{SMS_ICON}</span>
              <div>
                <div className="ap-head"><strong>Pete&rsquo;s Postings</strong><span>{k === 0 ? "now" : `${k * 3}m ago`}</span></div>
                <p>{job.bank} just posted: {job.title}{job.cities?.[0] ? ` (${job.cities[0]})` : ""}. Apply &rarr;</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}

function HomePage({ onBrowse, isSignedIn, last48hCount, liveJobs }) {
  const liveCount = liveJobs?.length || 0;
  // Every count on the site is all live roles, the last 48 hours included.
  const browseCount = liveCount;
  const latest = homeFeed(liveJobs);
  const bankNames = Object.values(BANKS).map((b) => b.name);

  // Open roles per bank, biggest first, for the bar chart.
  const perBank = Object.entries(BANKS)
    .map(([key, b]) => ({ name: b.shortName, n: (liveJobs || []).filter((j) => j.bankKey === key).length }))
    .filter((b) => b.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 14);
  const maxPerBank = Math.max(1, ...perBank.map((b) => b.n));

  // Sections fade up as they scroll in.
  const rootRef = useRef(null);
  useEffect(() => {
    const els = rootRef.current?.querySelectorAll("[data-reveal]") || [];
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { els.forEach((el) => el.classList.add("is-in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [latest.length]);

  // Phones: sign-up bar pinned to the bottom between the hero button and the closing section.
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
    <div className="ss" ref={rootRef}>
      {/* HERO */}
      <section className="ss-hero">
        <h1 className="ss-title" data-reveal>The database of live banking roles</h1>
        <p className="ss-sub" data-reveal>
          See roles before other applicants with text notifications.
          Apply before everyone else.
        </p>
        <div className="ss-discover-row" ref={heroCtaRef} data-reveal>
          <Link href="/jobs" className="ss-discover" onClick={() => capture("home_cta_clicked", { where: "hero_browse" })}>
            Browse {browseCount > 0 ? `${browseCount.toLocaleString()} ` : ""}open roles <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>

      </section>

      {/* LATEST ROLES · leaderboard-style table of the real feed; each role opens its posting */}
      <section className="ss-shot" data-reveal>
        <div className="lb">
          <div className="lb-head">
            <h2>Latest roles</h2>
          </div>
          <div className="lb-scroll">
            <table className="lb-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th className="lb-num">Posted</th>
                </tr>
              </thead>
              <tbody>
                {(latest.length ? latest : HERO_NOTIFS.map((n, i) => ({ link: i, title: n.title, bank: n.bank, location: "New York, NY", detectedAt: Date.now() - (i + 1) * 3600000 }))).slice(0, 6).map((job, i) => (
                  <tr key={job.link} className="lb-row-link" role="link" tabIndex={0}
                    onClick={() => { capture("home_cta_clicked", { where: "latest_row" }); onBrowse(); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { capture("home_cta_clicked", { where: "latest_row" }); onBrowse(); } }}>
                    <td>
                      {/* Each row goes to Browse Jobs. */}
                      <div className="lb-startup">
                        <BankLogo bankKey={job.bankKey} bank={job.bank} size={40} className="lb-logo" />
                        <span className="lb-startup-text">
                          <span className="lb-name"><span className="lb-name-text">{job.title}</span>{i < 2 && <span className="ss-new">New</span>}</span>
                          <span className="lb-desc">{job.bank} &middot; {job.location}</span>
                        </span>
                      </div>
                    </td>
                    <td className="lb-num lb-time">{latest.length ? feedAge(job) : `${i + 1}h ago`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="lb-viewall" onClick={() => { capture("home_cta_clicked", { where: "shot_all" }); onBrowse(); }}>
            See all {browseCount > 0 ? `${browseCount.toLocaleString()} ` : ""}open roles &rarr;
          </button>
        </div>
        <div className="ss-logos" data-reveal>
          <p className="ss-logos-label">Pulled straight from the career sites of</p>
          <div className="ss-marquee" aria-label={bankNames.join(", ")}>
            <div className="ss-marquee-track" aria-hidden="true">
              {[...bankNames, ...bankNames].map((n, i) => <span key={i}>{n}</span>)}
            </div>
          </div>
        </div>
      </section>

      {/* STATS · live numbers with small visuals */}
      <section className="ss-section">
        <h2 className="ss-h2" data-reveal>Every bank, one feed.</h2>
        <p className="ss-lead" data-reveal>Live totals across the {BANK_COUNT} banks we track.</p>
        <div className="ss-stats">
          <div className="ss-card ss-stat" data-reveal>
            <p className="ss-stat-num"><CountUp value={liveCount} /></p>
            <p className="ss-stat-label">Open analyst and internship roles right now</p>
            <div className="ss-bars" aria-hidden="true">
              {perBank.map((b, i) => (
                <span key={b.name} title={`${b.name}: ${b.n}`} style={{ "--h": `${Math.max(8, (b.n / maxPerBank) * 100)}%`, "--d": `${i * 45}ms` }} />
              ))}
            </div>
          </div>
          <div className="ss-card ss-stat" data-reveal>
            <p className="ss-stat-num"><CountUp value={last48hCount || 0} /></p>
            <p className="ss-stat-label">New roles posted in the last 48 hours</p>
            <ul className="ss-mini-list">
              {latest.slice(0, 3).map((job) => (
                <li key={job.link}>
                  <span><b><BankLogo bankKey={job.bankKey} bank={job.bank} size={16} />{job.bank}</b>{job.title}</span>
                  <em className="ss-chip-green">New</em>
                </li>
              ))}
            </ul>
          </div>
          <div className="ss-card ss-stat" data-reveal>
            <p className="ss-stat-num">5 min</p>
            <p className="ss-stat-label">Between checks, around the clock</p>
            <ul className="ss-mini-list">
              {["Goldman Sachs", "JPMorgan Chase", "Morgan Stanley"].map((n, i) => (
                <li key={n}>
                  <span><b><BankLogo bank={n} size={16} />{n}</b><i className="ss-progress" style={{ "--d": `${i * 300}ms` }} /></span>
                  <em className="ss-chip-green">Checked</em>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="ss-snapshot" data-reveal>Live data, refreshed every 5 minutes</p>
        <div className="ss-center" data-reveal><StartCta where="stats" isSignedIn={isSignedIn} className="ss-btn" /></div>
      </section>

      {/* HOW IT WORKS · alternating rows with small product visuals */}
      <section className="ss-section">
        <p className="ss-eyebrow" data-reveal>How it works</p>
        <h2 className="ss-h2" data-reveal>Set it up once.<br />Hear about every match.</h2>
        <div className="ss-steps">
          <div className="ss-step" data-reveal>
            <div className="ss-step-copy">
              <p className="ss-step-n">01 <span>Pick what you want</span></p>
              <h3>Tell us what you&rsquo;re recruiting for.</h3>
              <p>Internship or full-time, the areas you care about, and the banks and cities you&rsquo;d take. Four quick questions.</p>
            </div>
            <div className="ss-visual">
              <div className="ss-chips">
                {[["Summer internship", true], ["Investment Banking", true], ["Sales & Trading", true], ["Research & Quant", false], ["New York", true], ["Chicago", false]].map(([label, on]) => (
                  <span key={label} className={on ? "on" : ""}>{label}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="ss-step ss-step-flip" data-reveal>
            <div className="ss-step-copy">
              <p className="ss-step-n">02 <span>We watch every bank</span></p>
              <h3>{BANK_COUNT} career sites, checked every 5 minutes.</h3>
              <p>Straight from each bank&rsquo;s own careers system, not LinkedIn or Indeed. You never refresh a page again.</p>
            </div>
            <div className="ss-visual">
              <div className="ss-bankgrid">
                {bankNames.slice(0, 12).map((n, i) => (
                  <span key={n} style={{ "--d": `${(i % 6) * 0.35}s` }}><i />{n}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="ss-step" data-reveal>
            <div className="ss-step-copy">
              <p className="ss-step-n">03 <span>Get a text</span></p>
              <h3>Hear about it in minutes, not days.</h3>
              <p>The role, the bank and a direct link to apply, by text, email or both.</p>
            </div>
            <div className="ss-visual">
              <div className="ss-notif ss-notif-static">
                <span className="h-notif-icon">{MSG_ICON}</span>
                <div className="h-notif-body">
                  <div className="h-notif-head"><strong>Pete&rsquo;s Postings</strong><span>now</span></div>
                  <p>Goldman Sachs just posted: 2027 Investment Banking Summer Analyst. Apply &rarr;</p>
                </div>
              </div>
            </div>
          </div>
          <div className="ss-step ss-step-flip" data-reveal>
            <div className="ss-step-copy">
              <p className="ss-step-n">04 <span>Apply first</span></p>
              <h3>Be early in the pile, not late.</h3>
              <p>Roles go up at random hours and get pulled within days. Applying in the first hours puts you ahead.</p>
            </div>
            <div className="ss-visual">
              <div className="ss-applied">
                <div>
                  <p className="ss-applied-title">2027 Investment Banking Summer Analyst</p>
                  <p className="ss-applied-meta">Goldman Sachs &middot; Posted 6 min ago</p>
                </div>
                <em className="ss-chip-green">Applied</em>
              </div>
            </div>
          </div>
        </div>
        <div className="ss-center" data-reveal><StartCta where="steps" isSignedIn={isSignedIn} className="ss-btn" /></div>
      </section>

      {/* PROOF · quotes mixed with tinted stat cards */}
      <section className="ss-section">
        <p className="ss-eyebrow" data-reveal>From students using it</p>
        <h2 className="ss-h2" data-reveal>Built for students without a pipeline.</h2>
        <div className="ss-proof">
          <div className="ss-card ss-card-tint" data-reveal>
            <p className="ss-proof-num">{BANK_COUNT} <small>banks</small></p>
            <p className="ss-proof-sub">Bulge brackets, elite boutiques and asset managers in one feed.</p>
          </div>
          <figure className="ss-card ss-quote" data-reveal>
            <blockquote>&ldquo;{HOME_QUOTES[0].quote}&rdquo;</blockquote>
            <figcaption><span className="ss-avatar">{HOME_QUOTES[0].name.split(" ").map((w) => w[0]).join("")}</span><span><strong>{HOME_QUOTES[0].name}</strong>{HOME_QUOTES[0].role}</span></figcaption>
          </figure>
          <figure className="ss-card ss-quote" data-reveal>
            <blockquote>&ldquo;{HOME_QUOTES[1].quote}&rdquo;</blockquote>
            <figcaption><span className="ss-avatar">{HOME_QUOTES[1].name.split(" ").map((w) => w[0]).join("")}</span><span><strong>{HOME_QUOTES[1].name}</strong>{HOME_QUOTES[1].role}</span></figcaption>
          </figure>
          <div className="ss-card ss-card-tint" data-reveal>
            <p className="ss-proof-num">5 <small>min</small></p>
            <p className="ss-proof-sub">From a bank posting a role to the text on your phone.</p>
          </div>
          <div className="ss-card ss-card-tint" data-reveal>
            <p className="ss-proof-num"><CountUp value={liveCount} /> <small>roles</small></p>
            <p className="ss-proof-sub">Open analyst and internship postings right now.</p>
          </div>
          <figure className="ss-card ss-quote" data-reveal>
            <blockquote>&ldquo;{HOME_QUOTES[2].quote}&rdquo;</blockquote>
            <figcaption><span className="ss-avatar">{HOME_QUOTES[2].name.split(" ").map((w) => w[0]).join("")}</span><span><strong>{HOME_QUOTES[2].name}</strong>{HOME_QUOTES[2].role}</span></figcaption>
          </figure>
        </div>
      </section>

      {/* PRICING */}
      <section className="ss-section">
        <p className="ss-eyebrow" data-reveal>Pricing</p>
        <h2 className="ss-h2" data-reveal>Browse free.<br />Get first in the stack.</h2>
        <div className="ss-plans ss-plans-one">
          <div className="ss-card ss-plan ss-plan-dark" data-reveal>
            <span className="ss-plan-banner">Premium</span>
            <p className="ss-plan-name">Apply first.</p>
            <p className="ss-plan-price">${PLANS.monthly.price}<span>/mo</span></p>
            <p className="ss-plan-free">Every new account gets Premium free for 3 days.</p>
            <ul>
              <li>Unlimited text messages</li>
              <li>Unlimited access to Recent postings</li>
              <li>Save jobs</li>
              <li>Track applications</li>
              <li>Request banks for us to add</li>
            </ul>
            <Link href="/pricing" className="ss-btn ss-btn-blue ss-btn-block" onClick={() => capture("home_cta_clicked", { where: "pricing_pro" })}>See Premium {ARROW}</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="ss-section ss-faq">
        <h2 className="ss-h2" data-reveal>Questions</h2>
        <div data-reveal>
          {HOME_FAQ.map(([q, a]) => (
            <details key={q} onToggle={(e) => { if (e.currentTarget.open) capture("faq_opened", { question: q, page: "home" }); }}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CLOSE */}
      <section className="ss-close" ref={closeRef} data-reveal>
        <h2 className="ss-h2">The next posting could go up tonight.</h2>
        <p className="ss-lead">Set up alerts in a minute. Hear about it first.</p>
        <div className="ss-center"><StartCta where="close" isSignedIn={isSignedIn} className="ss-btn" /></div>
        <p className="ss-note">Free account. No credit card.</p>
      </section>

      <div className={`h-sticky${showSticky ? " h-sticky-on" : ""}`}>
        <StartCta where="sticky" isSignedIn={isSignedIn} className="ss-btn ss-btn-block" />
      </div>
    </div>
  );
}

// ---- SIGN-UP GATE ----
// A sentence of context before the Clerk form, so signing up never comes out of nowhere.
// After signing up, a visitor who clicked a job goes straight to it.
const SIGNUP_GATES = {
  job: {
    title: "Create a free account to open this job",
    desc: "Free, no credit card. Then pick the roles you want texts about, or skip it.",
    cta: "Continue",
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
  // A job click signs up into the preferences funnel; signing in goes back to the job.
  const redirect = gate.redirect ? { forceRedirectUrl: gate.redirect, signInForceRedirectUrl: gate.signInRedirect || gate.redirect } : {};
  // Job links always open in a new tab, so after signing up we come back here and offer the job
  // as a link instead of sending this tab to the bank's site.
  const rememberJob = () => {
    if (!gate.job) return;
    try { sessionStorage.setItem("pp_open_job", JSON.stringify(gate.job)); } catch {}
  };

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
            <span><BankLogo bankKey={gate.job.bankKey} bank={gate.job.bank} size={16} />{gate.job.bank || BANKS[gate.job.bankKey]?.name}{gate.job.location ? ` \u00b7 ${gate.job.location}` : ""}</span>
          </p>
        )}
        <p className="gate-desc">{gate.desc}</p>
        <button className="h-cta gate-cta" onClick={() => { capture("signup_gate_continued", { kind: gate.kind }); rememberJob(); onClose(); clerk.openSignUp(redirect); }}>{gate.cta}</button>
        <p className="gate-fine">
          Free &middot; No credit card &middot; Have an account?{" "}
          <button className="gate-link" onClick={() => { rememberJob(); onClose(); clerk.openSignIn(redirect); }}>Sign in</button>
        </p>
      </div>
    </div>
  );
}

// ---- PAYWALL ----
// Recent Postings for non-Pro visitors: every role from the last 48 hours is listed with its bank
// logo, bank, city and age in plain sight; only the job title is blurred. Pro unlocks the titles.
function RecentLockedFeed({ isSignedIn, count, liveJobs }) {
  useEffect(() => { capture("paywall_viewed", { new_roles: count ?? null, signed_in: Boolean(isSignedIn), where: "recent_feed" }); }, []);
  const recent = [...(liveJobs || [])].filter(isLast48h).sort((a, b) => postedAt(b) - postedAt(a));
  const total = recent.length || count;
  const [loading, setLoading] = useState(false);
  function checkout() {
    track("InitiateCheckout", planPrice("monthly"));
    setLoading(true);
    // Signed out too: straight to Stripe; the account is made after payment and /welcome signs them in.
    fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isSignedIn ? { plan: "monthly" } : { plan: "monthly", next: "/recent" }) })
      .then((res) => res.json())
      .then((data) => {
        if (data.url) window.location.href = data.url;
        else if (data.alreadyPro) window.location.reload(); // already Pro: reload shows the feed
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }
  const plan = PLANS.monthly;
  return (
    <div className="rl">
      <h2 className="rl-title">
        {total > 0
          ? <><span className="rl-mark">{total} {total === 1 ? "role" : "roles"}</span> posted in the last <span className="rl-mark">48 hours</span></>
          : <>Roles posted in the last <span className="rl-mark">48 hours</span></>}
      </h2>
      <div className="rl-wall">
        {/* Same table as Browse Jobs, but not clickable, titles blurred, and the whole list sits behind the lock. */}
        <div className="jobs-list jobs-list-browse  rl-table" aria-hidden="true">
          <div className="job-row-header">
            <span className="job-index">#</span>
            <span className="job-logo-spacer" aria-hidden="true" />
            <span className="job-title">Title</span>
            <span className="job-location">Location</span>
            <span className="job-posted">Posted</span>
            <span className="job-badges">Type</span>
            <span className="new-bank-label">Bank</span>
            <span style={{ width: 14 }} />
            <span style={{ width: 14 }} />
          </div>
          {(recent.length ? recent : Array.from({ length: 8 }, (_, i) => ({ link: i, title: "Investment Banking Analyst", bank: "", location: "" }))).map((job, index) => (
            <div className="job-row" key={job.link}>
              <span className="job-index">{String(index + 1).padStart(2, "0")}</span>
              <BankLogo bankKey={job.bankKey} bank={job.bank} size={28} className="job-logo" />
              <span className="job-title rl-blur">{job.title}</span>
              <span className="job-meta-mobile">{job.bank}{job.location ? ` \u00b7 ${job.location}` : ""}</span>
              <span className="job-location">{job.location || "\u2014"}</span>
              <span className="job-posted tnum">{formatPostedAt(job)}</span>
              <div className="job-badges">
                <span className={`job-badge ${jobLevel(job.title) === "intern" ? "badge-intern" : "badge-analyst"}`}>{LEVEL_LABEL[jobLevel(job.title)]}</span>
              </div>
              <span className="new-bank-label">{job.bank}</span>
              <span style={{ width: 14 }} />
              <svg className="job-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          ))}
        </div>
        <div className="rl-lock-layer">
          <div className="rl-lock">
            <span className="rl-lock-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
            </span>
            <h3>Unlock recent postings</h3>
            <p className="rl-fine">Every role from the last 48 hours, plus a text the moment the next one posts.</p>
            <button className="paywall-plan-cta paywall-plan-cta-primary rl-cta" onClick={checkout} disabled={loading}>{loading ? "Opening checkout..." : "Unlock"}</button>
            <p className="rl-fine">{plan.trialDays ? `Free for ${plan.trialDays} days, then ` : ""}${plan.price}/{plan.period}. Cancel anytime.</p>
            {!isSignedIn && (
              <p className="rl-fine">Already Premium?{" "}<SignInButton mode="modal"><button className="paywall-link">Sign in</button></SignInButton></p>
            )}
          </div>
        </div>
      </div>
      <p className="rl-browse">Or <Link href="/jobs" className="text-link">browse every open role</Link> for free.</p>
    </div>
  );
}


function PaywallOverlay({ isSignedIn, newCount }) {
  useEffect(() => { capture("paywall_viewed", { new_roles: newCount ?? null, signed_in: Boolean(isSignedIn) }); }, []);
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
        else if (data.alreadyPro) window.location.reload(); // already Pro: reload shows it
        else { setLoading(false); setSelectedPlan(null); }
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
        <div className="paywall-badge">Premium</div>
        <h2 className="paywall-title">
          {newCount > 0 ? `${newCount} new ${newCount === 1 ? "role" : "roles"} in the last 48 hours` : "Premium"}
        </h2>
        <p className="paywall-desc">
          Premium shows you every role posted in the last 48 hours and texts you the moment new ones go live.
        </p>
      </div>

      <div className="paywall-unlocks">
        <p className="paywall-includes-label">What you unlock</p>
        <ul className="paywall-unlocks-list">
          {[
            ["Unlimited text alerts", "A text the moment a bank posts a role matching your banks, job type and city."],
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
              {featured && PLAN_KEYS.length > 1 && <div className="paywall-plan-tag">Most popular</div>}
              <h3 className="paywall-plan-name">{plan.name}</h3>
              <div className="paywall-plan-price">
                <span className="paywall-plan-amount">${plan.price}</span>
                <span className="paywall-plan-period">/{plan.period}</span>
              </div>
              <p className="paywall-plan-billing">{plan.perMonth ? `$${plan.perMonth.toFixed(2)}/mo, billed yearly` : plan.billed}</p>
              {ctaBtn(key, plan.trialDays ? `Start ${plan.trialDays}-day free trial` : "Get Premium", featured)}
            </div>
          );
        })}
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
// Written for readers and search engines alike: plain headings, real answers, and links to
// every bank's listings. The FAQ below doubles as FAQPage structured data for Google.
const ABOUT_FAQ = [
  ["Is Pete's Postings free?",
    `Yes. Browsing every open analyst and internship posting across all ${BANK_COUNT} banks is free. A free account adds saved jobs, with no credit card. Text and email alerts are free for your first 3 days. Premium keeps them opening and adds the 48-hour recent postings feed for $4.99 a month.`],
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
  ["Can I cancel Premium any time?",
    "Yes. Choose Manage subscription from your account menu to cancel online in a few clicks. You keep Premium until the end of the period you paid for."],
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
            <span>All open analyst and internship roles across {BANK_COUNT} banks in one searchable list, instead of checking {BANK_COUNT} different career sites every day.</span>
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
          Browsing is free. A free account adds saved jobs. Alerts are free for 3 days; after that, opening them and recent postings are part of <Link href="/pricing" className="text-link">Premium</Link>.
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
              <BankLogo bankKey={key} size={28} /><span className="about-bank-name">{bank.name}</span>
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
          <Link href="/start" className="h-cta" onClick={() => capture("about_cta_clicked")}>Set up alerts</Link>
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
function NewPostingsView({ isSubscribed, isSignedIn, data, loading, onSetupAlerts, liveJobs }) {
  const [rpSearch, setRpSearch] = useState("");
  const [rpJobType, setRpJobType] = useState("all");
  const [rpBank, setRpBank] = useState("");
  const [rpCategory, setRpCategory] = useState("");
  const [rpCity, setRpCity] = useState("");
  const [rpSheetOpen, setRpSheetOpen] = useState(false);
  useEffect(() => {
    if (!rpSheetOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setRpSheetOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rpSheetOpen]);

  if (loading) return <SkeletonRows />;

  const { last48h = [], last48hCount = 0 } = data || {};

  const availableBanks = [...new Set(last48h.map((j) => j.bank).filter(Boolean))].sort();
  const availableCategories = [...new Set(last48h.map((j) => j.category).filter(Boolean))].sort();

  const displayJobs = last48h.filter((job) => {
    if (rpSearch && !job.title.toLowerCase().includes(rpSearch.toLowerCase())) return false;
    if (rpJobType !== "all" && jobLevel(job.title) !== rpJobType) return false;
    if (rpBank && job.bank !== rpBank) return false;
    if (rpCategory && job.category !== rpCategory) return false;
    if (rpCity && !cityKeys(job.location).includes(rpCity)) return false;
    return true;
  });
  // Phones: the same filter bar + bottom panel as Browse (bank, area, type, city).
  const rpBankKeys = Object.fromEntries(last48h.map((j) => [j.bank, j.bankKey]));
  const rpCityOptions = rankCounts(last48h.flatMap((j) => cityKeys(j.location)), MULTI_CITY);

  const hasActiveFilter = rpSearch || rpJobType !== "all" || rpBank || rpCategory || rpCity;

  function JobCard({ job, index }) {
    const effectiveTime = job.effectiveTime || job.detectedAt || 0;
    const timeLabel = formatRelativeDate(effectiveTime, job.hasActualDate);

    return (
      <a href={trackedLink(job.link)} target="_blank" rel="noopener noreferrer" className="job-row"
        onClick={() => capture("job_opened", { view: "recent", bank: job.bank, category: job.category, title: job.title, position: index + 1 })}>
        <span className="job-index">{String(index + 1).padStart(2, "0")}</span>
        <BankLogo bankKey={job.bankKey} bank={job.bank} size={28} className="job-logo" />
        <span className="job-title">{job.title}</span>
        <span className="job-location">{cleanLocation(job.location) || "—"}</span>
        <div className="job-badges job-badges-wide">
          <span className={`job-badge ${jobLevel(job.title) === "intern" ? "badge-intern" : "badge-analyst"}`}>
            {LEVEL_LABEL[jobLevel(job.title)]}
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
      <span className="job-logo-spacer" aria-hidden="true" />
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
          <RecentLockedFeed isSignedIn={isSignedIn} count={last48hCount} liveJobs={liveJobs} />
        ) : (
          <>
            <div className="mfb">
              <button className="mfb-bar" onClick={() => setRpSheetOpen(true)} aria-haspopup="dialog">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="12" y1="18" x2="20" y2="18"/>
                </svg>
                <span className="mfb-summary">
                  <b>{rpBank || "All banks"}</b>
                  {rpCategory && <>{" \u00b7 "}{rpCategory}</>}
                  {" \u00b7 "}{rpJobType === "all" ? "All levels" : JOB_TYPES[rpJobType]}
                  {" \u00b7 "}{rpCity || "All cities"}
                </span>
                <svg className="mfb-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
              </button>
            </div>
            {rpSheetOpen && (
              <div className="mfs-wrap" role="dialog" aria-modal="true" aria-label="Filter recent roles">
                <button className="mfs-shade" aria-label="Close filters" onClick={() => setRpSheetOpen(false)} />
                <div className="mfs">
                  <div className="mfs-top">
                    <p className="mfs-title">Filters</p>
                    <button className="mfs-x" aria-label="Close filters" onClick={() => setRpSheetOpen(false)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
                  </div>
                  <div className="mfs-sec">
                    <p className="mfs-h">Bank</p>
                    <div className="mfs-banks">
                      <button className={`mfs-bank mfs-bank-all${rpBank === "" ? " is-on" : ""}`} onClick={() => setRpBank("")}>All</button>
                      {rankCounts(last48h.map((j) => j.bank)).map(([bank]) => (
                        <button key={bank} className={`mfs-bank${rpBank === bank ? " is-on" : ""}`} onClick={() => setRpBank(bank)}>
                          <BankLogo bankKey={rpBankKeys[bank]} bank={bank} size={18} />{BANKS[rpBankKeys[bank]]?.shortName || bank}
                        </button>
                      ))}
                    </div>
                  </div>
                  {availableCategories.length > 0 && (
                    <div className="mfs-sec">
                      <p className="mfs-h">Area</p>
                      <div className="mfs-banks">
                        <button className={`mfs-bank mfs-bank-all${rpCategory === "" ? " is-on" : ""}`} onClick={() => setRpCategory("")}>All</button>
                        {[...availableCategories].sort((x, y) => areaRank(x) - areaRank(y) || x.localeCompare(y)).map((cat) => (
                          <button key={cat} className={`mfs-bank mfs-bank-all${rpCategory === cat ? " is-on" : ""}`} onClick={() => setRpCategory(cat)}>{cat}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mfs-sec">
                    <p className="mfs-h">Level</p>
                    <div className="mfs-banks mfs-row mfs-areas mfs-levels">
                      {[["all", "All"], ...LEVELS.map((l) => [l.key, l.label])].map(([key, label]) => (
                        <button key={key} className={`mfs-bank mfs-bank-all${rpJobType === key ? " is-on" : ""}`} onClick={() => setRpJobType(key)}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="mfs-sec">
                    <label className="mfs-h" htmlFor="rp-city">City</label>
                    <select id="rp-city" className="mfs-select" value={rpCity} onChange={(e) => setRpCity(e.target.value)}>
                      <option value="">All cities</option>
                      {rpCityOptions.map(([loc, n]) => <option key={loc} value={loc}>{loc} ({n})</option>)}
                    </select>
                  </div>
                  <div className="mfs-foot">
                    <button className="mfs-clear" onClick={() => { setRpBank(""); setRpJobType("all"); setRpCity(""); setRpCategory(""); setRpSearch(""); }}>Clear</button>
                    <button className="mfs-go" onClick={() => setRpSheetOpen(false)}>Show {displayJobs.length} {displayJobs.length === 1 ? "role" : "roles"}</button>
                  </div>
                </div>
              </div>
            )}
            {/* Filters */}
            <div className="filters-container">
              <div className="filters">
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
                  onClick={() => { setRpSearch(""); setRpJobType("all"); setRpBank(""); setRpCategory(""); setRpCity(""); }}>
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
  // isPaid: on Premium. isSubscribed: can see everything right now, which is Premium or the
  // first 3 days after sign-up (lib/alert-trial-days.js). Content gates use isSubscribed.
  const isPaid = user?.publicMetadata?.subscribed === true;
  const trialActive = Boolean(isSignedIn && user && !isPaid && !trialFor(user.createdAt).over);
  const isSubscribed = isPaid || trialActive;

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
    // All banks is the default, so it gets no parameter: /jobs, not /jobs?bank=all.
    const url = new URL(window.location.href);
    const want = activeBank === "all" ? null : activeBank;
    if (url.searchParams.get("bank") !== want) {
      if (want) url.searchParams.set("bank", want); else url.searchParams.delete("bank");
      window.history.replaceState(null, "", url);
    }
  }, [activeBank]);
  const [jobType, setJobType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [allJobs, setAllJobs] = useState([]);
  // Pull-to-refresh (phones) bumps this; the job loaders below re-run when it changes.
  const [refreshKey, setRefreshKey] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  useNavMenuLock(accountOpen, () => setAccountOpen(false));
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bankCounts, setBankCounts] = useState({});
  const [justSaved, setJustSaved] = useState(null);
  const justSavedTimer = useRef(null);
  const [bookmarks, setBookmarks] = useState(new Set());
  const [savedJobs, setSavedJobs] = useState([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  // Browse analytics: one event per search (after typing pauses), filter change, and bank switch.
  const browseTracked = useRef(false);
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return;
    const id = setTimeout(() => capture("jobs_searched", { query: q.slice(0, 80), bank: activeBank }), 1000);
    return () => clearTimeout(id);
  }, [searchQuery]);
  useEffect(() => {
    if (!browseTracked.current) return;
    capture("jobs_filtered", { location: locationFilter || "any", job_type: jobType, category: categoryFilter || "any", bank: activeBank });
  }, [locationFilter, jobType, categoryFilter]);
  useEffect(() => {
    if (!browseTracked.current) { browseTracked.current = true; return; }
    capture("bank_selected", { bank: activeBank, bank_name: BANKS[activeBank]?.name || "All banks" });
  }, [activeBank]);
  const [availableCategories, setAvailableCategories] = useState([]);
  // Signed-out visitors who try something that needs an account see why first (see SignUpGate).
  const [gate, setGate] = useState(null);
  function askToSignUp(kind, job) {
    capture("signup_gate_shown", { kind });
    if (job) {
      // A job click goes straight to the sign-up form, then into the SMS setup steps; the job
      // is offered once they finish (openjob). Signing in instead goes back to the job.
      try { sessionStorage.setItem("pp_open_job", JSON.stringify(job)); } catch {}
      const back = new URL(window.location.href);
      back.searchParams.set("openjob", "1");
      clerk.openSignUp({ forceRedirectUrl: "/start?setup=1", signInForceRedirectUrl: back.pathname + back.search });
      return;
    }
    setGate({ ...SIGNUP_GATES[kind], kind });
  }
  // Back from the sign-up a job click asked for: show that job with a new-tab link.
  const [readyJob, setReadyJob] = useState(null);
  useEffect(() => {
    if (!isSignedIn) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("openjob") !== "1") return;
    url.searchParams.delete("openjob");
    window.history.replaceState(null, "", url.pathname + url.search);
    try {
      const job = JSON.parse(sessionStorage.getItem("pp_open_job") || "null");
      sessionStorage.removeItem("pp_open_job");
      if (job?.link) setReadyJob(job);
    } catch {}
  }, [isSignedIn]);
  const [notifPrefs, setNotifPrefs] = useState(NOTIF_DEFAULTS);
  const [notifLoading, setNotifLoading] = useState(false);
  // Free accounts: { used, limit } of their free alerts; null for Pro (unlimited).
  const [alertTrial, setAlertTrial] = useState(null);
  const [hasSavedPrefs, setHasSavedPrefs] = useState(false); // saved preferences at least once, alerts on or off
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);
  // Browse: "mine" = only roles matching their alert preferences, "all" = everything. Remembered per browser.
  const [browseMode, setBrowseModeState] = useState("mine");
  useEffect(() => { try { const v = localStorage.getItem("pp-browse-mode"); if (v === "all" || v === "mine") setBrowseModeState(v); } catch {} }, []);
  const setBrowseMode = (v) => { setBrowseModeState(v); capture("browse_mode_changed", { mode: v }); try { localStorage.setItem("pp-browse-mode", v); } catch {} }; // alert preferences, opened from the Browse filters
  const [jobStatus, setJobStatus] = useState({}); // { [link]: { alertedAt, alertedVia, viewedAt, appliedAt } } from Postgres
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  // Fresh from the /start sign-up: say what's on and invite them to fine-tune.
  const [alertsWelcome, setAlertsWelcome] = useState(false);
  const [alertsSetupSignal, setAlertsSetupSignal] = useState(0); // bumps to open the setup steps on the Alerts tab
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("welcome") !== "1") return;
    setAlertsWelcome(true);
    url.searchParams.delete("welcome");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);
  useEffect(() => {
    if (!savedToast) return;
    const id = setTimeout(() => setSavedToast(false), 3200);
    return () => clearTimeout(id);
  }, [savedToast]);
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
    // New subscriptions start as a free trial. The event ID matches the Stripe webhook's server
    // copy (app/api/webhook/route.js) so the ad platforms count it once.
    const sessionId = url.searchParams.get("session_id") || "";
    track("StartTrial", planPrice(url.searchParams.get("plan")), sessionId && `trial_${sessionId}`);
    url.searchParams.delete("subscribed");
    url.searchParams.delete("plan");
    url.searchParams.delete("session_id");
    window.history.replaceState(null, "", url);
    setShowProWelcome(true);
  }, []);

  useTrackSignup(user);
  useEffect(() => {
    if (!showProWelcome || !user || isPaid) return;
    let tries = 0;
    const id = setInterval(() => {
      tries++;
      user.reload().catch(() => {});
      if (tries >= 15) { clearInterval(id); setProWelcomeTimedOut(true); }
    }, 2000);
    return () => clearInterval(id);
  }, [showProWelcome, user, isPaid]);

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
  // Phones: the /jobs filter panel (bank, type, city) that slides up from the bottom.
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  // Jakob's law: Escape closes the filter panel like every other sheet on the web.
  useEffect(() => {
    if (!filterSheetOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setFilterSheetOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filterSheetOpen]);
  const [sheetAllBanks, setSheetAllBanks] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  useNavMenuLock(navMenuOpen, () => setNavMenuOpen(false));
  const [bankSearch, setBankSearch] = useState("");

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
        setAlertTrial(data.trial || null);
        setHasSavedPrefs(Boolean(data.hasPrefs));
      })
      .catch(() => setSavedNotifPrefs((prev) => prev ?? NOTIF_DEFAULTS))
      .finally(() => setNotifLoading(false));
  }, [isLoaded, isSignedIn, isSubscribed]);

  // Fetch 48h count on load for persistent banner
  useEffect(() => {
    if (!isLoaded) return;
    fetch("/api/jobs-new")
      .then((res) => res.json())
      .then((data) => setLast48hCount((c) => c ?? (data.last48hCount || 0))) // the job list's own count wins
      .catch(() => {});
  }, [isLoaded]);

  // Sidebar counts are every live role at each bank, the last 48 hours included.
  useEffect(() => {
    if (!allJobs.length) return;
    const counts = Object.fromEntries(Object.keys(BANKS).map((key) => [key, 0]));
    for (const job of allJobs) if (job.bankKey in counts) counts[job.bankKey]++;
    setBankCounts(counts);
  }, [allJobs]);
  // The 48-hour count comes from the same list as every other number, once it has loaded.
  useEffect(() => {
    if (allJobs.length) setLast48hCount(allJobs.filter(isLast48h).length);
  }, [allJobs]);

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
        const loaded = (data.jobs || []).map((job) => ({ ...job, title: decodeEntities(job.title), location: cleanLocation(job.location), cities: cityKeys(job.location) }));
        setAllJobs(loaded);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [isLoaded, refreshKey]);

  // Fetch recent postings data when that view is opened
  useEffect(() => {
    if (!viewNewPostings) return;
    setNewPostingsLoading(true);
    fetch("/api/jobs-new")
      .then((res) => res.json())
      .then((data) => {
        setNewPostingsData(data);
      })
      .catch(() => {})
      .finally(() => setNewPostingsLoading(false));
  }, [viewNewPostings, refreshKey]);

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

    // Roles from the last 48 hours are what Pro unlocks (Recent Postings), so Browse leaves them out for everyone else.
    const isPro = isSignedIn && isSubscribed;
    const bankJobs = (activeBank === "all"
      ? allJobs.filter((job) => FREE_BANKS.has(job.bankKey) || isPro)
      : allJobs.filter((job) => job.bankKey === activeBank)
    ).filter((job) => isPro || !isLast48h(job));
    setJobs(bankJobs);

    const cats = [...new Set(bankJobs.map((job) => job.category).filter(Boolean))].sort();
    setAvailableCategories(cats);
  }, [activeBank, allJobs, isSignedIn, isSubscribed]);

  function toggleBookmark(e, job) {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) { askToSignUp("save"); return; }
    const link = job.link;
    capture(bookmarks.has(link) ? "job_unsaved" : "job_saved", { bank: job.bank || BANKS[activeBank]?.name, title: job.title, category: job.category });
    // Exaggerated feedback: saving plays a squash-and-stretch pop with a small burst.
    if (!bookmarks.has(link)) {
      setJustSaved(link);
      clearTimeout(justSavedTimer.current);
      justSavedTimer.current = setTimeout(() => setJustSaved(null), 650);
    }
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(link)) next.delete(link); else next.add(link);
      return next;
    });
    setSavedJobs((prev) => {
      let next;
      const removing = prev.some((j) => j.link === link);
      capture(removing ? "job_unsaved" : "job_saved", { bank: job.bank || BANKS[activeBank]?.name || "", title: job.title });
      if (removing) {
        next = prev.filter((j) => j.link !== link);
      } else {
        next = [...prev, { title: job.title, link: job.link, location: job.location || "", bank: job.bank || BANKS[activeBank]?.name || "" }];
      }
      user.update({ unsafeMetadata: { ...user.unsafeMetadata, savedJobs: next } });
      return next;
    });
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
    .sort((x, y) => postedAt(y) - postedAt(x));
  const notifDirty = savedNotifPrefs !== null && alertSettingsKey(notifPrefs) !== alertSettingsKey(savedNotifPrefs);
  const alertsOn = Boolean(savedNotifPrefs && (savedNotifPrefs.enabled || savedNotifPrefs.smsEnabled));
  // Alerts are free, so anyone signed in with alerts on (or on Premium) gets the settings page.
  // Texted / viewed / applied per job, from Postgres, shown on the Browse rows.
  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/job-status").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.statuses) setJobStatus(d.statuses); }).catch(() => {});
  }, [isSignedIn]);
  // There is no Alerts page any more: alerts are a panel on Browse. Signed out, alerts start at /start.
  usePullToRefresh(!viewHome && !viewAbout, () => { setRefreshKey((k) => k + 1); capture("pull_to_refresh"); });

  function openAlerts() {
    if (!isSignedIn) { router.push("/start"); return; }
    // Recent postings opens the panel in place; anywhere else goes to Browse, where it lives.
    if (!viewNewPostings) { setViewNotifications(false); setViewingSaved(false); setViewHome(false); }
    setAlertsPanelOpen(true);
    // The panel sits at the top of the content; bring it into view.
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
    capture("alerts_panel_opened");
  }
  // Old /notifications links (emails, bookmarks) land on Browse with the panel open.
  useEffect(() => {
    if (!viewNotifications || !isLoaded) return;
    if (!isSignedIn) { router.replace("/start"); return; }
    openAlerts();
  }, [viewNotifications, isLoaded, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps
  // ?alerts=1 opens the panel (links from emails and the nav).
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("alerts") !== "1") return;
    url.searchParams.delete("alerts");
    window.history.replaceState(null, "", url.pathname + url.search);
    setAlertsPanelOpen(true);
  }, [isLoaded, isSignedIn]);
  const patchJobStatus = (link, patch) => setJobStatus((m) => ({ ...m, [link]: { ...(m[link] || {}), ...patch } }));
  function toggleApplied(job) {
    const applied = !jobStatus[job.link]?.appliedAt;
    patchJobStatus(job.link, { appliedAt: applied ? new Date().toISOString() : null });
    capture("job_marked_applied", { applied, bank: job.bank, where: "alerts" });
    fetch("/api/job-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ link: job.link, applied }) })
      .then((r) => { if (!r.ok) throw new Error(); })
      .catch(() => patchJobStatus(job.link, { appliedAt: applied ? null : jobStatus[job.link]?.appliedAt || null }));
  }
  const maskedPhone = (num) => { const d = (num || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, ""); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : num || "your phone"; };
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
      capture("bank_requested", { company: companyRequest.trim() });
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
      .then((data) => { if (data.success) { setHasSavedPrefs(true); setNotifSaved(true); setSavedToast(true); setSavedNotifPrefs(notifPrefs); setOpenAlertRow(null); setEditingPhone(false); setAlertsPanelOpen(false); } })
      .catch(() => {})
      .finally(() => setNotifSaving(false));
  }

  const typeOf = (job) => jobLevel(job.title);
  const okType = (job) => jobType === "all" || typeOf(job) === jobType;
  const okLocation = (job) => locationFilter === "" || (job.cities || []).includes(locationFilter);
  const okCategory = (job) => categoryFilter === "" || (job.category || "") === categoryFilter;
  // Browse shows the roles that match their saved preferences ("My preferences") until they
  // switch to "All roles". For anyone signed in who has saved preferences, alerts on or off.
  const hasAlertPrefs = Boolean(isSignedIn && savedNotifPrefs && (hasSavedPrefs || alertsOn));
  const usePrefs = hasAlertPrefs && browseMode === "mine";
  const matchesMine = (job) => matchesAlertPrefs(job, { ...savedNotifPrefs, location: (savedNotifPrefs.location || "").trim() });
  const okPrefs = (job) => !usePrefs || matchesMine(job);
  const searched = jobs.filter((job) => (searchQuery === "" || matchesQuery(job, searchQuery)) && okPrefs(job));
  const filteredJobs = searched.filter((job) => okType(job) && okLocation(job) && okCategory(job));
  // Each dropdown counts the jobs left after the OTHER filters, so its numbers always add up to what you'd see.
  const locationOptions = rankCounts(searched.filter((j) => okType(j) && okCategory(j)).flatMap((j) => j.cities || []), MULTI_CITY);
  const typeCounts = Object.fromEntries(rankCounts(searched.filter((j) => okLocation(j) && okCategory(j)).map(typeOf)));
  const categoryOptions = rankCounts(searched.filter((j) => okType(j) && okLocation(j)).map((j) => j.category), "Other");
  const withSelected = (opts, sel) => (sel && !opts.some(([v]) => v === sel) ? [[sel, 0], ...opts] : opts);

  const displayJobs = showSavedOnly ? filteredJobs.filter((job) => bookmarks.has(job.link)) : filteredJobs;
  // Counts for the My preferences | All roles switch, after search and the dropdown filters.
  const modeBase = hasAlertPrefs ? jobs.filter((job) => (searchQuery === "" || matchesQuery(job, searchQuery)) && okType(job) && okLocation(job) && okCategory(job)) : [];
  const mineCount = hasAlertPrefs ? modeBase.filter(matchesMine).length : 0;
  // The roles Browse leaves out without Pro, for the locked rows at the top of the list.
  const lockedRecent = (isSignedIn && isSubscribed) || showSavedOnly ? [] : allJobs
    .filter((j) => isLast48h(j) && (activeBank === "all" || j.bankKey === activeBank))
    .sort((a, b) => postedAt(b) - postedAt(a));
  const savedCount = [...bookmarks].filter((link) => filteredJobs.some((job) => job.link === link)).length;
  const isGatedBank = activeBank !== "all" && !FREE_BANKS.has(activeBank) && (!isSignedIn || !isSubscribed);

  // Homepage: the root background goes dark so overscroll above the hero shows navy, not cream.
  useEffect(() => {
    document.documentElement.removeAttribute("data-dark-top");
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
        <span className="sidebar-bank"><BankLogo bankKey={key} size={18} /><span className="bank-name-full">{bank.name}</span><span className="bank-name-short">{bank.shortName}</span></span>
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

  // ALERTS PANEL · alert preferences live next to the Browse filters (inline on desktop, a sheet on phones).
  const alertsPanel = alertsPanelOpen && isSignedIn && (
    <AlertsPanel
      prefs={savedNotifPrefs ? notifPrefs : null}
      saved={savedNotifPrefs}
      loading={notifLoading}
      email={user?.primaryEmailAddress?.emailAddress}
      trialOver={!isPaid && Boolean(alertTrial?.over)}
      pickBanks={pickBanks}
      onPickBanks={setPickBanks}
      onChange={updateNotif}
      onToggleArea={toggleNotifArea}
      onToggleBank={toggleNotifBank}
      editingPhone={editingPhone}
      onEditPhone={setEditingPhone}
      onSave={saveNotifPrefs}
      saving={notifSaving}
      dirty={notifDirty}
      blocker={notifBlocker}
      onClose={() => setAlertsPanelOpen(false)}
    />
  );
  // What we've done about a job for this person (Postgres: user_job_status).
  const rowTags = (job) => {
    const st = jobStatus[job.link];
    if (!st || !(st.alertedAt || st.viewedAt || st.appliedAt)) return null;
    return (
      <span className="row-tags">
        {st.alertedAt && <span className="al-tag al-tag-texted">{st.alertedVia === "email" ? "Emailed you" : "Texted you"}</span>}
        {st.viewedAt && <span className="al-tag al-tag-viewed">Viewed</span>}
        {st.appliedAt && <span className="al-tag al-tag-applied">Applied</span>}
      </span>
    );
  };
  // The Alerts button that sits with the filters.
  const alertsButton = (cls) => (
    <button className={`${cls}${alertsPanelOpen ? " is-open" : ""}`} aria-expanded={alertsPanelOpen} onClick={() => (alertsPanelOpen ? setAlertsPanelOpen(false) : openAlerts())}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      Alerts &amp; preferences
    </button>
  );

  const sidebar = (
    <aside className="sidebar" aria-label="Your tools and banks">
      <div className="sidebar-header">
        <span>Your tools</span>
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
        className={`sidebar-item${alertsPanelOpen ? " sidebar-item-active" : ""}`}
        onClick={openAlerts}
      >
        <span className="sidebar-saved-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill={alertsPanelOpen ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          Alerts
        </span>
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
      <div className="sidebar-divider" />
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
      <nav>
        <div className="nav-inner">
          <Link href="/" className="logo logo-link" aria-label="Pete's Postings home">
            <img src="/logo-mark.svg" alt="" className="logo-icon" width="24" height="24" />
            <span className="logo-text">Pete&rsquo;s Postings</span>
          </Link>
          <div className={`nav-center${navMenuOpen ? " nav-center-open" : ""}`} onClick={() => setNavMenuOpen(false)}>
            <Link href="/jobs" className={`nav-link${view === "browse" ? " nav-link-active" : ""}`}>Browse Jobs</Link>
            <Link
              href="/recent"
              className={`nav-link nav-link-new${viewNewPostings ? " nav-link-active" : ""}`}
            >
              {isSignedIn && isSubscribed ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Premium">
                  <rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                </svg>
              )}
              Recent Postings
            </Link>
            <Link href="/pricing" className="nav-link">Pricing</Link>
            <Link href="/about" className={`nav-link${viewAbout ? " nav-link-active" : ""}`}>About</Link>
            <button className="nav-link nav-link-mobile-only" onClick={() => { if (!isSignedIn) { askToSignUp("request"); return; } setCompanyRequestStatus(null); setShowCompanyRequest(true); }}>Request a bank</button>
            {isLoaded && !isSignedIn && (
              <div className="nav-sheet-cta">
                <Link href="/start" className="nav-sheet-btn" onClick={() => capture("home_cta_clicked", { where: "nav_menu" })}>Get SMS alerts</Link>
                <p>Already have an account?{" "}
                  <SignInButton mode="modal"><button className="nav-sheet-signin">Sign in</button></SignInButton>
                </p>
              </div>
            )}
          </div>
          <div className="nav-right">
            {!isLoaded ? null : isSignedIn ? (
              <>
              {savedNotifPrefs !== null && !alertsOn && !alertsPanelOpen && (
                <button className="nav-cta" onClick={() => { capture("home_cta_clicked", { where: "nav_signed_in" }); openAlerts(); }}>Get SMS alerts</button>
              )}
              <UserButton>
                {user?.publicMetadata?.stripeCustomerId && (
                  <UserButton.MenuItems>
                    <UserButton.Action label="Manage subscription" labelIcon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>} onClick={openBillingPortal} />
                  </UserButton.MenuItems>
                )}
              </UserButton>
              </>
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="nav-signin">Sign in</button>
                </SignInButton>
                <Link href="/start" className="nav-cta" onClick={() => capture("home_cta_clicked", { where: "nav" })}>Get SMS alerts</Link>
              </>
            )}
          </div>
          {/* Phones (pages with the tab bar): account top right, like every app's header. */}
          {/* Signed out: set up alerts (the sign-up path). Signed in but not paying: upgrade. */}
          {!viewHome && isLoaded && !isSignedIn && (
            <Link href="/start" className="nav-upgrade" onClick={() => capture("home_cta_clicked", { where: "nav_phone" })}>Set up alerts</Link>
          )}
          {!viewHome && isLoaded && isSignedIn && !isSubscribed && (
            <Link href="/pricing" className="nav-upgrade" onClick={() => capture("header_upgrade_clicked")}>Get Premium</Link>
          )}
          {!viewHome && (
            <button className="nav-acct" onClick={() => setAccountOpen(true)} aria-haspopup="dialog" aria-label="Account">
              {isSignedIn && user?.imageUrl ? <img src={user.imageUrl} alt="" /> : (
                <>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>
                </>
              )}
            </button>
          )}
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

      {/* Phones: bottom tab bar (Jakob's law: the layout every app uses). Five tabs, Jobs far
          left, Account far right, the main action (alerts) raised in the middle. */}
      {/* Not on the landing page (/): that page keeps its own top bar and calls to action. */}
      {!viewHome && <div className="tabbar" role="navigation" aria-label="Main">
        <Link href="/jobs" className={`tab${view === "browse" && !alertsPanelOpen ? " is-on" : ""}`} aria-current={view === "browse" && !alertsPanelOpen ? "page" : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18"/></svg>
          <span>Jobs</span>
        </Link>
        <Link href="/recent" className={`tab${viewNewPostings ? " is-on" : ""}`} aria-current={viewNewPostings ? "page" : undefined}>
          {isSignedIn && isSubscribed ? (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
          )}
          <span>Recent</span>
        </Link>
        <button className={`tab tab-main${alertsPanelOpen ? " is-on" : ""}`} onClick={() => { capture("tabbar_alerts"); openAlerts(); }} aria-label="Text alerts">
          <span className="tab-main-dot">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          </span>
          <span>Alerts</span>
        </button>
        <button
          className={`tab${viewingSaved && !viewNotifications ? " is-on" : ""}`}
          onClick={() => {
            if (!isSignedIn) { askToSignUp("save"); return; }
            setAlertsPanelOpen(false); setViewingSaved(true); setViewNotifications(false); setSearchQuery(""); setLocationFilter(""); setJobType("all");
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          <span>Saved</span>
        </button>
        <button
          className={`tab${showCompanyRequest ? " is-on" : ""}`}
          onClick={() => { capture("tabbar_request"); if (!isSignedIn) { askToSignUp("request"); return; } setCompanyRequestStatus(null); setShowCompanyRequest(true); }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5"/><path d="M12 8.5v4M10 10.5h4"/></svg>
          <span>Request</span>
        </button>
      </div>}

      {accountOpen && (
        <div className="acct-wrap" role="dialog" aria-modal="true" aria-label="Account">
          <button className="acct-shade" aria-label="Close" onClick={() => setAccountOpen(false)} />
          <div className="acct" onClick={(e) => { if (e.target.closest("a, button")) setAccountOpen(false); }}>
            <span className="acct-grip" aria-hidden="true" />
            {isSignedIn ? (
              <div className="acct-head">
                {user?.imageUrl && <img src={user.imageUrl} alt="" />}
                <div>
                  <strong>{user?.fullName || user?.primaryEmailAddress?.emailAddress}</strong>
                  <span>{isSubscribed ? "Premium" : "Free account"}</span>
                </div>
              </div>
            ) : (
              <div className="acct-actions">
                <button className="acct-primary" onClick={() => clerk.openSignIn({})}>Sign in</button>
                <button className="acct-secondary" onClick={() => clerk.openSignUp({ forceRedirectUrl: "/start?setup=1" })}>Create account</button>
              </div>
            )}
            <div className="acct-list">
              {!isSubscribed && <Link href="/pricing" className="acct-upgrade" onClick={() => capture("account_upgrade_clicked")}>Get Premium <span>${PLANS.monthly.price}/mo</span></Link>}
              {isSignedIn && <button onClick={() => clerk.openUserProfile()}>Account settings</button>}
              {isSignedIn && user?.publicMetadata?.stripeCustomerId && <button onClick={openBillingPortal}>Manage subscription</button>}
              <Link href="/about">About</Link>
              <Link href="/">Home</Link>
              {isSignedIn && <button className="acct-out" onClick={() => clerk.signOut({ redirectUrl: "/jobs" })}>Sign out</button>}
            </div>
          </div>
        </div>
      )}

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
          {/* Mobile top bar — not shown on Recent (Pro gets the filter bar below; everyone else just the locked list) */}
          <div className="mobile-top-bar mobile-top-bar-replaced">
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
                  openAlerts();
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
            {alertsPanel}
            {/* Pro members get the page header and the alerts shortcut; everyone else sees the locked live feed on its own. */}
            {isSubscribed && (
              <>
            {/* Same centered heading as the locked page, so the tab reads the same for everyone. */}
            <h1 className="rl-title rl-title-pro">
              {last48hCount > 0
                ? <><span className="rl-mark">{last48hCount} {last48hCount === 1 ? "role" : "roles"}</span> posted in the last <span className="rl-mark">48 hours</span></>
                : <>Roles posted in the last <span className="rl-mark">48 hours</span></>}
            </h1>

            {/* Shortcut to alert settings: only until their alerts are on (then it is just noise). */}
            {!(notifPrefs.smsEnabled || notifPrefs.enabled) && (
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
                  className="alerts-callout-cta"
                  onClick={openAlerts}
                >
                  {notifPrefs.smsEnabled || notifPrefs.enabled ? "Edit alerts" : "Set up free alerts"}
                </button>
              </div>
            )}
              </>
            )}
            <NewPostingsView
              liveJobs={allJobs}
              isSubscribed={isSubscribed}
              isSignedIn={isSignedIn}
              data={newPostingsData}
              loading={newPostingsLoading}
              onSetupAlerts={openAlerts}
            />
          </main>
        </div>
      )}

      {!viewHome && !viewAbout && !viewNewPostings && (
        <div className="app-layout">
          {/* Mobile top bar — replaces sidebar on mobile (on /jobs the filter bar replaces it; on Alerts it isn't shown) */}
          <div className={`mobile-top-bar${!viewingSaved || viewNotifications ? " mobile-top-bar-replaced" : ""}`}>
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
                className={`mobile-pro-pill${alertsPanelOpen ? " mobile-pro-pill-active" : ""}`}
                onClick={openAlerts}
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
          {/* Phones, /jobs: one filter bar that sums up bank · type · city and opens the filter panel */}
          {!viewingSaved && (
            <div className="mfb">
              {/* One Filters button (count of active filters); everything is set in the filter sheet. */}
              <div className="mfb-chips" role="group" aria-label="Filters">
                {(() => {
                  const n = (activeBank !== "all") + (jobType !== "all") + Boolean(locationFilter) + Boolean(categoryFilter);
                  const open = () => setFilterSheetOpen(true);
                  return (
                    <>
                      <button className={`mfb-chip mfb-chip-all${n ? " is-on" : ""}`} onClick={open} aria-haspopup="dialog">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="12" y1="18" x2="20" y2="18"/></svg>
                        Filters{n > 0 && <b>{n}</b>}
                      </button>
                      {/* Same switch as above the list on desktop; on phones it shares this row. */}
                      {hasAlertPrefs && !isGatedBank && !loading && !error && (
                        <div className="browse-mode mfb-mode" role="group" aria-label="Which roles to show">
                          <button aria-pressed={browseMode === "mine"} onClick={() => setBrowseMode("mine")}>My preferences <span className="browse-mode-n tnum">{mineCount}</span></button>
                          <button aria-pressed={browseMode === "all"} onClick={() => setBrowseMode("all")}>All roles <span className="browse-mode-n tnum">{modeBase.length}</span></button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              {alertsButton("mfb-alerts")}
            </div>
          )}
          {filterSheetOpen && !viewingSaved && (
            <div className="mfs-wrap" role="dialog" aria-modal="true" aria-label="Filter roles">
              <button className="mfs-shade" aria-label="Close filters" onClick={() => setFilterSheetOpen(false)} />
              <div className="mfs">
                <div className="mfs-top">
                  <p className="mfs-title">Filters</p>
                  <button className="mfs-x" aria-label="Close filters" onClick={() => setFilterSheetOpen(false)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
                </div>
                <div className="mfs-sec">
                  <div className="mfs-h-row">
                    <p className="mfs-h">Bank</p>
                    {!sheetAllBanks && <button className="mfs-more" onClick={() => setSheetAllBanks(true)}>See all {Object.keys(BANKS).length}</button>}
                  </div>
                  <div className={`mfs-banks${sheetAllBanks ? " mfs-grid" : " mfs-row"}`}>
                    <button className={`mfs-bank mfs-bank-all${activeBank === "all" ? " is-on" : ""}`} onClick={() => setActiveBank("all")}>All {BANK_COUNT}</button>
                    {/* Hick's law + frequency of use: the banks with the most open roles come first, so the first 6 are the likeliest picks */}
                    {(() => { const ranked = Object.keys(BANKS).sort((a, b) => (bankCounts[b] || 0) - (bankCounts[a] || 0)); return sheetAllBanks ? ranked : ranked.slice(0, 6); })().map((key) => (
                      <button key={key} className={`mfs-bank${activeBank === key ? " is-on" : ""}`} onClick={() => { setViewingSaved(false); setViewNotifications(false); setViewNewPostings(false); setActiveBank(key); }}>
                        <BankLogo bankKey={key} size={18} />{BANKS[key].shortName}
                      </button>
                    ))}
                  </div>
                </div>
                {availableCategories.length > 0 && (
                  <div className="mfs-sec">
                    <p className="mfs-h">Area</p>
                    <div className="mfs-banks mfs-row mfs-areas">
                      <button className={`mfs-bank mfs-bank-all${categoryFilter === "" ? " is-on" : ""}`} onClick={() => setCategoryFilter("")}>All</button>
                      {[...availableCategories].sort((x, y) => areaRank(x) - areaRank(y) || x.localeCompare(y)).map((cat) => (
                        <button key={cat} className={`mfs-bank mfs-bank-all${categoryFilter === cat ? " is-on" : ""}`} onClick={() => setCategoryFilter(cat)}>{cat}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mfs-sec">
                  <p className="mfs-h">Level</p>
                  <div className="mfs-banks mfs-row mfs-areas mfs-levels">
                    {[["all", "All"], ...LEVELS.map((l) => [l.key, l.label])].map(([key, label]) => (
                      <button key={key} className={`mfs-bank mfs-bank-all${jobType === key ? " is-on" : ""}`} onClick={() => setJobType(key)}>{label}</button>
                    ))}
                  </div>
                </div>
                <div className="mfs-sec">
                  <label className="mfs-h" htmlFor="mfs-city">City</label>
                  <select id="mfs-city" className="mfs-select" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
                    <option value="">All cities</option>
                    {withSelected(locationOptions, locationFilter).map(([loc, n]) => <option key={loc} value={loc}>{loc} ({n})</option>)}
                  </select>
                </div>
                <div className="mfs-foot">
                  <button className="mfs-clear" onClick={() => { setActiveBank("all"); setJobType("all"); setLocationFilter(""); setCategoryFilter(""); setSearchQuery(""); }}>Clear</button>
                  <button className="mfs-go" onClick={() => setFilterSheetOpen(false)}>
                    {isGatedBank ? "Show roles" : `Show ${displayJobs.length} ${displayJobs.length === 1 ? "role" : "roles"}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SIDEBAR (not on the Alerts tab: bank picking happens inside the alert setup) */}
          {!viewNotifications && sidebar}

          {/* MAIN CONTENT */}
          <main className="content">
            {/* Notifications view */}
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
                      <span className="job-logo-spacer" aria-hidden="true" />
                      <span className="job-title">Title</span>
                      <span className="job-location">Bank</span>
                      <span className="job-badges">Location</span>
                      <span style={{ width: 14 }} />
                      <span style={{ width: 14 }} />
                    </div>
                    {savedJobs.map((job, index) => (
                      <a href={trackedLink(job.link)} target="_blank" rel="noopener noreferrer" className={`job-row${job.expiredAt ? " job-row-expired" : ""}`} key={job.link}>
                        <span className="job-index">{String(index + 1).padStart(2, "0")}</span>
                        <BankLogo bankKey={job.bankKey} bank={job.bank} size={28} className="job-logo" />
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
                      {/* Desktop: one Filters button (same panel as phones); the dropdowns below are hidden there. */}
                      {(() => {
                        const n = (activeBank !== "all") + (jobType !== "all") + Boolean(locationFilter) + Boolean(categoryFilter);
                        return (
                          <button className={`dfb${n ? " is-on" : ""}`} onClick={() => setFilterSheetOpen(true)} aria-haspopup="dialog">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="12" y1="18" x2="20" y2="18"/></svg>
                            Filters{n > 0 && <b>{n}</b>}
                          </button>
                        );
                      })()}
                      {hasAlertPrefs && !loading && !error && (
                        <div className="browse-mode dfb-mode" role="group" aria-label="Which roles to show">
                          <button aria-pressed={browseMode === "mine"} onClick={() => setBrowseMode("mine")}>My preferences <span className="browse-mode-n tnum">{mineCount}</span></button>
                          <button aria-pressed={browseMode === "all"} onClick={() => setBrowseMode("all")}>All roles <span className="browse-mode-n tnum">{modeBase.length}</span></button>
                        </div>
                      )}
                      <select className="filter-dropdown" aria-label="Location" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
                        <option value="">All Locations</option>
                        {withSelected(locationOptions, locationFilter).map(([loc, n]) => <option key={loc} value={loc}>{loc} ({n})</option>)}
                      </select>
                      <select className="filter-dropdown" aria-label="Level" value={jobType} onChange={(e) => setJobType(e.target.value)}>
                        {Object.entries(JOB_TYPES).map(([key, label]) => <option key={key} value={key}>{key === "all" ? label : `${label} (${typeCounts[key] || 0})`}</option>)}
                      </select>
                      <select className="filter-dropdown" aria-label="Category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                        <option value="">All Categories</option>
                        {withSelected(categoryOptions, categoryFilter).map(([cat, n]) => <option key={cat} value={cat}>{cat} ({n})</option>)}
                      </select>
                      {alertsButton("filter-alerts")}
                    </div>
                  </div>
                )}
                {alertsPanel}

                {!isGatedBank && !loading && !error && (
                  <div className="results-bar">
                    {hasAlertPrefs ? (
                      <div className="browse-mode" role="group" aria-label="Which roles to show">
                        <button aria-pressed={browseMode === "mine"} onClick={() => setBrowseMode("mine")}>My preferences <span className="browse-mode-n tnum">{mineCount}</span></button>
                        <button aria-pressed={browseMode === "all"} onClick={() => setBrowseMode("all")}>All roles <span className="browse-mode-n tnum">{modeBase.length}</span></button>
                      </div>
                    ) : <span className="results-text" />}
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
                  <div className="jobs-list jobs-list-browse fade-in">
                    <div className="job-row-header">
                      <span className="job-index">#</span>
                      <span className="job-logo-spacer" aria-hidden="true" />
                      <span className="job-title">Title</span>
                      <span className="job-location">Location</span>
                      <span className="job-posted">Posted</span>
                      <span className="job-badges">Type</span>
                      {activeBank === "all" && <span className="new-bank-label">Bank</span>}
                      <span style={{ width: 14 }} />
                      <span style={{ width: 14 }} />
                    </div>
                    {/* Without Pro: the newest roles (last 48 hours) sit at the top, locked, and lead to Recent Postings. */}
                    {lockedRecent.length > 0 && (
                      // Phones: one grouped card (header, compact redacted rows, one Unlock). Desktop: display: contents, rows as before.
                      <div className="locked-group">
                        <div className="locked-head">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                          <span><b className="tnum">{lockedRecent.length}</b> new in the last 48 hours</span>
                          <Link href="/pricing" className="locked-cta" onClick={() => capture("browse_locked_unlock_clicked", { where: "phone_group" })}>Unlock all</Link>
                        </div>
                        {lockedRecent.slice(0, 3).map((job) => (
                          <Link href="/recent" className="job-row job-row-locked" key={`locked-${job.link}`} onClick={() => capture("browse_locked_row_clicked", { bank: job.bank })}>
                            <span className="job-index" aria-hidden="true">
                              <svg className="job-lock-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                              <span className="job-unlock job-unlock-phone">Unlock</span>
                            </span>
                            <BankLogo bankKey={job.bankKey} bank={job.bank} size={28} className="job-logo" />
                            <span className="job-title"><span className="job-locked-title" aria-hidden="true">{job.title}</span><span className="sr-only">New {job.bank} role, unlocks with Premium</span><span className="ss-new">New</span></span>
                            <span className="job-meta-mobile">{job.bank}{job.location ? ` \u00b7 ${job.location}` : ""}</span>
                            <span className="job-location">{job.location || "\u2014"}</span>
                            <span className="job-posted tnum">{feedAge(job)}</span>
                            <div className="job-badges">
                              <span className={`job-badge ${jobLevel(job.title) === "intern" ? "badge-intern" : "badge-analyst"}`}>{LEVEL_LABEL[jobLevel(job.title)]}</span>
                            </div>
                            {activeBank === "all" && <span className="new-bank-label"><span className="job-unlock">Unlock</span></span>}
                            <span style={{ width: 14 }} />
                            <svg className="job-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                          </Link>
                        ))}
                      </div>
                    )}
                    {displayJobs.map((job, index) => (
                      <a
                        href={trackedLink(job.link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="job-row"
                        key={index}
                        onClick={(e) => {
                          capture("job_opened", { view: viewingSaved ? "saved" : "browse", bank: job.bank || BANKS[job.bankKey]?.name, category: job.category, title: job.title, position: index + 1, signed_in: Boolean(isSignedIn) });
                          if (isSignedIn) patchJobStatus(job.link, { viewedAt: jobStatus[job.link]?.viewedAt || new Date().toISOString() });
                          // Signed out: a free account first (see SignUpGate).
                          if (isLoaded && !isSignedIn) { e.preventDefault(); askToSignUp("job", { title: job.title, link: job.link, bank: job.bank, bankKey: job.bankKey, location: job.location }); }
                        }}
                      >
                        <span className="job-index">{String(index + 1).padStart(2, "0")}</span>
                        <BankLogo bankKey={job.bankKey} bank={job.bank} size={28} className="job-logo" />
                        <span className="job-title">{job.title}{rowTags(job)}</span>
                        <span className="job-meta-mobile">{job.bank}{job.location ? ` \u00b7 ${job.location}` : ""}</span>
                        <span className="job-location">{job.location || "—"}</span>
                        <span className="job-posted tnum">{formatPostedAt(job)}</span>
                        <div className="job-badges">
                          <span className={`job-badge ${jobLevel(job.title) === "intern" ? "badge-intern" : "badge-analyst"}`}>
                            {LEVEL_LABEL[jobLevel(job.title)]}
                          </span>
                        </div>
                        {activeBank === "all" && <span className="new-bank-label">{job.bank}</span>}
                        <button className={`job-bookmark ${bookmarks.has(job.link) ? "job-bookmark-active" : ""}${justSaved === job.link ? " job-bookmark-pop" : ""}`} onClick={(e) => toggleBookmark(e, job)} aria-label={bookmarks.has(job.link) ? "Remove from saved" : "Save job"} aria-pressed={bookmarks.has(job.link)}>
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
                <p className="modal-subtitle">Requesting companies is a Premium feature. Upgrade to tell us which company to track next.</p>
                <div className="modal-actions">
                  <button className="modal-cta-primary" onClick={() => { setShowCompanyRequest(false); router.push("/pricing"); }}>See Premium</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {gate && <SignUpGate gate={gate} onClose={() => setGate(null)} />}
      {readyJob && (
        <div className="modal-overlay" data-state="open" onClick={() => setReadyJob(null)}>
          <div className="modal-card gate-card" role="dialog" aria-modal="true" aria-labelledby="ready-title" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setReadyJob(null)} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
            <h2 className="gate-title" id="ready-title">You&rsquo;re in.</h2>
            <p className="gate-job">
              <strong>{readyJob.title}</strong>
              <span><BankLogo bankKey={readyJob.bankKey} bank={readyJob.bank} size={16} />{readyJob.bank || BANKS[readyJob.bankKey]?.name}{readyJob.location ? ` \u00b7 ${readyJob.location}` : ""}</span>
            </p>
            <p className="gate-desc">The role opens on the bank&rsquo;s site in a new tab.</p>
            <a className="h-cta gate-cta" href={trackedLink(readyJob.link)} target="_blank" rel="noopener noreferrer"
              onClick={() => { capture("job_opened", { view: "after_signup", bank: readyJob.bank, title: readyJob.title, signed_in: true }); setReadyJob(null); }}>
              Open role &#8599;
            </a>
          </div>
        </div>
      )}
      {alertsWelcome && (
        <div className="pp-toast" role="status" aria-live="polite">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>
          You&rsquo;re in. We&rsquo;ll alert you the moment a match posts.
          <button className="pp-toast-close" onClick={() => setAlertsWelcome(false)} aria-label="Dismiss">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}
      {savedToast && (
        <div className="pp-toast" role="status" aria-live="polite">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>
          Your alert settings are saved
          <button className="pp-toast-close" onClick={() => setSavedToast(false)} aria-label="Dismiss">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {showProWelcome && (
        <ProWelcomeModal
          activated={isPaid}
          timedOut={proWelcomeTimedOut}
          onClose={() => setShowProWelcome(false)}
          onSetupAlerts={() => { setShowProWelcome(false); openAlerts(); }}
        />
      )}

    </>
  );
}
