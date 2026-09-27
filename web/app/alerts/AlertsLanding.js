"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser, SignUpButton, SignInButton } from "@clerk/nextjs";
import { BANKS } from "@/lib/banks";
import { track } from "@/lib/track";

const BANK_COUNT = Object.keys(BANKS).length;
// After signing up or in from this page, come back here and go straight to checkout.
const RETURN_TO = "/alerts?start=1";

const BENEFITS = [
  ["A text the instant it posts", "When a bank posts a role matching your banks, job type and city, your phone buzzes with a direct link to apply."],
  [`Every bank in one place`, `All analyst and internship roles from ${BANK_COUNT} banks, including Goldman Sachs, JPMorgan and Morgan Stanley, in one list.`],
  ["Straight from the source", "Pulled directly from each bank’s own careers system. No reposts, no expired listings."],
];

const STEPS = [
  ["Start your free trial", "14 days free. Cancel any time before it ends and you pay nothing."],
  ["Pick what you want", "Choose your banks, analyst or internship, categories and city."],
  ["Get a text, apply first", "The moment a matching role goes live, you know."],
];

export default function AlertsLanding() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const isSubscribed = user?.publicMetadata?.subscribed === true;
  const [starting, setStarting] = useState(false);

  async function startTrial() {
    if (isSubscribed) { router.push("/notifications"); return; }
    setStarting(true);
    track("InitiateCheckout", 7.99);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "monthly" }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
    } catch {}
    setStarting(false);
  }

  // Coming back from sign-up / sign-in with ?start=1: continue straight to checkout.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("start") !== "1") return;
    url.searchParams.delete("start");
    window.history.replaceState(null, "", url);
    startTrial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  const ctaLabel = starting ? "Opening checkout…" : isSubscribed ? "Set up your text alerts" : "Start 14-day free trial";
  const cta = (extraClass = "") =>
    isLoaded && !isSignedIn ? (
      <SignUpButton mode="modal" forceRedirectUrl={RETURN_TO} signInForceRedirectUrl={RETURN_TO}>
        <button className={`lp-cta ${extraClass}`}>{ctaLabel}</button>
      </SignUpButton>
    ) : (
      <button className={`lp-cta ${extraClass}`} onClick={startTrial} disabled={!isLoaded || starting}>{ctaLabel}</button>
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
        <section className="lp-hero">
          <h1 className="lp-title">Get a text the instant a bank posts a job.</h1>
          <p className="lp-sub">
            Analyst and internship roles from {BANK_COUNT} banks, straight from their career sites. Be first to apply.
          </p>

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

          {cta()}
          <p className="lp-fine">14 days free, then $7.99/mo founding price &middot; Cancel any time</p>
          <Link href="/jobs?bank=all" className="lp-browse">or browse every open job free &rarr;</Link>
        </section>

        <section className="lp-section">
          <div className="lp-benefits">
            {BENEFITS.map(([name, desc]) => (
              <div key={name} className="lp-benefit">
                <strong>{name}</strong>
                <span>{desc}</span>
              </div>
            ))}
          </div>
        </section>

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

        <section className="lp-section lp-close">
          <h2 className="lp-heading">Stop refreshing 20 career sites.</h2>
          {cta()}
          {isLoaded && !isSignedIn && (
            <p className="lp-fine">
              Already have an account?{" "}
              <SignInButton mode="modal" forceRedirectUrl={RETURN_TO}>
                <button className="lp-link">Sign in</button>
              </SignInButton>
            </p>
          )}
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
