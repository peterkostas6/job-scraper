"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/jobs")
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
  }, []);

  return (
    <>
      <nav>
        <div className="nav-inner">
          <span className="logo">Pete's Postings</span>
          <span className="nav-tag">Analyst Positions</span>
        </div>
      </nav>

      <main>
        <section className="hero">
          <h1>Analyst Openings</h1>
          <p className="hero-sub">
            Live listings from JPMorgan Chase careers — United States
          </p>
          {!loading && !error && (
            <div className="stat-row">
              <div className="stat">
                <span className="stat-number">{jobs.length}</span>
                <span className="stat-label">Open Positions</span>
              </div>
            </div>
          )}
        </section>

        {error && <div className="error-banner">Something went wrong: {error}</div>}

        {loading && (
          <div className="loading-state">
            <div className="spinner" />
            <p>Fetching live data from JPMC...</p>
          </div>
        )}

        {!loading && !error && (
          <section className="jobs-section">
            <div className="jobs-grid">
              {jobs.map((job, index) => (
                <a
                  href={job.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="job-card"
                  key={index}
                >
                  <div className="job-card-top">
                    <span className="job-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="job-badge">Analyst</span>
                  </div>
                  <h3 className="job-title">{job.title}</h3>
                  <div className="job-card-bottom">
                    <span className="apply-text">
                      View Position
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer>
        <p>Data sourced from JPMorgan Chase public careers API. Not affiliated with JPMC.</p>
      </footer>
    </>
  );
}
