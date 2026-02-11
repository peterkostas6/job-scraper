"use client";

import { useState, useEffect } from "react";
import { useUser, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

const BANKS = {
  jpmc: { name: "JPMorgan Chase", endpoint: "/api/jobs" },
  gs: { name: "Goldman Sachs", endpoint: "/api/jobs-gs" },
  ms: { name: "Morgan Stanley", endpoint: "/api/jobs-ms" },
};

const JOB_TYPES = {
  all: "All Types",
  internship: "Internship",
  fulltime: "Full-Time",
};

function isInternship(title) {
  const t = title.toLowerCase();
  return (
    t.includes("intern") ||
    t.includes("internship") ||
    t.includes("summer") ||
    t.includes("co-op") ||
    t.includes("coop") ||
    /\b20\d{2}\b/.test(t)
  );
}

function WelcomeBanner({ onDismiss }) {
  return (
    <div className="welcome-banner">
      <div>
        <h2 className="welcome-title">Welcome to Pete's Postings</h2>
        <p className="welcome-desc">
          Browse analyst internships and jobs from top banks.
          JPMorgan Chase is free — sign up to unlock Goldman Sachs and Morgan Stanley.
        </p>
      </div>
      <button className="welcome-dismiss" onClick={onDismiss}>Got it</button>
    </div>
  );
}

function SignUpOverlay({ bankName }) {
  return (
    <div className="gate-overlay">
      <div className="gate-content">
        <svg className="gate-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <h3 className="gate-title">{bankName} requires a free account</h3>
        <p className="gate-desc">
          Sign up in seconds to unlock jobs from {bankName} and more.
        </p>
        <SignUpButton mode="modal">
          <button className="gate-cta">Sign Up Free</button>
        </SignUpButton>
        <p className="gate-signin">
          Already have an account?{" "}
          <SignInButton mode="modal">
            <button className="gate-link">Sign in</button>
          </SignInButton>
        </p>
      </div>
    </div>
  );
}

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

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
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
  const [showWelcome, setShowWelcome] = useState(false);
  const [viewingSaved, setViewingSaved] = useState(false);

  // Load bookmarks and welcome state from localStorage
  useEffect(() => {
    const savedLinks = JSON.parse(localStorage.getItem("pp-bookmarks") || "[]");
    setBookmarks(new Set(savedLinks));
    const savedData = JSON.parse(localStorage.getItem("pp-saved-jobs") || "[]");
    setSavedJobs(savedData);
    const welcomed = localStorage.getItem("pp-welcomed");
    if (!welcomed) setShowWelcome(true);
  }, []);

  // Fetch jobs when bank changes
  useEffect(() => {
    setViewingSaved(false);

    // JPMC is free; GS and MS require sign-in
    if (activeBank !== "jpmc" && !isSignedIn) {
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
    setShowSavedOnly(false);

    fetch(BANKS[activeBank].endpoint)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch jobs");
        return res.json();
      })
      .then((data) => {
        setJobs(data.jobs);
        setBankCounts((prev) => ({ ...prev, [activeBank]: data.jobs.length }));

        // Extract unique locations for filter
        const locs = [...new Set(
          data.jobs
            .flatMap((job) => (job.location || "").split(";").map((l) => l.trim()))
            .filter(Boolean)
        )].sort();
        setAvailableLocations(locs);

        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [activeBank, isSignedIn, isLoaded]);

  function toggleBookmark(e, job) {
    e.preventDefault();
    e.stopPropagation();
    const link = job.link;
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(link)) next.delete(link);
      else next.add(link);
      localStorage.setItem("pp-bookmarks", JSON.stringify([...next]));
      return next;
    });
    setSavedJobs((prev) => {
      let next;
      if (prev.some((j) => j.link === link)) {
        next = prev.filter((j) => j.link !== link);
      } else {
        next = [...prev, { title: job.title, link: job.link, location: job.location || "", bank: BANKS[activeBank]?.name || "" }];
      }
      localStorage.setItem("pp-saved-jobs", JSON.stringify(next));
      return next;
    });
  }

  function dismissWelcome() {
    setShowWelcome(false);
    localStorage.setItem("pp-welcomed", "true");
  }

  const filteredJobs = jobs.filter((job) => {
    const matchesType =
      jobType === "all" ? true :
      jobType === "internship" ? isInternship(job.title) :
      !isInternship(job.title);
    const matchesSearch =
      searchQuery === "" ||
      job.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation =
      locationFilter === "" ||
      (job.location || "").toLowerCase().includes(locationFilter.toLowerCase());
    return matchesType && matchesSearch && matchesLocation;
  });

  const displayJobs = showSavedOnly
    ? filteredJobs.filter((job) => bookmarks.has(job.link))
    : filteredJobs;

  const savedCount = [...bookmarks].filter((link) =>
    filteredJobs.some((job) => job.link === link)
  ).length;

  const isGatedBank = activeBank !== "jpmc" && !isSignedIn;

  // Spinner while Clerk loads
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
          <span className="logo">Pete's Postings</span>
          <div className="nav-right">
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

      <div className="app-layout">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-header">Banks</div>
          {Object.entries(BANKS).map(([key, bank]) => {
            const needsAuth = key !== "jpmc" && !isSignedIn;
            return (
              <button
                key={key}
                className={`sidebar-item ${activeBank === key && !viewingSaved ? "sidebar-item-active" : ""}`}
                onClick={() => { setViewingSaved(false); setActiveBank(key); }}
              >
                <span>{bank.name}</span>
                {needsAuth ? (
                  <svg className="sidebar-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                ) : (
                  bankCounts[key] !== undefined && (
                    <span className="sidebar-count">{bankCounts[key]}</span>
                  )
                )}
              </button>
            );
          })}

          <div className="sidebar-divider" />
          <div className="sidebar-header">My Jobs</div>
          <button
            className={`sidebar-item ${viewingSaved ? "sidebar-item-active" : ""}`}
            onClick={() => { setViewingSaved(true); setSearchQuery(""); setLocationFilter(""); setJobType("all"); }}
          >
            <span className="sidebar-saved-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill={viewingSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              Saved Jobs
            </span>
            {savedJobs.length > 0 && (
              <span className="sidebar-count">{savedJobs.length}</span>
            )}
          </button>
        </aside>

        {/* MAIN CONTENT */}
        <main className="content">
          {/* Welcome banner for first-time visitors */}
          {showWelcome && !isSignedIn && (
            <WelcomeBanner onDismiss={dismissWelcome} />
          )}

          {/* === SAVED JOBS VIEW === */}
          {viewingSaved && (
            <>
              <div className="results-bar">
                <span className="results-text">
                  {savedJobs.length} saved {savedJobs.length === 1 ? "job" : "jobs"}
                </span>
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
                    <a
                      href={job.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="job-row"
                      key={job.link}
                    >
                      <span className="job-index">{String(index + 1).padStart(2, "0")}</span>
                      <span className="job-title">{job.title}</span>
                      <span className="job-location">
                        <span className="saved-bank-badge">{job.bank}</span>
                      </span>
                      <div className="job-badges">
                        <span className="job-badge" title={job.location}>{job.location || "—"}</span>
                      </div>
                      <button
                        className="job-bookmark job-bookmark-active"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleBookmark(e, job);
                        }}
                      >
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

          {/* === BANK JOBS VIEW === */}
          {!viewingSaved && (
            <>
              {/* Filters */}
              {!isGatedBank && (
                <div className="filters">
                  <div className="search-wrapper">
                    <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="m21 21-4.3-4.3"/>
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

                  <select
                    className="filter-dropdown"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                  >
                    <option value="">All Locations</option>
                    {availableLocations.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>

                  <select
                    className="filter-dropdown"
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value)}
                  >
                    {Object.entries(JOB_TYPES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Results bar */}
              {!isGatedBank && !loading && !error && (
                <div className="results-bar">
                  <span className="results-text">
                    {displayJobs.length} {displayJobs.length === 1 ? "position" : "positions"} at {BANKS[activeBank].name}
                  </span>
                  <button
                    className={`saved-toggle ${showSavedOnly ? "saved-toggle-active" : ""}`}
                    onClick={() => setShowSavedOnly(!showSavedOnly)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill={showSavedOnly ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                    Saved{savedCount > 0 ? ` (${savedCount})` : ""}
                  </button>
                </div>
              )}

              {/* Gate overlay for locked banks */}
              {isGatedBank && <SignUpOverlay bankName={BANKS[activeBank].name} />}

              {/* Error */}
              {error && <div className="error-banner">Something went wrong: {error}</div>}

              {/* Loading skeleton */}
              {!isGatedBank && loading && <SkeletonRows />}

              {/* Empty state */}
              {!isGatedBank && !loading && !error && displayJobs.length === 0 && (
                <div className="empty-state">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.3-4.3"/>
                  </svg>
                  <p className="empty-title">No matching positions</p>
                  <p className="empty-desc">Try adjusting your filters or search terms.</p>
                </div>
              )}

              {/* Job table */}
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
                    <a
                      href={job.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="job-row"
                      key={index}
                    >
                      <span className="job-index">{String(index + 1).padStart(2, "0")}</span>
                      <span className="job-title">{job.title}</span>
                      <span className="job-location">{job.location || "—"}</span>
                      <div className="job-badges">
                        <span className={`job-badge ${isInternship(job.title) ? "badge-intern" : "badge-fulltime"}`}>
                          {isInternship(job.title) ? "Internship" : "Full-Time"}
                        </span>
                      </div>
                      <button
                        className={`job-bookmark ${bookmarks.has(job.link) ? "job-bookmark-active" : ""}`}
                        onClick={(e) => toggleBookmark(e, job)}
                      >
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

      <footer>
        <div className="footer-inner">
          <div className="footer-left">
            <span className="footer-brand">Pete's Postings</span>
            <p>Data sourced from public careers APIs. Not affiliated with any listed company.</p>
          </div>
          <div className="footer-right">
            <p>Live from JPMC &middot; GS &middot; MS</p>
            <p>&copy; 2026 Pete's Postings</p>
          </div>
        </div>
      </footer>
    </>
  );
}
