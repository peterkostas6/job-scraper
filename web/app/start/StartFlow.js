"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { capture } from "@/lib/analytics";
import { useUser, SignUpButton, SignInButton } from "@clerk/nextjs";
import { BANKS } from "@/lib/banks";
import BankLogo from "@/lib/bank-logo";
import { decodeEntities } from "@/lib/text";
import { JOB_TYPES, AREAS, CITIES, matchesAlertPrefs } from "@/lib/alert-options";
import { useTrackSignup } from "@/lib/use-track-signup";
import { track } from "@/lib/track";
import { PLANS } from "@/lib/plans";

const BANK_COUNT = Object.keys(BANKS).length;
const STORAGE_KEY = "pp-start-v1";

const STEPS = ["type", "area", "banks", "city", "results", "phone", "plan", "done"];
const QUESTION_COUNT = 5;

const EMPTY = { jobType: null, areas: [], banks: [], city: null, channel: null };

const CHANNELS = [
  { key: "sms", label: "Text me", sub: "Fastest. Most people pick this." },
  { key: "both", label: "Text and email", sub: "A text plus the full list by email" },
  { key: "email", label: "Email me", sub: "No phone number needed" },
];

// "2125550123" -> "(212) 555-0123"; anything else is shown as typed.
const formatPhone = (raw) => {
  const d = raw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw;
};

const cleanLocation = (loc) => (loc || "").replace(/,\s*United States( of America)?/gi, "").trim();

// The alert settings these answers become; the same shape the notify cron matches on.
function toPrefs(a) {
  return {
    jobType: a.jobType || "all",
    categories: a.areas.flatMap((k) => AREAS.find((x) => x.key === k)?.categories || []),
    banks: a.banks,
    location: a.city || "",
  };
}

// "Investment Banking internships at all 20 banks in New York"
function describe(a) {
  const area = a.areas.length === 0 ? "" : a.areas.map((k) => AREAS.find((x) => x.key === k)?.label).join(" or ") + " ";
  const type = a.jobType === "internship" ? "internships" : a.jobType === "fulltime" ? "analyst roles" : "roles";
  const banks = a.banks.length === 0 ? `all ${BANK_COUNT} banks` : a.banks.length === 1 ? BANKS[a.banks[0]].name : `${a.banks.length} banks`;
  return `${area}${type} at ${banks}${a.city ? ` in ${a.city}` : ""}`;
}

export default function StartFlow() {
  const { isLoaded, isSignedIn, user } = useUser();
  const isSubscribed = user?.publicMetadata?.subscribed === true;
  useTrackSignup(user);

  const [step, setStep] = useState("type");
  const [answers, setAnswers] = useState(EMPTY);
  const [pendingSignup, setPendingSignup] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [restored, setRestored] = useState(false);
  const [jobs, setJobs] = useState(null);

  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [emailOn, setEmailOn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Answers survive the sign-up redirect (and a refresh) through localStorage.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.answers) {
        setAnswers({ ...EMPTY, ...saved.answers });
        if (STEPS.includes(saved.step) && saved.step !== "done") setStep(saved.step);
        setPendingSignup(Boolean(saved.pendingSignup));
        setPendingCheckout(Boolean(saved.pendingCheckout));
        if (saved.phone) setPhone(saved.phone);
        if (saved.smsConsent) setSmsConsent(true);
        if (typeof saved.emailOn === "boolean") setEmailOn(saved.emailOn);
      }
    } catch {}
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, step, pendingSignup, pendingCheckout, phone, smsConsent, emailOn })); } catch {}
  }, [restored, answers, step, pendingSignup, pendingCheckout, phone, smsConsent, emailOn]);

  // Back from sign-up: email-only alerts save right away; anything with texts asks for the number.
  useEffect(() => {
    if (!restored || !isLoaded || !isSignedIn || !pendingSignup) return;
    setPendingSignup(false);
    afterChannel(answers.channel);
  }, [restored, isLoaded, isSignedIn, pendingSignup]); // eslint-disable-line react-hooks/exhaustive-deps

  // Back from sign-up on the price step: carry straight on to Stripe.
  useEffect(() => {
    if (!restored || !isLoaded || !isSignedIn || !pendingCheckout) return;
    setPendingCheckout(false);
    if (isSubscribed) saveAlerts({ emailOnly: answers.channel === "email" });
    else startCheckout();
  }, [restored, isLoaded, isSignedIn, pendingCheckout]); // eslint-disable-line react-hooks/exhaustive-deps

  // Back from Stripe (/start?paid=true): count the purchase, then turn the texts on.
  useEffect(() => {
    if (!restored || !isLoaded || !isSignedIn) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("paid") !== "true") return;
    const sessionId = url.searchParams.get("session_id") || "";
    // Same event ID as the Stripe webhook's server copy, so the ad platforms count it once.
    track("StartTrial", PLANS.monthly.price, sessionId && `trial_${sessionId}`);
    window.history.replaceState(null, "", "/start");
    saveAlerts({ emailOnly: answers.channel === "email" });
  }, [restored, isLoaded, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/jobs-live")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setJobs((data.jobs || []).map((j) => ({ ...j, title: decodeEntities(j.title), location: cleanLocation(j.location) }))))
      .catch(() => setJobs([]));
  }, []);

  useEffect(() => {
    if (restored) capture("start_step_viewed", { step });
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [restored, step]);

  const prefs = useMemo(() => toPrefs(answers), [answers]);
  const matched = useMemo(() => {
    if (!jobs) return null;
    return jobs.filter((j) => matchesAlertPrefs(j, prefs)).sort((a, b) => b.detectedAt - a.detectedAt);
  }, [jobs, prefs]);

  const go = (next) => setStep(next);
  const back = () => setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)]);
  const questionIndex = STEPS.indexOf(step);
  const set = (patch) => setAnswers((a) => ({ ...a, ...patch }));
  const toggle = (field, key) => setAnswers((a) => ({
    ...a,
    [field]: a[field].includes(key) ? a[field].filter((k) => k !== key) : [...a[field], key],
  }));

  // Alerts are Pro-only, so email-only also goes to the price step unless already Pro.
  function afterChannel(channel) {
    if (channel === "email") {
      if (isSubscribed) saveAlerts({ emailOnly: true });
      else go("plan");
    } else {
      setEmailOn(channel === "both");
      setStep("phone");
    }
  }

  function chooseChannel(channel) {
    set({ channel });
    capture("start_channel_chosen", { channel, signedIn: Boolean(isSignedIn) });
    // Texts ask for the number first and the account just before paying; email needs the account now.
    if (isSignedIn || channel !== "email") afterChannel(channel);
    else setPendingSignup(true);
  }

  // The phone step checks the number here, then shows the price. Pro accounts skip it.
  function confirmPhone() {
    setError("");
    const digits = phone.replace(/\D/g, "");
    if (!(digits.length === 10 || (digits.length === 11 && digits.startsWith("1")))) {
      setError("Enter a 10-digit US mobile number.");
      return;
    }
    if (!smsConsent) {
      setError("Check the box to agree to texts.");
      return;
    }
    if (isSubscribed) saveAlerts();
    else go("plan");
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
      setError("Couldn’t open checkout. Try again.");
      setSaving(false);
    }
  }

  async function saveAlerts({ emailOnly = false } = {}) {
    setError("");
    const digits = emailOnly ? "" : phone.replace(/\D/g, "");
    const wantsSms = digits.length > 0;
    const wantsEmail = emailOnly || emailOn;
    if (wantsSms && !(digits.length === 10 || (digits.length === 11 && digits.startsWith("1")))) {
      setError("Enter a 10-digit US mobile number.");
      return;
    }
    if (wantsSms && !smsConsent) {
      setError("Check the box to agree to texts, or clear the number to get email only.");
      return;
    }
    if (!wantsSms && !wantsEmail) {
      setError("Add your number or turn on email so we can reach you.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: wantsEmail,
          ...prefs,
          smsEnabled: wantsSms,
          smsConsent: wantsSms && smsConsent,
          phoneNumber: wantsSms ? digits : "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "save failed");
      capture("start_alerts_saved", { sms: wantsSms, email: wantsEmail, matches: matched?.length ?? null });
      setStep("done");
    } catch {
      setError("Couldn’t save your alerts. Try again.");
      if (emailOnly) setStep("phone");
    } finally {
      setSaving(false);
    }
  }

  const progress = questionIndex < QUESTION_COUNT && (
    <div className="st-progress">
      <div className="st-progress-bar"><span style={{ width: `${((questionIndex + 1) / QUESTION_COUNT) * 100}%` }} /></div>
      <div className="st-progress-row">
        {questionIndex > 0 ? <button className="st-back" onClick={back}>&larr; Back</button> : <span />}
        <span className="st-progress-count">{questionIndex + 1} of {QUESTION_COUNT}</span>
      </div>
    </div>
  );

  let body;
  if (step === "type") {
    body = (
      <>
        <p className="st-kicker">{jobs?.length ? `${jobs.length} open roles at ${BANK_COUNT} banks right now` : `Every analyst and internship role at ${BANK_COUNT} banks`}</p>
        <h1 className="st-q">What are you recruiting for?</h1>
        <div className="st-options">
          {JOB_TYPES.map((t) => (
            <button key={t.key} className="st-option" aria-pressed={answers.jobType === t.key}
              onClick={() => { set({ jobType: t.key }); go("area"); }}>
              <span className="st-option-label">{t.label}</span>
              <span className="st-option-sub">{t.sub}</span>
            </button>
          ))}
        </div>
      </>
    );
  } else if (step === "area") {
    body = (
      <>
        <h1 className="st-q">Which areas interest you?</h1>
        <p className="st-hint">Pick as many as you like.</p>
        <div className="st-options st-options-grid">
          {AREAS.map((a) => (
            <button key={a.key} className="st-option st-option-compact" aria-pressed={answers.areas.includes(a.key)}
              onClick={() => toggle("areas", a.key)}>
              <span className="st-option-label">{a.label}</span>
            </button>
          ))}
          <button className="st-option st-option-compact st-option-wide" aria-pressed={answers.areas.length === 0}
            onClick={() => set({ areas: [] })}>
            <span className="st-option-label">Open to anything</span>
          </button>
        </div>
        <button className="st-next" onClick={() => go("banks")}>Continue</button>
      </>
    );
  } else if (step === "banks") {
    body = (
      <>
        <h1 className="st-q">Which banks?</h1>
        <p className="st-hint">Most people track all of them. Postings go fast.</p>
        <div className="st-options">
          <button className="st-option" aria-pressed={answers.banks.length === 0} onClick={() => set({ banks: [] })}>
            <span className="st-option-label">All {BANK_COUNT} banks</span>
            <span className="st-option-sub">Recommended</span>
          </button>
        </div>
        <p className="st-or">or pick specific banks</p>
        <div className="st-chips">
          {Object.entries(BANKS).map(([key, b]) => (
            <button key={key} className="st-chip" aria-pressed={answers.banks.includes(key)} onClick={() => toggle("banks", key)}>
              <BankLogo bankKey={key} size={16} />{b.shortName}
            </button>
          ))}
        </div>
        <button className="st-next" onClick={() => go("city")}>Continue</button>
      </>
    );
  } else if (step === "city") {
    body = (
      <>
        <h1 className="st-q">Where do you want to work?</h1>
        <div className="st-options st-options-grid">
          {CITIES.map((c) => (
            <button key={c} className="st-option st-option-compact" aria-pressed={answers.city === c}
              onClick={() => set({ city: c })}>
              <span className="st-option-label">{c}</span>
            </button>
          ))}
          <button className="st-option st-option-compact" aria-pressed={answers.city === ""}
            onClick={() => set({ city: "" })}>
            <span className="st-option-label">Anywhere</span>
          </button>
        </div>
        {answers.city !== null && <button className="st-next" onClick={() => go("results")}>Continue</button>}
      </>
    );
  } else if (step === "results") {
    const channelOption = (c) => {
      const option = (
        <button key={c.key} className="st-option" aria-pressed={answers.channel === c.key}
          disabled={!isLoaded || saving} onClick={() => chooseChannel(c.key)}>
          <span className="st-option-label">{c.label}</span>
          <span className="st-option-sub">{c.sub}</span>
        </button>
      );
      return isSignedIn || c.key !== "email" ? option : (
        <SignUpButton key={c.key} mode="modal" forceRedirectUrl="/start" signInForceRedirectUrl="/start">{option}</SignUpButton>
      );
    };
    body = (
      <>
        <h1 className="st-q">How would you like to be alerted?</h1>
        <p className="st-hint">We check every 5 minutes and tell you the moment new {describe(answers)} post.</p>
        <div className="st-options">
          {CHANNELS.map(channelOption)}
        </div>
        {saving && <p className="st-fine">Saving your alerts&hellip;</p>}
        {error && <p className="st-error" role="alert">{error}</p>}
        <Link href="/jobs" className="st-skip" onClick={() => capture("start_browse_clicked")}>No thanks, just browse &rarr;</Link>
      </>
    );
  } else if (step === "phone") {
    body = (
      <>
        <h1 className="st-q">Where should we text you?</h1>
        <p className="st-hint">You&rsquo;ll get a text when new {describe(answers)} post.</p>
        <label className="st-field-label" htmlFor="st-phone">Mobile number</label>
        <input id="st-phone" className="st-input" type="tel" autoComplete="tel" placeholder="(555) 000-0000"
          value={phone} onChange={(e) => { setPhone(e.target.value); setError(""); }} />
        <label className="st-consent">
          <input type="checkbox" checked={smsConsent} onChange={(e) => { setSmsConsent(e.target.checked); setError(""); }} />
          <span>
            I agree to receive recurring automated text messages from Pete&rsquo;s Postings about new job postings matching my preferences. Message frequency varies based on new job postings matching your preferences, up to a few times per day. Message and data rates may apply. Reply <strong>STOP</strong> to cancel, <strong>HELP</strong> for help. Consent is not required to use Pete&rsquo;s Postings. See our{" "}
            <Link href="/privacy" className="text-link" target="_blank">Privacy Policy</Link> and{" "}
            <Link href="/terms" className="text-link" target="_blank">Terms of Service</Link>.
          </span>
        </label>
        <label className="st-email">
          <input type="checkbox" checked={emailOn} onChange={(e) => { setEmailOn(e.target.checked); setError(""); }} />
          <span>Also email me{user?.primaryEmailAddress?.emailAddress ? ` at ${user.primaryEmailAddress.emailAddress}` : ""}</span>
        </label>
        {error && <p className="st-error" role="alert">{error}</p>}
        <button className="st-cta" onClick={confirmPhone} disabled={saving}>{saving ? "Saving…" : "Continue"}</button>
      </>
    );
  } else if (step === "plan") {
    const emailOnly = answers.channel === "email";
    const payButton = <button className="st-cta" disabled={saving || !isLoaded} onClick={isSignedIn ? startCheckout : () => setPendingCheckout(true)}>{saving ? "Opening checkout…" : `Start my ${PLANS.monthly.trialDays}-day free trial`}</button>;
    body = (
      <>
        <h1 className="st-q">You&rsquo;re on your way to landing more interviews.</h1>
        <p className="st-hint">
          Try it free for {PLANS.monthly.trialDays} days. {emailOnly ? `We’ll email you every time new ${describe(answers)} post.` : `We’ll text ${formatPhone(phone)} every time new ${describe(answers)} post.`}
        </p>
        <ul className="st-plan-list">
          <li>Unlimited {emailOnly ? "email" : "text"} alerts, nights and weekends included</li>
          <li>Every role posted in the last 48 hours</li>
          <li>$0 today, then ${PLANS.monthly.price}/month. Cancel anytime.</li>
        </ul>
        {error && <p className="st-error" role="alert">{error}</p>}
        {isSignedIn ? payButton : (
          <SignUpButton mode="modal" forceRedirectUrl="/start" signInForceRedirectUrl="/start">{payButton}</SignUpButton>
        )}
        <p className="st-fine">Pay with Apple Pay or card &middot; Secure checkout by Stripe</p>
        <button className="st-skip st-skip-button" onClick={() => go(emailOnly ? "results" : "phone")}>&larr; {emailOnly ? "Back" : "Change number"}</button>
      </>
    );
  } else {
    const texting = phone.replace(/\D/g, "").length > 0;
    body = (
      <>
        <div className="st-done-mark" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h1 className="st-q">You&rsquo;re set.</h1>
        <p className="st-hint">
          {texting ? "We’ll text you" : "We’ll email you"} the moment new {describe(answers)} post.
          {texting && " Check your phone for a welcome text."}
        </p>
        <Link href="/jobs" className="st-cta" onClick={() => { try { localStorage.removeItem(STORAGE_KEY); } catch {} }}>
          {matched?.length ? `Browse the ${matched.length} open now` : "Browse open jobs"}
        </Link>
        {!texting && <button className="st-skip st-skip-button" onClick={() => { setEmailOn(true); setStep("phone"); }}>Get texts too. They&rsquo;re faster &rarr;</button>}
        <Link href="/notifications" className="st-skip">Change alert settings</Link>
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
        {isLoaded && !isSignedIn && step !== "results" && (
          <SignInButton mode="modal" forceRedirectUrl="/notifications">
            <button className="st-signin">Sign in</button>
          </SignInButton>
        )}
      </header>
      <main className="st-main">
        {progress}
        {restored ? body : null}
      </main>
    </div>
  );
}
