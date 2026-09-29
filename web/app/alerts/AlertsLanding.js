"use client";

import Link from "next/link";
import { useUser, SignUpButton, SignInButton } from "@clerk/nextjs";
import { BANKS } from "@/lib/banks";
import HowItWorksDemo from "../[[...view]]/HowItWorksDemo";

const BANK_COUNT = Object.keys(BANKS).length;

const POINTS = [
  "A text the instant a matching role posts",
  `Every analyst and internship job from ${BANK_COUNT} banks in one place`,
  "Straight from bank career sites, not LinkedIn or Indeed",
];

const INCLUDED = [
  ["Text alerts", "for the banks, roles and cities you choose"],
  ["Email alerts", "if you want them in your inbox too"],
  ["Saved jobs", "to keep track of what you’ve applied to"],
];

export default function AlertsLanding() {
  const { isLoaded, isSignedIn } = useUser();

  // One action: a free account, then straight to the alert settings.
  const button = isLoaded && isSignedIn ? (
    <Link href="/notifications" className="lp-cta">Set up your alerts</Link>
  ) : (
    <SignUpButton mode="modal" forceRedirectUrl="/notifications" signInForceRedirectUrl="/notifications">
      <button className="lp-cta" disabled={!isLoaded}>Get 5 free alerts</button>
    </SignUpButton>
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

        {button}
        <p className="lp-fine">
          Free account. No card needed.
          {isLoaded && !isSignedIn && (
            <>
              {" "}Have an account?{" "}
              <SignInButton mode="modal" forceRedirectUrl="/notifications">
                <button className="lp-link">Sign in</button>
              </SignInButton>
            </>
          )}
        </p>
        <Link href="/jobs?bank=all" className="lp-browse">or browse jobs &rarr;</Link>

        <HowItWorksDemo />

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
          <p className="lp-banks">{Object.values(BANKS).map((b) => b.name).join(" · ")}</p>
        </section>

        <section className="lp-section">
          <h2 className="lp-heading">Stop refreshing {BANK_COUNT} career sites.</h2>
          {button}
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
