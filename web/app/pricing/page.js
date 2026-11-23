"use client";

import { useState, useEffect } from "react";
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { track } from "@/lib/track";
import { capture } from "@/lib/analytics";
import { PLANS, planPrice } from "@/lib/plans";
import { openBillingPortal } from "@/lib/billing";
import { trialFor } from "@/lib/alert-trial-days";
import BankLogo from "@/lib/bank-logo";
import { useNavMenuLock } from "@/lib/use-nav-menu";
import { FIRM_LABEL } from "@/lib/firms";

const SMS_ICON = <svg width="16" height="16" viewBox="0 0 64 64" fill="#fff" aria-hidden="true"><path d="M32 9C17.6 9 6 18.4 6 30c0 6.1 3.3 11.7 8.6 15.6-.5 3.7-2 7.2-4.5 10.1-.3.4 0 1 .5 1 5.5-.5 10.6-2.4 14.6-5.4C27.4 51.7 29.7 52 32 52c14.4 0 26-9.4 26-21S46.4 9 32 9z"/></svg>;

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
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  useNavMenuLock(navMenuOpen, () => setNavMenuOpen(false));
  const { isSignedIn, isLoaded, user } = useUser();
  const [showInquiry, setShowInquiry] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [plan, setPlan] = useState("premium");
  const isSubscribed = user?.publicMetadata?.subscribed === true;
  // Every account has Premium for its first 3 days (lib/alert-trial-days.js).
  const trial = user && !isSubscribed ? trialFor(user.createdAt) : null;
  const inTrial = Boolean(trial && !trial.over);
  const trialDaysLeft = inTrial ? Math.max(1, Math.ceil((trial.endsAt - Date.now()) / 86400000)) : 0;
  // /pricing?alert=<code>: they tapped an alert after their 3 free days.
  const [alertLocked, setAlertLocked] = useState(false);
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("alert");
    if (!code) return;
    setAlertLocked(true);
    capture("paywall_viewed", { where: "alert_link", signed_in: Boolean(isSignedIn) });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function handleSubscribe(plan = "monthly") {
    track("InitiateCheckout", planPrice(plan));
    setCheckoutLoading(plan);
    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, cancelTo: "/pricing" }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.url) window.location.href = data.url;
        else if (data.alreadyPro) window.location.reload(); // already Pro: reload shows it
        else setCheckoutLoading(null);
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
          <div className={`nav-center${navMenuOpen ? " nav-center-open" : ""}`} onClick={() => setNavMenuOpen(false)}>
            <Link href="/jobs" className="nav-link">Browse Jobs</Link>
            <Link href="/recent" className="nav-link nav-link-new">
              {user?.publicMetadata?.subscribed === true || (user && !trialFor(user.createdAt).over) ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Premium"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
              )}
              Recent Postings
            </Link>
            <Link href="/pricing" className="nav-link nav-link-active" aria-current="page">Pricing</Link>
            <Link href="/about" className="nav-link">About</Link>
          </div>
          <div className="nav-right">
            {isLoaded && (
              isSignedIn ? (
                <>
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
                  <Link href="/start" className="nav-cta">Get SMS alerts</Link>
                </>
              )
            )}
          </div>
          {/* Phones only: the nav links don't fit in the bar, so they open as a menu (same as the rest of the site). */}
          <button
            className="nav-menu-btn"
            onClick={() => setNavMenuOpen((v) => !v)}
            aria-label={navMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={navMenuOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {navMenuOpen ? <path d="M18 6L6 18M6 6l12 12"/> : <path d="M4 7h16M4 12h16M4 17h16"/>}
            </svg>
          </button>
        </div>
      </nav>

      <div className="pp">
        {/* Paywall card (video layout): full-bleed art fading into the card, headline, two plan rows
            with Premium highlighted, one ink button, plain-text "Maybe later". */}
        <section className="pw">
          <button
            type="button"
            className="pw-close"
            aria-label="Close"
            onClick={() => {
              // Back to where they came from on this site; otherwise to Browse.
              if (document.referrer.startsWith(window.location.origin)) window.history.back();
              else window.location.href = "/jobs";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
          <div className="pw-art" aria-label="Example text alerts" role="img">
            {[
              { bankKey: "gs", bank: "Goldman Sachs", title: "2027 Investment Banking Summer Analyst", when: "now" },
              { bankKey: "ms", bank: "Morgan Stanley", title: "2027 Sales & Trading Summer Analyst", when: "4m ago" },
              { bankKey: "jpmc", bank: "JPMorgan Chase", title: "2027 Markets Summer Analyst", when: "11m ago" },
            ].map((job) => (
              <div key={job.bankKey} className="st-text">
                <span className="st-text-icon">{SMS_ICON}</span>
                <div>
                  <div className="st-text-head"><strong>Pete&rsquo;s Postings</strong><span>{job.when}</span></div>
                  <p><BankLogo bankKey={job.bankKey} bank={job.bank} size={14} /> {job.bank} just posted: {job.title}. <span className="pw-apply">Apply &rarr;</span></p>
                </div>
              </div>
            ))}
          </div>

          <div className="pw-body">
            <h1 className="pw-title">{alertLocked ? "To open alerts, you need Premium." : "Your application, first in the stack."}</h1>
            <ul className="pw-gets">
              <li>Instant texts from {FIRM_LABEL} firms</li>
              <li>Every role from the last 48 hours</li>
              <li>Save jobs and track applications</li>
            </ul>

            <div className="pw-plans" role="radiogroup" aria-label="Plan">
              <button type="button" role="radio" aria-checked={plan === "premium"} className={`pw-plan${plan === "premium" ? " on" : ""}`} onClick={() => setPlan("premium")}>
                {inTrial && <span className="pw-badge">{trialDaysLeft} free {trialDaysLeft === 1 ? "day" : "days"} left</span>}
                <span className="pw-plan-left">
                  <strong>Premium</strong>
                  <span>{isSubscribed ? "You have Premium" : "Everything above"}</span>
                </span>
                <span className="pw-plan-price">${PLANS.monthly.price}/mo</span>
              </button>
              {!alertLocked && (
                <button type="button" role="radio" aria-checked={plan === "club"} className={`pw-plan${plan === "club" ? " on" : ""}`} onClick={() => setPlan("club")}>
                  <span className="pw-plan-left">
                    <strong>Finance club</strong>
                    <span>Premium for every member</span>
                  </span>
                  <span className="pw-plan-price">$50/mo</span>
                </button>
              )}
            </div>

            <p className="pw-fine">
              {plan === "club" ? "One invoice for the club. Members verify with their school email."
                : isSubscribed ? "Change your plan or cancel anytime."
                : "Billed monthly. Cancel anytime."}
            </p>

            {plan === "club" ? (
              <button className="pw-cta" onClick={() => { setShowInquiry(true); capture("club_inquiry_opened"); }}>Talk to us</button>
            ) : isSubscribed ? (
              user?.publicMetadata?.stripeCustomerId ? <button className="pw-cta" onClick={openBillingPortal}>Manage subscription</button> : null
            ) : isSignedIn ? (
              <button className="pw-cta" onClick={() => handleSubscribe()} disabled={checkoutLoading !== null}>
                {checkoutLoading ? "Redirecting…" : "Get Premium"}
              </button>
            ) : alertLocked ? (
              // They already have an account (the alert came to them): sign in, then straight to checkout.
              <SignInButton mode="modal" forceRedirectUrl="/pricing?checkout=monthly" signUpForceRedirectUrl="/pricing?checkout=monthly">
                <button className="pw-cta" onClick={() => capture("pro_clicked", { billing: "monthly", signed_in: false, from: "alert_link" })}>Get Premium</button>
              </SignInButton>
            ) : (
              // Signed out: straight to Stripe. Checkout works without an account (Stripe takes the
              // email; the account is made after payment and /welcome signs them in).
              <button className="pw-cta" onClick={() => { capture("pro_clicked", { billing: "monthly", signed_in: false }); handleSubscribe(); }} disabled={checkoutLoading !== null}>
                {checkoutLoading ? "Redirecting…" : "Get Premium"}
              </button>
            )}
            {!isSubscribed && <Link href="/jobs" className="pw-later">Maybe later</Link>}
          </div>
        </section>

        {!alertLocked && <>
        <section className="ss-faq pp-faq">
          <h2 className="ss-h2">Questions</h2>
          {[
            ["How much is Premium?", "$4.99 a month. Alerts are free for your first 3 days; after that, Premium lets you open every alert and see the 48-hour recent postings feed. It renews monthly until you cancel."],
            ["Can I cancel anytime?", "Yes. Cancel from your account settings at any time. You keep access until the end of your billing period."],
            ["How do text alerts work?", "Add a phone number in your alert settings. When a new posting matches your preferences, you get a text with the role, the bank and a direct link to apply. Alerts are free for everyone with an account. For your first 3 days you can open every one; after that, opening them takes Premium."],
            ["What does the recent postings feed include?", `Every role posted in the last 48 hours across all ${FIRM_LABEL} firms, updated around the clock.`],
            ["How do club memberships work?", "The club pays $50 a month. Members verify with their school email and get Premium automatically, so nobody manages individual subscriptions."],
          ].map(([q, a]) => (
            <details key={q} onToggle={(e) => { if (e.currentTarget.open) capture("faq_opened", { question: q, page: "pricing" }); }}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
        </>}
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
