"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { capture } from "@/lib/analytics";
import { useUser, SignUpButton, SignInButton } from "@clerk/nextjs";
import { BANKS } from "@/lib/banks";
import BankLogo from "@/lib/bank-logo";
import { decodeEntities } from "@/lib/text";
import { JOB_TYPES, AREAS, CITIES } from "@/lib/alert-options";
import { useTrackSignup } from "@/lib/use-track-signup";
import { track } from "@/lib/track";
import { PLANS } from "@/lib/plans";

const BANK_COUNT = Object.keys(BANKS).length;
const STORAGE_KEY = "pp-start-v3";

// One scrolling page: the promise and sample texts, then the button scrolls into four short
// steps (banks, roles, location, where to reach you) that slide in one after another, then
// the checkout button. After Stripe, texts turn on with these answers and they land on Alerts.
const STEP_LABELS = ["What banks?", "What roles?", "What location?", "Where should we alert you?"];
const STEP_NAMES = ["Banks", "Roles", "Location", "Alerts go to"];
const EMPTY = { banks: null, areas: null, jobType: "all", city: null };

// "2125550123" -> "(212) 555-0123"; anything else is shown as typed.
const formatPhone = (raw) => {
  const d = raw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw;
};
const validPhone = (raw) => { const d = raw.replace(/\D/g, ""); return d.length === 10 || (d.length === 11 && d.startsWith("1")); };
const validEmail = (raw) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
const postedAt = (j) => Date.parse(j.postedDate) || j.detectedAt || 0;

// The alert settings these answers become; the same shape the notify cron matches on.
function toPrefs(a) {
  return {
    jobType: a.jobType || "all",
    categories: (a.areas || []).flatMap((k) => AREAS.find((x) => x.key === k)?.categories || []),
    banks: a.banks || [],
    location: a.city || "",
  };
}
// "Investment Banking internships at all 20 banks in New York"
function describe(a) {
  const areas = a.areas || [];
  const area = areas.length === 0 ? "" : areas.map((k) => AREAS.find((x) => x.key === k)?.label).join(" or ") + " ";
  const type = a.jobType === "internship" ? "internships" : a.jobType === "fulltime" ? "analyst roles" : "roles";
  const banks = !a.banks?.length ? `all ${BANK_COUNT} banks` : a.banks.length === 1 ? BANKS[a.banks[0]].name : `${a.banks.length} banks`;
  return `${area}${type} at ${banks}${a.city ? ` in ${a.city}` : ""}`;
}

const SMS_ICON = <svg width="16" height="16" viewBox="0 0 64 64" fill="#fff" aria-hidden="true"><path d="M32 9C17.6 9 6 18.4 6 30c0 6.1 3.3 11.7 8.6 15.6-.5 3.7-2 7.2-4.5 10.1-.3.4 0 1 .5 1 5.5-.5 10.6-2.4 14.6-5.4C27.4 51.7 29.7 52 32 52c14.4 0 26-9.4 26-21S46.4 9 32 9z"/></svg>;

export default function StartFlow() {
  const { isLoaded, isSignedIn, user } = useUser();
  const isSubscribed = user?.publicMetadata?.subscribed === true;
  useTrackSignup(user);

  const [answers, setAnswers] = useState(EMPTY);
  const [reached, setReached] = useState(0); // 0 = only the hero; 1..4 = steps unlocked; 5 = checkout shown
  const [active, setActive] = useState(1); // the step that is open right now
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [restored, setRestored] = useState(false);
  const [jobs, setJobs] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [contactError, setContactError] = useState("");
  const sections = useRef([]);
  const scrollTarget = useRef(null);

  // Answers survive the sign-up modal, the Stripe round trip and a refresh.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved) {
        if (saved.answers) setAnswers({ ...EMPTY, ...saved.answers });
        if (Number.isInteger(saved.reached)) { setReached(saved.reached); setActive(Math.min(Math.max(saved.reached, 1), 4)); }
        if (saved.email) setEmail(saved.email);
        if (saved.phone) setPhone(saved.phone);
        if (saved.smsConsent) setSmsConsent(true);
        setPendingCheckout(Boolean(saved.pendingCheckout));
      }
    } catch {}
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, reached, email, phone, smsConsent, pendingCheckout })); } catch {}
  }, [restored, answers, reached, email, phone, smsConsent, pendingCheckout]);

  // Signed in: their account email is the one we use.
  useEffect(() => { if (isSignedIn && user?.primaryEmailAddress?.emailAddress) setEmail(user.primaryEmailAddress.emailAddress); }, [isSignedIn, user]);

  // Back from the sign-up modal at checkout: carry straight on to Stripe.
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

  // Slide each newly revealed step into view.
  useEffect(() => {
    if (scrollTarget.current == null) return;
    const el = sections.current[scrollTarget.current];
    scrollTarget.current = null;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
  }, [reached, active]);

  function reveal(n) {
    capture("start_step_viewed", { step: n });
    if (n <= 4) setActive(n);
    else setActive(0);
    scrollTarget.current = n <= 4 ? Math.max(1, n) : 5;
    setReached((r) => Math.max(r, n));
    // Already unlocked: no state change to trigger the scroll effect, so scroll now.
    if (n <= reached) requestAnimationFrame(() => sections.current[scrollTarget.current]?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  const set = (patch) => setAnswers((a) => ({ ...a, ...patch }));
  const toggle = (field, key) => setAnswers((a) => {
    const cur = a[field] || [];
    return { ...a, [field]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] };
  });

  // Three real, recent roles for the sample texts.
  const samples = useMemo(() => {
    if (!jobs) return [];
    const seen = new Set();
    return [...jobs]
      .filter((j) => ["Investment Banking", "Sales & Trading", "Research", "Corporate Banking"].includes(j.category) && j.title.length < 64 && !seen.has(j.title) && seen.add(j.title))
      .sort((a, b) => postedAt(b) - postedAt(a))
      .slice(0, 3);
  }, [jobs]);

  function confirmContact() {
    setContactError("");
    if (!isSignedIn && !validEmail(email)) { setContactError("Enter your email address."); return; }
    if (!validPhone(phone)) { setContactError("Enter a 10-digit US mobile number."); return; }
    if (!smsConsent) { setContactError("Check the box to agree to texts."); return; }
    capture("start_contact_entered", { signedIn: Boolean(isSignedIn) });
    reveal(5);
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

  async function turnOnTexts() {
    setError("");
    if (!validPhone(phone) || !smsConsent) { setReached((r) => Math.max(r, 4)); scrollTarget.current = 4; return; }
    setSaving(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, ...toPrefs(answers), smsEnabled: true, smsConsent: true, phoneNumber: phone.replace(/\D/g, "") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "save failed");
      capture("start_alerts_saved", { sms: true, email: true });
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      window.location.href = "/notifications?welcome=1";
    } catch {
      setError("Couldn’t turn on your texts. Try again.");
      setSaving(false);
    }
  }

  // One-line answers for the steps that are done.
  const summaries = [
    !answers.banks ? "" : answers.banks.length === 0 ? `All ${BANK_COUNT} banks` : answers.banks.map((k) => BANKS[k]?.shortName).join(", "),
    !answers.areas ? "" : `${answers.jobType === "internship" ? "Internships" : answers.jobType === "fulltime" ? "Full-time" : "Internships and full-time"} \u00b7 ${answers.areas.length === 0 ? "Open to anything" : answers.areas.map((k) => AREAS.find((x) => x.key === k)?.label).join(", ")}`,
    answers.city === null ? "" : answers.city || "Anywhere",
    reached >= 5 ? [formatPhone(phone), email.trim()].filter(Boolean).join(" \u00b7 ") : "",
  ];

  const payButton = (
    <button className="st-cta" disabled={saving || !isLoaded} onClick={isSignedIn ? startCheckout : () => setPendingCheckout(true)}>
      {saving ? "Opening checkout…" : isSubscribed ? "Turn on my texts" : `Start my ${PLANS.monthly.trialDays}-day free trial`}
    </button>
  );

  return (
    <div className="st sf">
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

      <main className="sf-main">
        {/* HERO: the promise, what it looks like, and one button */}
        <section className="sf-hero">
          <h1 className="st-q sf-title">Your resume will be first in the pile.</h1>
          <div className="sf-texts" aria-label="Example text alerts" role="img">
            <span className="sf-texts-label">What lands on your phone</span>
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
          <div className="sf-go">
            <svg className="sf-arrow" viewBox="0 0 120 90" aria-hidden="true">
              <path d="M110 6 C 112 46, 78 70, 22 72" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="1 9" />
              <path d="M34 60 L 18 72 L 34 84" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <button className="st-cta sf-cta" onClick={() => { capture("start_pitch_continue"); reveal(1); }}>
              Set up texts so you can apply first
            </button>
            <Link href="/jobs" className="st-skip" onClick={() => capture("start_browse_clicked")}>Just browse jobs &rarr;</Link>
          </div>
        </section>

        {restored && reached >= 1 && (
          <section className="sf-prefs" ref={(el) => (sections.current[1] = el)}>
            <h2 className="sf-prefs-title">Let&rsquo;s set up your preferences</h2>
            <ol className="sf-track">
              {[1, 2, 3, 4].map((n) => {
                const open = active === n;
                const done = summaries[n - 1] && !open;
                const locked = n > reached;
                return (
                  <li key={n} ref={(el) => { if (n > 1) sections.current[n] = el; }} className={`sf-row${open ? " is-open" : ""}${done ? " is-done" : ""}${locked ? " is-locked" : ""}`}>
                    <span className="sf-dot" aria-hidden="true">
                      {done ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg> : n}
                    </span>
                    <div className="sf-row-body">
                      <div className="sf-row-head">
                        <h3 className="sf-row-title">{open ? STEP_LABELS[n - 1] : STEP_NAMES[n - 1]}</h3>
                        {done && <span className="sf-row-answer">{summaries[n - 1]}</span>}
                        {done && <button className="sf-change" onClick={() => reveal(n)}>Change</button>}
                      </div>
                      {open && (
                        <div className="sf-row-content">
                          {n === 1 && (
                            <>
                <div className="sf-pills">
                  <button className="sf-pill sf-pill-strong" aria-pressed={answers.banks !== null && answers.banks.length === 0} onClick={() => { set({ banks: [] }); reveal(2); }}>All {BANK_COUNT} banks</button>
                  {Object.entries(BANKS).map(([key, b]) => (
                    <button key={key} className="sf-pill" aria-pressed={(answers.banks || []).includes(key)} onClick={() => toggle("banks", key)}>
                      <BankLogo bankKey={key} size={16} />{b.shortName}
                    </button>
                  ))}
                </div>
                {answers.banks?.length > 0 && <button className="sf-next" onClick={() => reveal(2)}>Next</button>}
                            </>
                          )}
                          {n === 2 && (
                            <>
                <div className="sf-seg" role="group" aria-label="Internship or full-time">
                  {JOB_TYPES.map((t) => (
                    <button key={t.key} aria-pressed={answers.jobType === t.key} onClick={() => set({ jobType: t.key })}>{t.key === "all" ? "Both" : t.label}</button>
                  ))}
                </div>
                <div className="sf-pills">
                  {AREAS.map((a) => (
                    <button key={a.key} className="sf-pill" aria-pressed={(answers.areas || []).includes(a.key)} onClick={() => toggle("areas", a.key)}>{a.label}</button>
                  ))}
                  <button className="sf-pill sf-pill-strong" aria-pressed={answers.areas !== null && answers.areas.length === 0} onClick={() => { set({ areas: [] }); reveal(3); }}>Open to anything</button>
                </div>
                {answers.areas?.length > 0 && <button className="sf-next" onClick={() => reveal(3)}>Next</button>}
                            </>
                          )}
                          {n === 3 && (
                            <>
                <div className="sf-pills">
                  {CITIES.map((c) => (
                    <button key={c} className="sf-pill" aria-pressed={answers.city === c} onClick={() => { set({ city: c }); reveal(4); }}>{c}</button>
                  ))}
                  <button className="sf-pill sf-pill-strong" aria-pressed={answers.city === ""} onClick={() => { set({ city: "" }); reveal(4); }}>Anywhere</button>
                </div>
                            </>
                          )}
                          {n === 4 && (
                            <>
                <form className="sf-form" onSubmit={(e) => { e.preventDefault(); confirmContact(); }} noValidate>
                  <div className="sf-fields">
                    <div className="sf-field">
                      <label className="st-field-label" htmlFor="sf-email">Email</label>
                      <input id="sf-email" className="st-input" type="email" autoComplete="email" placeholder="you@school.edu"
                        value={email} readOnly={Boolean(isSignedIn)} onChange={(e) => { setEmail(e.target.value); setContactError(""); }} />
                    </div>
                    <div className="sf-field">
                      <label className="st-field-label" htmlFor="sf-phone">Mobile number</label>
                      <input id="sf-phone" className="st-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="(555) 000-0000"
                        value={phone} onChange={(e) => { setPhone(e.target.value); setContactError(""); }} onBlur={() => setPhone(formatPhone(phone))} />
                    </div>
                  </div>
                  <label className="st-consent">
                    <input type="checkbox" checked={smsConsent} onChange={(e) => { setSmsConsent(e.target.checked); setContactError(""); }} />
                    <span>
                      I agree to receive recurring automated text messages from Pete&rsquo;s Postings about new job postings matching my preferences. Message frequency varies based on new job postings matching your preferences, up to a few times per day. Message and data rates may apply. Reply <strong>STOP</strong> to cancel, <strong>HELP</strong> for help. Consent is not required to use Pete&rsquo;s Postings. See our{" "}
                      <Link href="/privacy" className="text-link" target="_blank">Privacy Policy</Link> and{" "}
                      <Link href="/terms" className="text-link" target="_blank">Terms of Service</Link>.
                    </span>
                  </label>
                  {contactError && <p className="st-error" role="alert">{contactError}</p>}
                  <button className="sf-next" type="submit">Next</button>
                </form>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {restored && reached >= 5 && (
          <section className="sf-checkout" ref={(el) => (sections.current[5] = el)}>
            <h2 className="sf-prefs-title">You&rsquo;re one step from first in the pile.</h2>
            <p className="st-hint">We&rsquo;ll text {formatPhone(phone)} the moment new {describe(answers)} post.</p>
            {error && <p className="st-error" role="alert">{error}</p>}
            {isSignedIn ? payButton : (
              <SignUpButton mode="modal" forceRedirectUrl="/start" signInForceRedirectUrl="/start" initialValues={{ emailAddress: email.trim() }}>{payButton}</SignUpButton>
            )}
            {!isSubscribed && <p className="st-fine">$0 today, then ${PLANS.monthly.price}/month. Cancel anytime. Secure checkout by Stripe.</p>}
          </section>
        )}
      </main>
    </div>
  );
}
