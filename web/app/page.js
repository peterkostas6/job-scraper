"use client";

import { useState, useEffect } from "react";
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";

const BANKS = {
  jpmc: { name: "JPMorgan Chase", endpoint: "/api/jobs", loadingText: "Fetching live data from JPMC..." },
  gs: { name: "Goldman Sachs", endpoint: "/api/jobs-gs", loadingText: "Fetching live data from Goldman Sachs..." },
  ms: { name: "Morgan Stanley", endpoint: "/api/jobs-ms", loadingText: "Fetching live data from Morgan Stanley..." },
};

const JOB_TYPES = {
  all: "all positions",
  internship: "internship",
  fulltime: "full-time",
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

function Landing() {
  return (
    <div className="landing">
      <div className="landing-content">
        <span className="landing-tag">Live data from top banks</span>
        <h1 className="landing-title">Pete's Postings</h1>
        <p className="landing-desc">
          Internships linked directly to bank career sites, all in one place.
        </p>
        <SignInButton mode="modal">
          <button className="landing-cta">
            Get Started
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </SignInButton>
        <div className="landing-banks">
          <span>JPMorgan Chase</span>
          <span className="landing-dot" />
          <span>Goldman Sachs</span>
          <span className="landing-dot" />
          <span>Morgan Stanley</span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const [activeBank, setActiveBank] = useState("jpmc");
  const [jobType, setJobType] = useState("all");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isSignedIn) return;

    setLoading(true);
    setError(null);
    setJobs([]);

    fetch(BANKS[activeBank].endpoint)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch jobs");
        return res.json();
      })
      .then((data) => {
        setJobs(data.jobs);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [activeBank, isSignedIn]);

  const filteredJobs = jobs.filter((job) => {
    if (jobType === "all") return true;
    if (jobType === "internship") return isInternship(job.title);
    if (jobType === "fulltime") return !isInternship(job.title);
    return true;
  });

  // Show spinner while Clerk loads
  if (!isLoaded) {
    return (
      <div className="loading-state">
        <div className="spinner" />
      </div>
    );
  }

  // Not signed in — show landing page
  if (!isSignedIn) {
    return <Landing />;
  }

  // Signed in — show jobs
  return (
    <>
      <nav>
        <div className="nav-inner">
          <span className="logo">Pete's Postings</span>
          <UserButton />
        </div>
      </nav>

      <main>
        <section className="hero">
          <h1 className="sentence-filter">
            I am looking for{" "}
            <select
              className="filter-select"
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
            >
              {Object.entries(JOB_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            {" "}at{" "}
            <select
              className="filter-select"
              value={activeBank}
              onChange={(e) => setActiveBank(e.target.value)}
            >
              {Object.entries(BANKS).map(([key, bank]) => (
                <option key={key} value={key}>{bank.name}</option>
              ))}
            </select>
          </h1>

          {!loading && !error && (
            <div className="stat-row">
              <div className="stat">
                <span className="stat-number">{filteredJobs.length}</span>
                <span className="stat-label">Open Positions</span>
              </div>
            </div>
          )}
        </section>

        {error && <div className="error-banner">Something went wrong: {error}</div>}

        {loading && (
          <div className="loading-state">
            <div className="spinner" />
            <p>{BANKS[activeBank].loadingText}</p>
          </div>
        )}

        {!loading && !error && (
          <section className="jobs-section">
            <div className="jobs-list">
              {filteredJobs.map((job, index) => (
                <a
                  href={job.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="job-row"
                  key={index}
                >
                  <span className="job-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="job-title">{job.title}</span>
                  <div className="job-badges">
                    <span className={`job-badge ${isInternship(job.title) ? "badge-intern" : "badge-fulltime"}`}>
                      {isInternship(job.title) ? "Internship" : "Full-Time"}
                    </span>
                  </div>
                  <svg className="job-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer>
        <p>Data sourced from public careers APIs. Not affiliated with any listed company.</p>
      </footer>
    </>
  );
}
