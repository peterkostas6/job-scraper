"use client";

import { useState, useEffect } from "react";
import { useUser, SignUpButton, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { track } from "@/lib/track";
import { PLANS, planPrice } from "@/lib/plans";
import { openBillingPortal } from "@/lib/billing";

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
  const { isSignedIn, isLoaded, user } = useUser();
  const [showInquiry, setShowInquiry] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [billing, setBilling] = useState("monthly");

  function handleSubscribe(plan = billing) {
    track("InitiateCheckout", planPrice(plan));
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

  // Signed-out visitors who pick Pro come back here after creating an account with
  // ?checkout=<plan>; send them straight on to Stripe instead of making them click again.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const plan = new URLSearchParams(window.location.search).get("checkout");
    if (!PLANS[plan]) return;
    window.history.replaceState(null, "", "/pricing");
    setBilling(plan);
    handleSubscribe(plan);
  }, [isLoaded, isSignedIn]);

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
            <img src="/logo-mark.png" alt="" className="logo-icon" width="22" height="28" />
            <span className="logo-text">Pete&rsquo;s Postings</span>
          </Link>
          <div className="nav-center">
            <Link href="/jobs" className="nav-link">Browse Jobs</Link>
          </div>
          <div className="nav-right">
            {isLoaded && (
              isSignedIn ? (
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
                  <Link href="/start" className="nav-cta">Get free alerts</Link>
                </>
              )
            )}
          </div>
        </div>
      </nav>

      <div className="pricing-page">
        <section className="pricing-hero">
          <span className="hero-tag">Pricing</span>
          <h1 className="pricing-hero-title">Be the <span className="pricing-hero-underline">first</span> to apply</h1>
          <p className="pricing-hero-desc">
            Start free with 5 alerts. Go Pro for unlimited alerts and every role posted in the last 48 hours.
          </p>

          {/* Billing toggle */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem", marginTop: "2rem" }}>
            <div style={{ display: "inline-flex", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "999px", padding: "4px", gap: "2px" }}>
              <button
                onClick={() => setBilling("weekly")}
                style={{
                  padding: "0.45rem 1.4rem", borderRadius: "999px", border: "none", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s",
                  background: billing === "weekly" ? "var(--navy)" : "transparent",
                  color: billing === "weekly" ? "#fff" : "var(--text-secondary)",
                }}
              >Weekly</button>
              <button
                onClick={() => setBilling("monthly")}
                style={{
                  padding: "0.45rem 1.4rem", borderRadius: "999px", border: "none", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s",
                  background: billing === "monthly" ? "var(--navy)" : "transparent",
                  color: billing === "monthly" ? "#fff" : "var(--text-secondary)",
                }}
              >Monthly</button>
              <button
                onClick={() => setBilling("yearly")}
                style={{
                  padding: "0.45rem 1.4rem", borderRadius: "999px", border: "none", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s",
                  background: billing === "yearly" ? "var(--navy)" : "transparent",
                  color: billing === "yearly" ? "#fff" : "var(--text-secondary)",
                }}
              >Annual</button>
            </div>
            {billing === "yearly" ? (
              <span style={{ fontSize: "0.85rem", color: "var(--forest-blue)", fontWeight: 600 }}>Save $35/yr with annual billing</span>
            ) : (
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Cancel anytime</span>
            )}
          </div>
        </section>

        <section className="pricing-cards">
          {/* Free */}
          <div className="pricing-card">
            <div className="pricing-card-header">
              <h3 className="pricing-card-name">Free</h3>
              <div className="pricing-card-price">
                <span className="pricing-card-amount">$0</span>
              </div>
              <p className="pricing-card-tagline">Free account &middot; no credit card</p>
            </div>
            <ul className="pricing-card-features">
              <li className="pricing-feature">{check} Every open role at all 20 banks</li>
              <li className="pricing-feature">{check} 5 text or email alerts</li>
              <li className="pricing-feature">{check} Save jobs and track applications</li>
              <li className="pricing-feature">{check} Search &amp; filter by location, type</li>
              <li className="pricing-feature pricing-feature-muted">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                Recent postings feed
              </li>
            </ul>
            <Link href="/start" className="pricing-card-cta pricing-cta-outline" style={{ width: "100%", display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}>
              Get my free alerts
            </Link>
          </div>

          {/* Pro */}
          <div className="pricing-card pricing-card-popular">
            <div className="pricing-card-popular-badge">Most Popular</div>
            <div className="pricing-card-header">
              <h3 className="pricing-card-name">Pro</h3>
              <div className="pricing-card-price">
                {billing === "yearly" ? (
                  <>
                    <span className="pricing-card-amount">$5.00</span>
                    <span className="pricing-card-period">/mo</span>
                  </>
                ) : billing === "weekly" ? (
                  <>
                    <span className="pricing-card-amount">${PLANS.weekly.price}</span>
                    <span className="pricing-card-period">/wk</span>
                  </>
                ) : (
                  <>
                    <s className="pricing-card-was" aria-label="$19.99 a month after the first 2,000 subscribers">$19.99</s>
                    <span className="pricing-card-amount">$7.99</span>
                    <span className="pricing-card-period">/mo</span>
                  </>
                )}
              </div>
              {billing === "yearly" ? (
                <p className="pricing-card-tagline">
                  <span style={{ textDecoration: "line-through", color: "var(--text-muted)", marginRight: "0.35rem" }}>$95.88</span>
                  <span style={{ color: "var(--forest-blue)", fontWeight: 600 }}>$59.99/yr — save $35</span>
                </p>
              ) : billing === "weekly" ? (
                <p className="pricing-card-tagline">Billed weekly · pay only for the weeks you need</p>
              ) : (
                <>
                  <p className="pricing-card-founding">
                    <strong>Founding price</strong> for the first 2,000 subscribers. Pro goes up to $19.99/mo after that.
                  </p>
                  <p className="pricing-card-tagline">Billed monthly</p>
                </>
              )}
            </div>
            <ul className="pricing-card-features">
              <li className="pricing-feature">{check} Everything in Free</li>
              <li className="pricing-feature pricing-feature-highlight">{check} <strong>Recent postings feed (last 48 hours)</strong></li>
              <li className="pricing-feature pricing-feature-highlight">{check} <strong>Unlimited text &amp; email alerts</strong></li>
            </ul>
            <div className="pricing-cta-group">
              {isSignedIn ? (
                <button
                  className="pricing-card-cta pricing-cta-primary"
                  onClick={() => handleSubscribe()}
                  disabled={checkoutLoading !== null}
                  style={{ width: "100%" }}
                >
                  {checkoutLoading ? "Redirecting..." : `Get Pro · $${PLANS[billing].price}/${PLANS[billing].period}`}
                </button>
              ) : (
                <SignUpButton mode="modal" forceRedirectUrl={`/pricing?checkout=${billing}`} signInForceRedirectUrl={`/pricing?checkout=${billing}`}>
                  <button className="pricing-card-cta pricing-cta-primary" style={{ width: "100%" }}>
                    {`Get Pro · $${PLANS[billing].price}/${PLANS[billing].period}`}
                  </button>
                </SignUpButton>
              )}
              <p style={{ textAlign: "center", fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.6rem" }}>
                {billing === "yearly" ? "Billed annually · cancel anytime" : "Cancel anytime"}
              </p>
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
              <h3 className="pricing-faq-q">Which plan should I pick?</h3>
              <p className="pricing-faq-a">Weekly ($3.99) is best if you're only recruiting for a few weeks. Monthly ($7.99) is the most popular. Yearly ($59.99) works out to $5 a month if you're recruiting all year. Every plan includes the same Pro features and renews automatically until you cancel.</p>
            </div>
            <div className="pricing-faq-item">
              <h3 className="pricing-faq-q">Can I cancel anytime?</h3>
              <p className="pricing-faq-a">Yes. You can cancel your Pro subscription at any time from your account settings. You'll keep access until the end of your billing period.</p>
            </div>
            <div className="pricing-faq-item">
              <h3 className="pricing-faq-q">How do SMS alerts work?</h3>
              <p className="pricing-faq-a">Add a phone number in your alert settings. The instant a new posting matches your preferences, you'll get a text with the role title, bank, and a direct link to apply. Free accounts get 5 alerts; Pro is unlimited.</p>
            </div>
            <div className="pricing-faq-item">
              <h3 className="pricing-faq-q">What does the recent postings feed include?</h3>
              <p className="pricing-faq-a">Pro subscribers see every job posted in the last 48 hours across all banks, updated instantly. You'll also get SMS or email alerts so you don't have to check manually.</p>
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
            <p>Pulled live from bank career sites &middot; Updated instantly</p>
            <p>&copy; 2026 Pete's Postings</p>
          </div>
        </div>
      </footer>

      {showInquiry && <ClubInquiryModal onClose={() => setShowInquiry(false)} />}
    </>
  );
}
