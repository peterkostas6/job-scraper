"use client";

import { useState, useEffect } from "react";
import { useUser, SignUpButton, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { track } from "@/lib/track";
import { capture } from "@/lib/analytics";
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
        capture("club_inquiry_sent", { member_count: form.memberCount || null });
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

  return (
    <>
      <nav>
        <div className="nav-inner">
          <Link href="/" className="logo logo-link" style={{ textDecoration: "none" }}>
            <img src="/logo-mark.svg" alt="" className="logo-icon" width="24" height="24" />
            <span className="logo-text">Pete&rsquo;s Postings</span>
          </Link>
          <div className="nav-center">
            <Link href="/jobs" className="nav-link">Browse Jobs</Link>
            <Link href="/recent" className="nav-link">Recent Postings</Link>
            <Link href="/notifications" className="nav-link">Alerts</Link>
            <Link href="/pricing" className="nav-link nav-link-active">Pricing</Link>
            <Link href="/about" className="nav-link">About</Link>
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

      <div className="pp">
        <section className="pp-head">
          <p className="ss-eyebrow">Pricing</p>
          <h1 className="ss-h2 pp-title">Start free. Go Pro when recruiting heats up.</h1>
          <p className="ss-lead">Every plan covers all 20 banks. Pro adds unlimited alerts and every role posted in the last 48 hours.</p>

          <div className="pp-toggle" role="tablist" aria-label="Billing period">
            {[["weekly", "Weekly"], ["monthly", "Monthly"], ["yearly", "Yearly"]].map(([key, label]) => (
              <button key={key} role="tab" aria-selected={billing === key} className={billing === key ? "on" : ""} onClick={() => { setBilling(key); capture("pricing_billing_changed", { billing: key }); }}>
                {label}
                {key === "yearly" && <span className="pp-save">Save 37%</span>}
              </button>
            ))}
          </div>
        </section>

        <section className="pp-plans">
          <div className="pp-plan">
            <p className="pp-plan-name">Free</p>
            <p className="pp-price">$0</p>
            <p className="pp-billed">Free forever. No credit card.</p>
            <Link href="/start" className="ss-btn ss-btn-light ss-btn-block">Set up alerts</Link>
            <ul className="pp-list">
              <li>Every open role at all 20 banks</li>
              <li>5 text or email alerts</li>
              <li>Save jobs and track applications</li>
              <li>Search and filter by city and type</li>
            </ul>
          </div>

          <div className="pp-plan pp-plan-pro">
            <div className="pp-plan-top">
              <p className="pp-plan-name">Pro</p>
              <span className="pp-badge">Most popular</span>
            </div>
            <p className="pp-price">
              ${billing === "yearly" ? "5.00" : PLANS[billing].price}
              <span>/{billing === "weekly" ? "week" : "month"}</span>
            </p>
            <p className="pp-billed">
              {billing === "yearly" ? `$${PLANS.yearly.price} billed once a year` : billing === "weekly" ? "Billed weekly. Pay only for the weeks you need." : "Billed monthly. Cancel anytime."}
            </p>
            {isSignedIn ? (
              <button className="ss-btn ss-btn-blue ss-btn-block" onClick={() => handleSubscribe()} disabled={checkoutLoading !== null}>
                {checkoutLoading ? "Redirecting…" : `Get Pro`}
              </button>
            ) : (
              <SignUpButton mode="modal" forceRedirectUrl={`/pricing?checkout=${billing}`} signInForceRedirectUrl={`/pricing?checkout=${billing}`}>
                <button className="ss-btn ss-btn-blue ss-btn-block" onClick={() => capture("pro_clicked", { billing, signed_in: false })}>Get Pro</button>
              </SignUpButton>
            )}
            <ul className="pp-list">
              <li><strong>Unlimited</strong> text and email alerts</li>
              <li><strong>Recent postings:</strong> every role from the last 48 hours</li>
              <li>Everything in Free</li>
            </ul>
            {billing === "monthly" && (
              <p className="pp-founding">Founding price for the first 2,000 members. Goes to $19.99/month after that.</p>
            )}
          </div>
        </section>

        <p className="pp-trust">
          <span>Cancel anytime</span>
          <span>Secure checkout with Stripe</span>
          <span>Keep access until your period ends</span>
        </p>

        <section className="pp-club">
          <div className="pp-club-copy">
            <p className="pp-plan-name">For finance clubs</p>
            <h2 className="pp-club-title">Pro for your whole club.</h2>
            <p className="pp-club-desc">Every member gets full Pro access and verifies with their school email. One invoice for the club.</p>
          </div>
          <div className="pp-club-side">
            <p className="pp-club-label">Club plan</p>
            <p className="pp-price">$50<span>/month</span></p>
            <button className="ss-btn ss-btn-block" onClick={() => { setShowInquiry(true); capture("club_inquiry_opened"); }}>Talk to us</button>
          </div>
        </section>

        <section className="ss-faq pp-faq">
          <h2 className="ss-h2">Questions</h2>
          {[
            ["Which plan should I pick?", "Weekly ($3.99) is best if you're only recruiting for a few weeks. Monthly ($7.99) is the most popular. Yearly ($59.99) works out to $5 a month if you're recruiting all year. Every plan includes the same Pro features and renews automatically until you cancel."],
            ["Can I cancel anytime?", "Yes. Cancel from your account settings at any time. You keep access until the end of your billing period."],
            ["How do text alerts work?", "Add a phone number in your alert settings. When a new posting matches your preferences, you get a text with the role, the bank and a direct link to apply. Free accounts get 5 alerts; Pro is unlimited."],
            ["What does the recent postings feed include?", "Every role posted in the last 48 hours across all 20 banks, updated every 5 minutes."],
            ["How do club memberships work?", "The club pays $50 a month. Members verify with their school email and get Pro automatically, so nobody manages individual subscriptions."],
          ].map(([q, a]) => (
            <details key={q} onToggle={(e) => { if (e.currentTarget.open) capture("faq_opened", { question: q, page: "pricing" }); }}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
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
