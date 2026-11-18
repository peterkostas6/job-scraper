"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { capture } from "@/lib/analytics";
import { useUser, SignUpButton, SignInButton } from "@clerk/nextjs";
import { BANKS } from "@/lib/banks";
import BankLogo from "@/lib/bank-logo";
import { decodeEntities } from "@/lib/text";
import { AREAS } from "@/lib/alert-options";
import { useTrackSignup } from "@/lib/use-track-signup";
import { track } from "@/lib/track";
import { PLANS } from "@/lib/plans";

const BANK_COUNT = Object.keys(BANKS).length;
const STORAGE_KEY = "pp-start-v2";

// Sell the outcome first, then two steps: phone number, then the free trial. After checkout,
// texts turn on for front-office roles at every bank and the person lands on the Alerts page
// to fine-tune. (The old four-question quiz asked for everything before showing any value.)
const STEPS = ["pitch", "phone", "plan"];
const PROGRESS_STEPS = ["phone", "plan"];

// What texts cover until someone changes it: front-office roles at all banks, both types, anywhere.
const DEFAULT_AREAS = ["ib", "st", "cb", "rq"];
const DEFAULT_PREFS = {
  jobType: "all",
  categories: DEFAULT_AREAS.flatMap((k) => AREAS.find((a) => a.key === k)?.categories || []),
  banks: [],
  location: "",
};

// "2125550123" -> "(212) 555-0123"; anything else is shown as typed.
const formatPhone = (raw) => {
  const d = raw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw;
};
const validPhone = (raw) => { const d = raw.replace(/\D/g, ""); return d.length === 10 || (d.length === 11 && d.startsWith("1")); };
const postedAt = (j) => Date.parse(j.postedDate) || j.detectedAt || 0;

const SMS_ICON = <svg width="16" height="16" viewBox="0 0 64 64" fill="#fff" aria-hidden="true"><path d="M32 9C17.6 9 6 18.4 6 30c0 6.1 3.3 11.7 8.6 15.6-.5 3.7-2 7.2-4.5 10.1-.3.4 0 1 .5 1 5.5-.5 10.6-2.4 14.6-5.4C27.4 51.7 29.7 52 32 52c14.4 0 26-9.4 26-21S46.4 9 32 9z"/></svg>;

export default function StartFlow() {
  const { isLoaded, isSignedIn, user } = useUser();
  const isSubscribed = user?.publicMetadata?.subscribed === true;
  useTrackSignup(user);

  const [step, setStep] = useState("pitch");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [restored, setRestored] = useState(false);
  const [jobs, setJobs] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Progress survives the sign-up modal, the Stripe round trip and a refresh.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved) {
        if (STEPS.includes(saved.step)) setStep(saved.step);
        if (saved.phone) setPhone(saved.phone);
        if (saved.smsConsent) setSmsConsent(true);
        setPendingCheckout(Boolean(saved.pendingCheckout));
      }
    } catch {}
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, phone, smsConsent, pendingCheckout })); } catch {}
  }, [restored, step, phone, smsConsent, pendingCheckout]);

  // Back from the sign-up modal on the trial step: carry straight on to Stripe.
  useEffect(() => {
    if (!restored || !isLoaded || !isSignedIn || !pendingCheckout) return;
    setPendingCheckout(false);
    if (isSubscribed) turnOnTexts();
    else startCheckout();
  }, [restored, isLoaded, isSignedIn, pendingCheckout]); // eslint-disable-line react-hooks/exhaustive-deps

  // Back from Stripe (/start?paid=true): count the trial, turn the texts on, go to Alerts.
  useEffect(() => {
    if (!restored || !isLoaded || !isSignedIn) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("paid") !== "true") return;
    const sessionId = url.searchParams.get("session_id") || "";
    // Same event ID as the Stripe webhook's server copy, so the ad platforms count it once.
    track("StartTrial", PLANS.monthly.price, sessionId && `trial_${sessionId}`);
    window.history.replaceState(null, "", "/start");
    turnOnTexts();
  }, [restored, isLoaded, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/jobs-live")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setJobs((data.jobs || []).map((j) => ({ ...j, title: decodeEntities(j.title) }))))
      .catch(() => setJobs([]));
  }, []);

  useEffect(() => {
    if (restored) capture("start_step_viewed", { step });
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [restored, step]);

  // Three real, recent front-office roles for the sample texts on the first screen.
  const samples = useMemo(() => {
    if (!jobs) return [];
    const seen = new Set();
    return [...jobs]
      .filter((j) => DEFAULT_PREFS.categories.includes(j.category) && j.title.length < 64 && !seen.has(j.title) && seen.add(j.title))
      .sort((a, b) => postedAt(b) - postedAt(a))
      .slice(0, 3);
  }, [jobs]);

  function confirmPhone() {
    setError("");
    if (!validPhone(phone)) { setError("Enter a 10-digit US mobile number."); return; }
    if (!smsConsent) { setError("Check the box to agree to texts."); return; }
    capture("start_phone_entered", { signedIn: Boolean(isSignedIn) });
    if (isSubscribed) turnOnTexts();
    else setStep("plan");
  }

  async function startCheckout() {
    setError("");
    setSaving(true);
    track("InitiateCheckout", PLANS.monthly.price);
    capture("start_checkout_started");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "monthly", returnTo: "/start" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.url) throw new Error(data.error || "checkout failed");
      window.location.href = data.url;
    } catch {
      setError("Couldn\u2019t open checkout. Try again.");
      setSaving(false);
    }
  }

  // Texts on (plus email) for front-office roles everywhere, then on to Alerts to fine-tune.
  async function turnOnTexts() {
    setError("");
    if (!validPhone(phone) || !smsConsent) { setStep("phone"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, ...DEFAULT_PREFS, smsEnabled: true, smsConsent: true, phoneNumber: phone.replace(/\D/g, "") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "save failed");
      capture("start_alerts_saved", { sms: true, email: true, defaults: true });
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      window.location.href = "/notifications?welcome=1";
    } catch {
      setError("Couldn\u2019t turn on your texts. Try again.");
      setSaving(false);
      setStep("phone");
    }
  }

  const progressIndex = PROGRESS_STEPS.indexOf(step);
  const progress = progressIndex >= 0 && (
    <div className="st-progress">
      <div className="st-progress-bar"><span style={{ width: `${((progressIndex + 1) / PROGRESS_STEPS.length) * 100}%` }} /></div>
      <div className="st-progress-row">
        <button className="st-back" onClick={() => setStep(STEPS[STEPS.indexOf(step) - 1])}>&larr; Back</button>
        <span className="st-progress-count">Step {progressIndex + 1} of {PROGRESS_STEPS.length}: {step === "phone" ? "Your number" : "Free trial"}</span>
      </div>
    </div>
  );

  let body;
  if (step === "pitch") {
    body = (
      <div className="st-pitch">
        <div className="st-pitch-copy">
          <h1 className="st-q st-pitch-title">Your resume should be first in the pile.</h1>
          <p className="st-hint">
            Banks post analyst and internship roles at random hours and start reading applications right away.
            We check all {BANK_COUNT} banks every 5 minutes and text you the moment a role goes live, so yours is one of the first they see.
          </p>
          <ul className="st-proof">
            <li><strong>{BANK_COUNT}</strong> banks, straight from their own career sites</li>
            <li><strong>5 min</strong> from posting to your phone</li>
            <li><strong>{PLANS.monthly.trialDays} days</strong> free, then ${PLANS.monthly.price}/mo</li>
          </ul>
          <button className="st-cta" onClick={() => { capture("start_pitch_continue"); setStep("phone"); }}>
            Set up texts so you can apply first &rarr;
          </button>
          <Link href="/jobs" className="st-skip" onClick={() => capture("start_browse_clicked")}>Just browse jobs &rarr;</Link>
        </div>
        <div className="st-texts" aria-label="Example alerts" role="img">
          <span className="st-texts-label">What lands on your phone</span>
          {(samples.length ? samples : [{ bank: "Goldman Sachs", title: "2027 Investment Banking Summer Analyst" }]).map((job, i) => (
            <div key={job.link || i} className="st-text" style={{ animationDelay: `${i * 160}ms` }}>
              <span className="st-text-icon">{SMS_ICON}</span>
              <div>
                <div className="st-text-head"><strong>Pete&rsquo;s Postings</strong><span>{i === 0 ? "now" : `${i * 4}m ago`}</span></div>
                <p>{job.bankKey && <BankLogo bankKey={job.bankKey} bank={job.bank} size={14} />} {job.bank} just posted: {job.title}. Apply &rarr;</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (step === "phone") {
    body = (
      <>
        <h1 className="st-q">Where should we text you?</h1>
        <p className="st-hint">The second a front-office role posts at any of the {BANK_COUNT} banks, it&rsquo;s on your phone. You can narrow it down after.</p>
        <label className="st-field-label" htmlFor="st-phone">Mobile number</label>
        <input id="st-phone" className="st-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="(555) 000-0000" autoFocus
          value={phone} onChange={(e) => { setPhone(e.target.value); setError(""); }}
          onBlur={() => setPhone(formatPhone(phone))}
          onKeyDown={(e) => { if (e.key === "Enter") confirmPhone(); }} />
        <label className="st-consent">
          <input type="checkbox" checked={smsConsent} onChange={(e) => { setSmsConsent(e.target.checked); setError(""); }} />
          <span>
            I agree to receive recurring automated text messages from Pete&rsquo;s Postings about new job postings matching my preferences. Message frequency varies based on new job postings matching your preferences, up to a few times per day. Message and data rates may apply. Reply <strong>STOP</strong> to cancel, <strong>HELP</strong> for help. Consent is not required to use Pete&rsquo;s Postings. See our{" "}
            <Link href="/privacy" className="text-link" target="_blank">Privacy Policy</Link> and{" "}
            <Link href="/terms" className="text-link" target="_blank">Terms of Service</Link>.
          </span>
        </label>
        {error && <p className="st-error" role="alert">{error}</p>}
        <button className="st-cta" onClick={confirmPhone} disabled={saving}>{saving ? "Turning on texts\u2026" : "Continue"}</button>
      </>
    );
  } else {
    const payButton = <button className="st-cta" disabled={saving || !isLoaded} onClick={isSignedIn ? startCheckout : () => setPendingCheckout(true)}>{saving ? "Opening checkout\u2026" : `Start my ${PLANS.monthly.trialDays}-day free trial`}</button>;
    body = (
      <>
        <h1 className="st-q">Be first in the pile, free for {PLANS.monthly.trialDays} days.</h1>
        <p className="st-hint">We&rsquo;ll text {formatPhone(phone)} the moment a new role posts. $0 today, then ${PLANS.monthly.price}/month. Cancel anytime.</p>
        <ul className="st-plan-list">
          <li>Unlimited text alerts, nights and weekends included</li>
          <li>Every role posted in the last 48 hours</li>
          <li>Pick exactly which banks, roles and cities right after</li>
        </ul>
        {error && <p className="st-error" role="alert">{error}</p>}
        {isSignedIn ? payButton : (
          <SignUpButton mode="modal" forceRedirectUrl="/start" signInForceRedirectUrl="/start">{payButton}</SignUpButton>
        )}
        <p className="st-fine">Pay with Apple Pay or card &middot; Secure checkout by Stripe</p>
      </>
    );
  }

  return (
    <div className="st">
      <header className="st-header">
        <Link href="/" className="logo logo-link" aria-label="Pete's Postings home">
          <img src="/logo-mark.svg" alt="" className="logo-icon" width="24" height="24" />
          <span className="logo-text">Pete&rsquo;s Postings</span>
        </Link>
        {isLoaded && !isSignedIn && (
          <SignInButton mode="modal" forceRedirectUrl="/notifications">
            <button className="st-signin">Sign in</button>
          </SignInButton>
        )}
      </header>
      <main className={`st-main${step === "pitch" ? " st-main-wide" : ""}`}>
        {progress}
        {restored ? body : null}
      </main>
    </div>
  );
}
