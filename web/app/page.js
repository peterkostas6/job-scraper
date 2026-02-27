"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
};

const FREE_BANKS = new Set(["jpmc", "gs", "ms", "bofa", "citi", "db", "barclays", "wells", "mufg", "td", "mizuho"]);

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
function AccountPromptModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
        <div className="modal-prompt-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <h2 className="modal-title">Don't miss the window</h2>
        <p className="modal-subtitle">Banks fill roles within days of posting. Create an account to get notified the moment they go live.</p>
        <ul className="modal-benefits">
          <li>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            SMS &amp; email alerts when new positions open
          </li>
          <li>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            See every posting from the last 48 hours — free
          </li>
          <li>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Save &amp; track jobs across all 7 banks
          </li>
        </ul>
        <div className="modal-actions">
          <SignUpButton mode="modal">
            <button className="modal-cta-primary">Create Free Account</button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button className="modal-cta-secondary">Sign In</button>
          </SignInButton>
        </div>
        <button className="modal-dismiss-link" onClick={onClose}>Maybe later</button>
      </div>
    </div>
  );
}

// ---- HOMEPAGE ----
function HomePage({ onBrowse, isSignedIn, last48hCount }) {
  return (
    <div className="homepage">
      <section className="hero">
        <span className="hero-tag">Custom text alerts for job postings</span>
        <h1 className="hero-title">Be First to Every Banking Job Posting.</h1>
        <p className="hero-desc">
          Get a text the moment new internship and analyst positions go live at the largest banks.
          Create a free account to browse all 7 banks.
        </p>
        {last48hCount > 0 && (
          <div className="hero-48h-teaser">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            <strong>{last48hCount}</strong> {last48hCount === 1 ? "job" : "jobs"} posted in the last 48 hours — Pro subscribers see them first
          </div>
        )}
        <div className="hero-actions">
          <button className="hero-cta-primary" onClick={onBrowse}>Browse Jobs</button>
        </div>
      </section>

      <section className="banks-strip">
        <p className="banks-strip-label">Sourced directly from</p>
        <div className="banks-strip-row">
          {Object.values(BANKS).map((bank) => (
            <span className="banks-strip-item" key={bank.name}>{bank.name}</span>
          ))}
        </div>
      </section>

      <section className="features-grid">
        <div className="feature-card">
          <svg className="feature-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z"/>
          </svg>
          <h3 className="feature-title">SMS Alerts</h3>
          <p className="feature-desc">
            Get a text the moment a new position opens at any bank you follow. Apply before anyone else sees it.
          </p>
        </div>
        <div className="feature-card">
          <svg className="feature-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          <h3 className="feature-title">48-Hour Feed</h3>
          <p className="feature-desc">
            See every posting from the last 48 hours across all banks in one place — sorted by recency, free, no account needed.
          </p>
        </div>
        <div className="feature-card">
          <svg className="feature-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          <h3 className="feature-title">Save & Track</h3>
          <p className="feature-desc">
            Bookmark positions across all seven banks and track everything you've applied to in one place.
          </p>
        </div>
      </section>

      <section className="bottom-cta">
        <h2 className="bottom-cta-title">Stop checking manually.</h2>
        <p className="bottom-cta-desc">Free account to browse. Upgrade to Pro for SMS &amp; email alerts the moment a role posts.</p>
        <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <SignUpButton mode="modal">
            <button className="hero-cta-primary">Create Free Account</button>
          </SignUpButton>
          <Link href="/pricing" style={{ textDecoration: "none" }}>
            <button className="hero-cta-secondary">See Pricing</button>
          </Link>
        </div>
      </section>
    </div>
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
          Get SMS &amp; email alerts the moment new positions post, and save jobs across all 7 banks.
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
          {["SMS text alerts", "Email alerts", "Save & bookmark jobs", "All 7 banks"].map((item) => (
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
function NewPostingsView({ isSubscribed, isSignedIn, data, loading }) {
  if (loading) return <SkeletonRows />;

  const { last48h = [], thisWeek = [], last48hCount = 0, total = 0 } = data || {};

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
      {/* Last 48 Hours — Pro only */}
      <div className="new-section">
        <div className="new-section-header">
        </div>

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
        ) : last48h.length === 0 ? (
          <div className="empty-state" style={{ padding: "2rem" }}>
            <p className="empty-title">No new postings in the last 48 hours</p>
            <p className="empty-desc">Banks post most heavily Monday–Wednesday. Check back soon.</p>
          </div>
        ) : (
          <div className="jobs-list fade-in">
            {tableHeader}
            {last48h.map((job, i) => <JobCard key={job.link} job={job} index={i} />)}
          </div>
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
  const [viewingSaved, setViewingSaved] = useState(false);
  const [viewNotifications, setViewNotifications] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({ enabled: false, banks: [], categories: [], jobType: "all", smsEnabled: false, phoneNumber: "" });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);
  const [viewHome, setViewHome] = useState(true);
  const [viewAbout, setViewAbout] = useState(false);
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);
  const [viewNewPostings, setViewNewPostings] = useState(false);
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
            const filtered = data.jobs.filter((j) => !isGraduateProgram(j.title));
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

    fetch(BANKS[activeBank].endpoint)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch jobs");
        return res.json();
      })
      .then((data) => {
        const filtered = data.jobs.filter((j) => !isGraduateProgram(j.title));
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
        setError(err.message);
        setLoading(false);
      });
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

  if (!isLoaded) {
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
          <span className="logo logo-link" onClick={() => { setViewHome(true); setViewAbout(false); setViewNewPostings(false); }}>
            <svg className="logo-icon" width="30" height="30" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="var(--navy)"/>
              <text x="16" y="23" textAnchor="middle" fontFamily="inherit" fontWeight="800" fontSize="20" fill="#fff">P</text>
            </svg>
          </span>
          <div className="nav-right">
            <button
              className="nav-link"
              onClick={() => { setViewHome(false); setViewAbout(false); setViewNewPostings(false); setViewingSaved(false); setViewNotifications(false); }}
            >
              Dashboard
            </button>
            <button
              className={`nav-link nav-link-new${viewNewPostings ? " nav-link-active" : ""}`}
              onClick={() => { if (!isSignedIn) { clerk.openSignUp(); return; } setViewHome(false); setViewAbout(false); setViewNewPostings(true); setViewingSaved(false); setViewNotifications(false); }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              Recent Postings
            </button>
            <Link href="/pricing" className="nav-link" style={{ textDecoration: "none" }}>Pricing</Link>
            <button className="nav-link" onClick={() => { setViewHome(false); setViewAbout(true); setViewNewPostings(false); }}>About</button>
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
              <SignInButton mode="modal">
                <button className="nav-signin">Sign In</button>
              </SignInButton>
            )}
          </div>
        </div>
      </nav>

      {viewHome && !viewAbout && !viewNewPostings && (
        <HomePage
          onBrowse={() => setViewHome(false)}
          isSignedIn={isSignedIn}
          last48hCount={last48hCount}
        />
      )}

      {viewAbout && !viewNewPostings && (
        <AboutPage onBrowse={() => { setViewAbout(false); setViewHome(false); }} />
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
          <aside className="sidebar">
            <div className="sidebar-header">
              Banks
              {Object.keys(bankCounts).length > 0 && (
                <span style={{ color: "#94a3b8", fontSize: "0.7rem", fontWeight: 400, marginLeft: "0.375rem" }}>
                  {Object.values(bankCounts).reduce((sum, c) => sum + c, 0)}
                </span>
              )}
            </div>
            <div className="bank-search-wrap">
              <svg className="bank-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                className="bank-search-input"
                type="text"
                placeholder="Filter banks..."
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
              />
            </div>
            <div className="banks-scroll">
              {Object.entries(BANKS)
                .filter(([, bank]) => bank.name.toLowerCase().includes(bankSearch.toLowerCase()))
                .map(([key, bank]) => (
                  <button
                    key={key}
                    className="sidebar-item"
                    onClick={() => {
                      setViewNewPostings(false);
                      setViewingSaved(false);
                      setViewNotifications(false);
                      setActiveBank(key);
                      setViewHome(false);
                    }}
                  >
                    <span><span className="bank-name-full">{bank.name}</span><span className="bank-name-short">{bank.shortName}</span></span>
                    {bankCounts[key] !== undefined && <span className="sidebar-count">{bankCounts[key]}</span>}
                  </button>
                ))}
            </div>
            <div className="sidebar-divider" />
            <div className="sidebar-header">Pro Features</div>
            <button className="sidebar-item sidebar-item-active">
              <span className="sidebar-saved-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
                Recent Postings
              </span>
              {newPostingsData.total > 0 && <span className="sidebar-count">{newPostingsData.total}</span>}
            </button>
            <button
              className={`sidebar-item ${!isSubscribed ? "sidebar-item-locked" : ""}`}
              onClick={() => {
                if (!isSignedIn) { clerk.openSignUp(); return; }
                setViewNewPostings(false);
                setViewingSaved(true);
                setViewNotifications(false);
                setViewHome(false);
              }}
            >
              <span className="sidebar-saved-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                Saved Jobs
              </span>
              {!isSubscribed ? (
                <svg className="sidebar-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ) : savedJobs.length > 0 && <span className="sidebar-count">{savedJobs.length}</span>}
            </button>
            <button
              className={`sidebar-item ${!isSubscribed ? "sidebar-item-locked" : ""}`}
              onClick={() => {
                if (!isSignedIn) { clerk.openSignUp(); return; }
                setViewNewPostings(false);
                setViewingSaved(true);
                setViewNotifications(true);
                setViewHome(false);
              }}
            >
              <span className="sidebar-saved-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                Notifications
              </span>
              {!isSubscribed ? (
                <svg className="sidebar-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ) : notifPrefs.enabled ? <span className="sidebar-notif-dot" /> : null}
            </button>
            <span className="sidebar-scroll-arrow" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </span>
          </aside>

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
          <aside className="sidebar">
            <div className="sidebar-header">
              Banks
              {Object.keys(bankCounts).length > 0 && (
                <span style={{ color: "#94a3b8", fontSize: "0.7rem", fontWeight: 400, marginLeft: "0.375rem" }}>
                  {Object.values(bankCounts).reduce((sum, c) => sum + c, 0)}
                </span>
              )}
            </div>
            <div className="bank-search-wrap">
              <svg className="bank-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                className="bank-search-input"
                type="text"
                placeholder="Filter banks..."
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
              />
            </div>
            <div className="banks-scroll">
              {Object.entries(BANKS)
                .filter(([, bank]) => bank.name.toLowerCase().includes(bankSearch.toLowerCase()))
                .map(([key, bank]) => {
                  const needsAuth = !FREE_BANKS.has(key) && (!isSignedIn || !isSubscribed);
                  return (
                    <button
                      key={key}
                      className={`sidebar-item ${activeBank === key && !viewingSaved && !viewNewPostings ? "sidebar-item-active" : ""} ${needsAuth ? "sidebar-item-locked" : ""}`}
                      onClick={() => { setViewingSaved(false); setViewNotifications(false); setViewNewPostings(false); setActiveBank(key); }}
                    >
                      <span><span className="bank-name-full">{bank.name}</span><span className="bank-name-short">{bank.shortName}</span></span>
                      {needsAuth ? (
                        <svg className="sidebar-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                      ) : (
                        bankCounts[key] !== undefined && <span className="sidebar-count">{bankCounts[key]}</span>
                      )}
                    </button>
                  );
                })}
            </div>

            <div className="sidebar-divider" />
            <div className="sidebar-header">Pro Features</div>
            <button
              className={`sidebar-item ${!isSubscribed ? "sidebar-item-locked" : ""}`}
              onClick={() => {
                if (!isSubscribed) { router.push("/pricing"); return; }
                setViewNewPostings(true); setViewingSaved(false); setViewNotifications(false); setViewHome(false);
              }}
            >
              <span className="sidebar-saved-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
                Most Recent Postings
              </span>
              {!isSubscribed ? (
                last48hCount > 0 ? <span className="sidebar-count sidebar-count-teaser">{last48hCount}</span> : (
                  <svg className="sidebar-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                )
              ) : last48hCount > 0 ? <span className="sidebar-count">{last48hCount}</span> : null}
            </button>
            <button
              className={`sidebar-item ${viewingSaved && !viewNotifications ? "sidebar-item-active" : ""} ${!isSubscribed ? "sidebar-item-locked" : ""}`}
              onClick={() => {
                if (!isSignedIn) { clerk.openSignUp(); return; }
                if (!isSubscribed) { setViewingSaved(true); setViewNotifications(false); return; }
                setViewingSaved(true); setViewNotifications(false); setSearchQuery(""); setLocationFilter(""); setJobType("all");
              }}
            >
              <span className="sidebar-saved-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill={viewingSaved && !viewNotifications ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                Saved Jobs
              </span>
              {!isSubscribed ? (
                <svg className="sidebar-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ) : savedJobs.length > 0 && <span className="sidebar-count">{savedJobs.length}</span>}
            </button>

            <button
              className={`sidebar-item ${viewNotifications ? "sidebar-item-active" : ""} ${!isSubscribed ? "sidebar-item-locked" : ""}`}
              onClick={() => {
                if (!isSignedIn) { clerk.openSignUp(); return; }
                if (!isSubscribed) { setViewNotifications(true); setViewingSaved(true); return; }
                setViewNotifications(true); setViewingSaved(true);
              }}
            >
              <span className="sidebar-saved-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill={viewNotifications ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                Notifications
              </span>
              {!isSubscribed ? (
                <svg className="sidebar-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ) : notifPrefs.enabled ? <span className="sidebar-notif-dot" /> : null}
            </button>
            <span className="sidebar-scroll-arrow" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </span>
          </aside>

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
                      <a href={job.link} target="_blank" rel="noopener noreferrer" className="job-row" key={job.link}>
                        <span className="job-index">{String(index + 1).padStart(2, "0")}</span>
                        <span className="job-title">{job.title}</span>
                        <span className="job-location"><span className="saved-bank-badge">{job.bank}</span></span>
                        <div className="job-badges"><span className="job-badge" title={job.location}>{job.location || "—"}</span></div>
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
                        Live postings from 7 bulge bracket banks. Hit <strong>⚡ Recent</strong> to see everything posted in the last 7 days — or upgrade to Pro for SMS &amp; email alerts the moment a role goes live.
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
                {!isGatedBank && loading && <SkeletonRows />}

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
            <p>Live from JPMC &middot; GS &middot; MS &middot; BofA &middot; Citi &middot; DB &middot; Barclays</p>
            <p>&copy; 2026 Pete's Postings</p>
          </div>
        </div>
      </footer>

      {showAccountPrompt && !isSignedIn && !viewHome && (
        <AccountPromptModal onClose={dismissAccountPrompt} />
      )}
    </>
  );
}
