"use client";

import { useState } from "react";
import { useUser, SignUpButton, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

function ClubInquiryModal({ onClose }) {
  const [form, setForm] = useState({
    schoolName: "",
    clubName: "",
    memberCount: "",
    contactName: "",
    contactEmail: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.schoolName || !form.clubName || !form.contactName || !form.contactEmail) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/club-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>

        {success ? (
          <div className="modal-success">
            <div className="modal-success-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h3 className="modal-success-title">Inquiry received!</h3>
            <p className="modal-success-desc">We'll get back to you within 24 hours at {form.contactEmail}.</p>
            <button className="modal-cta-primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <h2 className="modal-title">Inquire About Club Membership</h2>
            <p className="modal-subtitle">
              For $50/month, every member of your club gets full Pro access — verified via their student email.
            </p>

            <form className="inquiry-form" onSubmit={handleSubmit}>
              <div className="inquiry-row">
                <div className="inquiry-field">
                  <label className="inquiry-label">University / School <span className="inquiry-required">*</span></label>
                  <input
                    className="inquiry-input"
                    name="schoolName"
                    value={form.schoolName}
                    onChange={handleChange}
                    placeholder="e.g. University of Pennsylvania"
                    required
                  />
                </div>
                <div className="inquiry-field">
                  <label className="inquiry-label">Club / Organization <span className="inquiry-required">*</span></label>
                  <input
                    className="inquiry-input"
                    name="clubName"
                    value={form.clubName}
                    onChange={handleChange}
                    placeholder="e.g. Wharton Investment Banking Club"
                    required
                  />
                </div>
              </div>
              <div className="inquiry-row">
                <div className="inquiry-field">
                  <label className="inquiry-label">Approximate Number of Members</label>
                  <input
                    className="inquiry-input"
                    name="memberCount"
                    type="number"
                    value={form.memberCount}
                    onChange={handleChange}
                    placeholder="e.g. 85"
                    min="1"
                  />
                </div>
                <div className="inquiry-field">
                  <label className="inquiry-label">Your Name <span className="inquiry-required">*</span></label>
                  <input
                    className="inquiry-input"
                    name="contactName"
                    value={form.contactName}
                    onChange={handleChange}
                    placeholder="First and last name"
                    required
                  />
                </div>
              </div>
              <div className="inquiry-field">
                <label className="inquiry-label">Your Email <span className="inquiry-required">*</span></label>
                <input
                  className="inquiry-input"
                  name="contactEmail"
                  type="email"
                  value={form.contactEmail}
                  onChange={handleChange}
                  placeholder="your@university.edu"
                  required
                />
              </div>

              {error && <p className="inquiry-error">{error}</p>}

              <div className="inquiry-actions">
                <button type="button" className="inquiry-cancel" onClick={onClose}>Cancel</button>
                <button type="submit" className="modal-cta-primary" disabled={loading}>
                  {loading ? "Sending..." : "Submit Inquiry"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function PricingPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [showInquiry, setShowInquiry] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(null);

  function handleSubscribe(plan) {
    setCheckoutLoading(plan);
    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.url) window.location.href = data.url;
      })
      .catch(() => setCheckoutLoading(null));
  }

  const check = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );

  return (
    <>
      <nav>
        <div className="nav-inner">
          <Link href="/" className="logo logo-link" style={{ textDecoration: "none" }}>
            <svg className="logo-icon" width="30" height="30" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="var(--navy)"/>
              <text x="16" y="23" textAnchor="middle" fontFamily="inherit" fontWeight="800" fontSize="20" fill="#fff">P</text>
            </svg>
          </Link>
          <div className="nav-right">
            <Link href="/" className="nav-link" style={{ textDecoration: "none" }}>Browse Jobs</Link>
            {isLoaded && (
              isSignedIn ? <UserButton /> : (
                <SignInButton mode="modal">
                  <button className="nav-signin">Sign In</button>
                </SignInButton>
              )
            )}
          </div>
        </div>
      </nav>

      <div className="pricing-page">
        <section className="pricing-hero">
          <span className="hero-tag">Pricing</span>
          <h1 className="pricing-hero-title">Simple, transparent pricing</h1>
          <p className="pricing-hero-desc">
            Recent postings feed is free. Upgrade to Pro for SMS &amp; email alerts the moment new roles post.
          </p>
        </section>

        <section className="pricing-cards">
          {/* Free */}
          <div className="pricing-card">
            <div className="pricing-card-header">
              <h3 className="pricing-card-name">Free</h3>
              <div className="pricing-card-price">
                <span className="pricing-card-amount">$0</span>
              </div>
              <p className="pricing-card-tagline">No account needed</p>
            </div>
            <ul className="pricing-card-features">
              <li className="pricing-feature">{check} All 7 banks — browse free</li>
              <li className="pricing-feature">{check} Search &amp; filter by location, type</li>
              <li className="pricing-feature pricing-feature-highlight">{check} <strong>Recent postings feed (7 days)</strong></li>
              <li className="pricing-feature pricing-feature-muted">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                SMS text alerts
              </li>
              <li className="pricing-feature pricing-feature-muted">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                Email alerts
              </li>
              <li className="pricing-feature pricing-feature-muted">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                Save &amp; bookmark jobs
              </li>
            </ul>
            <Link href="/" style={{ textDecoration: "none", display: "block" }}>
              <button className="pricing-card-cta pricing-cta-outline" style={{ width: "100%" }}>
                Browse Free
              </button>
            </Link>
          </div>

          {/* Pro */}
          <div className="pricing-card pricing-card-popular">
            <div className="pricing-card-popular-badge">Most Popular</div>
            <div className="pricing-card-header">
              <h3 className="pricing-card-name">Pro</h3>
              <div className="pricing-card-price">
                <span className="pricing-card-amount">$4.99</span>
                <span className="pricing-card-period">/mo</span>
              </div>
              <p className="pricing-card-tagline">or $39.99/year — SMS + email alerts</p>
            </div>
            <ul className="pricing-card-features">
              <li className="pricing-feature">{check} Everything in Free</li>
              <li className="pricing-feature">{check} Save &amp; bookmark jobs</li>
              <li className="pricing-feature">{check} Email notifications for new postings</li>
              <li className="pricing-feature pricing-feature-highlight">{check} <strong>SMS text alerts</strong></li>
            </ul>
            <div className="pricing-cta-group">
              {isSignedIn ? (
                <>
                  <button
                    className="pricing-card-cta pricing-cta-primary"
                    onClick={() => handleSubscribe("yearly")}
                    disabled={checkoutLoading !== null}
                  >
                    {checkoutLoading === "yearly" ? "Redirecting..." : "Get Pro — $39.99/yr"}
                  </button>
                  <button
                    className="pricing-card-cta pricing-cta-outline"
                    onClick={() => handleSubscribe("monthly")}
                    disabled={checkoutLoading !== null}
                    style={{ marginTop: "0.5rem" }}
                  >
                    {checkoutLoading === "monthly" ? "Redirecting..." : "Monthly — $4.99/mo"}
                  </button>
                </>
              ) : (
                <SignUpButton mode="modal">
                  <button className="pricing-card-cta pricing-cta-primary">Get Started</button>
                </SignUpButton>
              )}
            </div>
          </div>

        </section>

        {/* Club Partnership Section */}
        <section className="pricing-club">
          <div className="pricing-club-inner">
            <div className="pricing-club-text">
              <span className="pricing-club-tag">For Finance Clubs &amp; IB Organizations</span>
              <h2 className="pricing-club-title">Give your whole club an edge</h2>
              <p className="pricing-club-desc">
                For $50/month, every member of your club gets full Pro access — SMS &amp; email alerts,
                job saving, and the 48-hour feed. Members verify with their school email. One invoice for the club.
              </p>
              <ul className="pricing-club-features">
                <li className="pricing-club-feature">{check} SMS &amp; email alerts for every member</li>
                <li className="pricing-club-feature">{check} Student email verification per member</li>
                <li className="pricing-club-feature">{check} One monthly invoice for the club</li>
                <li className="pricing-club-feature">{check} Cancel anytime</li>
              </ul>
            </div>
            <div className="pricing-club-card">
              <div className="pricing-club-price-display">
                <span className="pricing-club-amount">$50</span>
                <span className="pricing-club-period">/month</span>
              </div>
              <p className="pricing-club-price-sub">For the entire club</p>
              <button className="pricing-card-cta pricing-cta-primary" style={{ width: "100%" }} onClick={() => setShowInquiry(true)}>
                Inquire About Club Membership
              </button>
              <p className="pricing-club-fine">
                Reach out to discuss pricing for larger organizations.
              </p>
            </div>
          </div>
        </section>

        <section className="pricing-faq">
          <h2 className="pricing-faq-title">Common questions</h2>
          <div className="pricing-faq-list">
            <div className="pricing-faq-item">
              <h3 className="pricing-faq-q">Can I cancel anytime?</h3>
              <p className="pricing-faq-a">Yes. You can cancel your Pro subscription at any time from your account settings. You'll keep access until the end of your billing period.</p>
            </div>
            <div className="pricing-faq-item">
              <h3 className="pricing-faq-q">How do SMS alerts work?</h3>
              <p className="pricing-faq-a">Pro users can add a phone number in their notification settings. When our daily check finds a new posting matching your preferences, you'll get a text with the role title, bank, and a direct link to apply.</p>
            </div>
            <div className="pricing-faq-item">
              <h3 className="pricing-faq-q">Is the recent postings feed really free?</h3>
              <p className="pricing-faq-a">Yes — everyone can see jobs posted in the last 7 days, no account needed. Pro is about getting those postings pushed to you automatically via SMS or email, so you don't have to check manually.</p>
            </div>
            <div className="pricing-faq-item">
              <h3 className="pricing-faq-q">How do club memberships work?</h3>
              <p className="pricing-faq-a">The club pays $50/month. Members verify with their school email and get Pro access automatically. You don't need to manage individual subscriptions.</p>
            </div>
          </div>
        </section>
      </div>

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

      {showInquiry && <ClubInquiryModal onClose={() => setShowInquiry(false)} />}
    </>
  );
}
