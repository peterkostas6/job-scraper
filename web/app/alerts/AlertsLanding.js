"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser, SignUpButton, SignInButton } from "@clerk/nextjs";
import { BANKS } from "@/lib/banks";
import { track } from "@/lib/track";
import { PLANS, PLAN_KEYS, planPrice } from "@/lib/plans";

const BANK_COUNT = Object.keys(BANKS).length;

const POINTS = [
  "A text the instant a matching role posts",
  `Every analyst and internship job from ${BANK_COUNT} banks in one place`,
  "Straight from bank career sites, not LinkedIn or Indeed",
];

const STEPS = [
  ["Pick what you want", "Choose your banks, analyst or internship roles, categories and city."],
  ["We watch the banks for you", `We check the career sites of all ${BANK_COUNT} banks around the clock for new postings.`],
  ["Get a text, apply first", "The moment a matching role goes live, you get a text with the title, bank and a direct link to apply."],
];

const INCLUDED = [
  ["Instant text alerts", "for the banks, roles and cities you choose"],
  ["Email alerts", "if you want them in your inbox too"],
  ["The last 48 hours", `every new role across all ${BANK_COUNT} banks in one list`],
  ["Saved jobs", "to keep track of what you\u2019ve applied to"],
];


export default function AlertsLanding() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const isSubscribed = user?.publicMetadata?.subscribed === true;
  const [plan, setPlan] = useState("monthly");
  const [starting, setStarting] = useState(false);
  // After signing up or in from this page, come back and go straight to checkout.
  const returnTo = `/alerts?start=${plan}`;

  async function checkout(chosen) {
    if (isSubscribed) { router.push("/notifications"); return; }
    setStarting(true);
    track("InitiateCheckout", planPrice(chosen));
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: chosen }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
    } catch {}
    setStarting(false);
  }

  // Back from sign-up / sign-in with ?start=<plan>: continue straight to checkout.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const url = new URL(window.location.href);
    const chosen = url.searchParams.get("start");
    if (!PLANS[chosen]) return;
    url.searchParams.delete("start");
    window.history.replaceState(null, "", url);
    setPlan(chosen);
    checkout(chosen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  const p = PLANS[plan];
  const ctaLabel = starting ? "Opening checkout\u2026" : isSubscribed ? "Set up your text alerts" : `Get instant alerts \u00b7 $${p.price}/${p.period}`;

  const picker = !isSubscribed && (
    <div className="lp-plans" role="radiogroup" aria-label="Choose a plan">
      {PLAN_KEYS.map((key) => {
        const option = PLANS[key];
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={plan === key}
            className={`lp-plan${plan === key ? " lp-plan-selected" : ""}`}
            onClick={() => setPlan(key)}
          >
            {key === "monthly" && <span className="lp-plan-tag">Most popular</span>}
            <span className="lp-plan-name">{option.name}</span>
            <span className="lp-plan-price">${option.price}<small>/{option.period}</small></span>
            {option.perMonth && <span className="lp-plan-note">${option.perMonth.toFixed(2)}/mo</span>}
          </button>
        );
      })}
    </div>
  );

  const button = isLoaded && !isSignedIn ? (
    <SignUpButton mode="modal" forceRedirectUrl={returnTo} signInForceRedirectUrl={returnTo}>
      <button className="lp-cta">{ctaLabel}</button>
    </SignUpButton>
  ) : (
    <button className="lp-cta" onClick={() => checkout(plan)} disabled={!isLoaded || starting}>{ctaLabel}</button>
  );

  return (
    <div className="lp">
      <header className="lp-header">
        <Link href="/" className="logo logo-link" aria-label="Pete's Postings home">
          <img src="/logo-mark.png" alt="" className="logo-icon" width="22" height="28" />
          <span className="logo-text">Pete&rsquo;s Postings</span>
        </Link>
      </header>

      <main className="lp-main">
        <p className="lp-kicker">Be the <span className="pricing-hero-underline">first</span> to apply.</p>
        <h1 className="lp-title">Get a text the instant a bank posts a job.</h1>

        <div className="lp-notif" aria-hidden="true">
          <div className="hero-notif-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M12 3C6.5 3 2 6.8 2 11.5c0 2.6 1.4 4.9 3.6 6.5L5 21l3.5-1.9c1.1.3 2.3.5 3.5.5 5.5 0 10-3.8 10-8.5S17.5 3 12 3z"/></svg>
          </div>
          <div className="hero-notif-body">
            <div className="hero-notif-header">
              <span className="hero-notif-app">Messages</span>
              <span className="hero-notif-time">now</span>
            </div>
            <div className="hero-notif-title">Pete&rsquo;s Postings</div>
            <div className="hero-notif-text">Goldman Sachs just posted: Investment Banking Summer Analyst 2027. Apply &rarr;</div>
          </div>
        </div>

        <ul className="lp-points">
          {POINTS.map((point) => (
            <li key={point}>
              <span className="modal-check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></span>
              {point}
            </li>
          ))}
        </ul>

        {picker}
        {button}
        <p className="lp-fine">
          Cancel anytime.
          {isLoaded && !isSignedIn && (
            <>
              {" "}Have an account?{" "}
              <SignInButton mode="modal" forceRedirectUrl={returnTo}>
                <button className="lp-link">Sign in</button>
              </SignInButton>
            </>
          )}
        </p>
        <Link href="/jobs?bank=all" className="lp-browse">or browse jobs free &rarr;</Link>

        <section className="lp-section">
          <h2 className="lp-heading">How it works</h2>
          <ol className="lp-steps">
            {STEPS.map(([name, desc], i) => (
              <li key={name}>
                <span className="lp-step-num">{i + 1}</span>
                <span><strong>{name}</strong><br />{desc}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-section">
          <h2 className="lp-heading">What you get</h2>
          <ul className="lp-included">
            {INCLUDED.map(([name, desc]) => (
              <li key={name}>
                <span className="modal-check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></span>
                <span><strong>{name}</strong> {desc}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-section">
          <h2 className="lp-heading">{BANK_COUNT} banks, one place</h2>
          <p className="lp-banks">{Object.values(BANKS).map((b) => b.name).join(" \u00b7 ")}</p>
        </section>

        <section className="lp-section">
          <h2 className="lp-heading">Stop refreshing 20 career sites.</h2>
          {button}
          <p className="lp-fine">{isSubscribed ? "" : `${p.name} plan \u00b7 cancel anytime`}</p>
        </section>
      </main>

      <footer className="lp-footer">
        <span>&copy; 2026 Pete&rsquo;s Postings</span>
        <span>
          <Link href="/privacy" className="text-link">Privacy Policy</Link>
          {" · "}
          <Link href="/terms" className="text-link">Terms of Service</Link>
        </span>
      </footer>
    </div>
  );
}
