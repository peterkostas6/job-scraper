"use client";

// After Stripe: finish the account made from the checkout email, sign them in with the
// one-time ticket, count the trial, and send them on (Recent Postings or Alerts).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSignIn, useUser, SignInButton } from "@clerk/nextjs";
import { track } from "@/lib/track";
import { capture } from "@/lib/analytics";
import { PLANS } from "@/lib/plans";

export default function WelcomeFlow() {
  const { isLoaded: signInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const [state, setState] = useState({ status: "working" });
  const started = useRef(false);

  useEffect(() => {
    if (!signInLoaded || !userLoaded || started.current) return;
    started.current = true;
    const sessionId = new URL(window.location.href).searchParams.get("session_id") || "";
    if (!sessionId) { setState({ status: "error" }); return; }
    // Same event ID as the Stripe webhook's server copy, so the ad platforms count it once.
    track("StartTrial", PLANS.monthly.price, `trial_${sessionId}`);

    (async () => {
      for (let i = 0; i < 12; i++) {
        const res = await fetch("/api/checkout/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) }).catch(() => null);
        const data = res ? await res.json().catch(() => ({})) : {};
        if (data.status === "ready") {
          capture("guest_checkout_signed_in");
          try { localStorage.removeItem("pp-start-v3"); } catch {}
          try {
            if (!isSignedIn) {
              const attempt = await signIn.create({ strategy: "ticket", ticket: data.ticket });
              if (attempt.status === "complete") await setActive({ session: attempt.createdSessionId });
            }
            window.location.replace(data.next || "/recent");
          } catch {
            setState({ status: "existing", next: data.next, email: data.email });
          }
          return;
        }
        if (data.status === "existing") {
          capture("guest_checkout_existing_account");
          if (isSignedIn) { window.location.replace(data.next || "/recent"); return; }
          setState({ status: "existing", next: data.next, email: data.email });
          return;
        }
        if (data.status === "expired" || res?.status === 400) { setState({ status: "error" }); return; }
        await new Promise((r) => setTimeout(r, 1500));
      }
      setState({ status: "slow" });
    })();
  }, [signInLoaded, userLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  let body;
  if (state.status === "working") {
    body = (
      <>
        <div className="spinner" aria-hidden="true" />
        <h1 className="wl-title">You&rsquo;re in. Setting up your account&hellip;</h1>
        <p className="wl-sub">This takes a few seconds.</p>
      </>
    );
  } else if (state.status === "existing") {
    body = (
      <>
        <h1 className="wl-title">You&rsquo;re Pro. Sign in to finish.</h1>
        <p className="wl-sub">{state.email ? <>There&rsquo;s already an account for <strong>{state.email}</strong>.</> : "There's already an account for that email."} Sign in and your Pro access is waiting.</p>
        <SignInButton mode="modal" forceRedirectUrl={state.next === "/notifications?welcome=1" ? "/start?paid=true" : state.next || "/recent"} initialValues={state.email ? { emailAddress: state.email } : undefined}>
          <button className="st-cta wl-cta">Sign in</button>
        </SignInButton>
      </>
    );
  } else if (state.status === "slow") {
    body = (
      <>
        <h1 className="wl-title">Your payment went through.</h1>
        <p className="wl-sub">Your account is still being set up. Refresh this page in a minute, or sign in with the email you used at checkout.</p>
        <SignInButton mode="modal" forceRedirectUrl="/recent"><button className="st-cta wl-cta">Sign in</button></SignInButton>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="wl-title">Something went wrong finishing your account.</h1>
        <p className="wl-sub">If you paid, you&rsquo;re covered. Sign in with the email you used at checkout, or email pete@petespostings.com and we&rsquo;ll sort it out.</p>
        <SignInButton mode="modal" forceRedirectUrl="/recent"><button className="st-cta wl-cta">Sign in</button></SignInButton>
      </>
    );
  }

  return (
    <div className="st wl">
      <header className="st-header">
        <Link href="/" className="logo logo-link" aria-label="Pete's Postings home">
          <img src="/logo-mark.svg" alt="" className="logo-icon" width="24" height="24" />
          <span className="logo-text">Pete&rsquo;s Postings</span>
        </Link>
      </header>
      <main className="wl-main" aria-live="polite">{body}</main>
    </div>
  );
}
