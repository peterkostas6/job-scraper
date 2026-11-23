"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { capture } from "@/lib/analytics";
import { useUser, useClerk, SignInButton } from "@clerk/nextjs";
import { BANKS } from "@/lib/banks";
import BankLogo from "@/lib/bank-logo";
import { decodeEntities } from "@/lib/text";
import { AREAS, CITIES } from "@/lib/alert-options";
import { LEVELS, DEFAULT_ALERT_LEVELS, LEVEL_KEYS } from "@/lib/levels";
import { useTrackSignup } from "@/lib/use-track-signup";
import { track } from "@/lib/track";
import { PLANS } from "@/lib/plans";
import { FIRM_LABEL } from "@/lib/firms";

const STORAGE_KEY = "pp-start-v3";

// One scrolling page: the promise and sample texts, then the button scrolls into four short
// steps (banks, roles, location, where to reach you). Step 4's Save preferences turns the
// alerts on (signed-out visitors make a free account first) and they land on Alerts; saving
// with a phone number sends the welcome text.
const STEP_LABELS = ["What banks?", "What roles?", "What location?", "Where should we alert you?"];
const STEP_NAMES = ["Banks", "Roles", "Location", "Alerts go to"];
// Every step starts ready, so Next works right away: all banks, internships and entry-level
// roles, any area, anywhere. Picking something changes it.
const EMPTY = { banks: [], areas: [], levels: DEFAULT_ALERT_LEVELS, city: "" };

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
    levels: a.levels?.length ? a.levels : DEFAULT_ALERT_LEVELS,
    jobType: "all",
    categories: (a.areas || []).flatMap((k) => AREAS.find((x) => x.key === k)?.categories || []),
    banks: a.banks || [],
    location: a.city || "",
  };
}
// "Investment Banking internships at all banks in New York"
function describe(a) {
  const areas = a.areas || [];
  const area = areas.length === 0 ? "" : areas.map((k) => AREAS.find((x) => x.key === k)?.label).join(" or ") + " ";
  const lv = a.levels?.length ? a.levels : DEFAULT_ALERT_LEVELS;
  const type = lv.length === 1 && lv[0] === "intern" ? "internships" : lv.length === LEVEL_KEYS.length ? "roles" : `${lv.map((k) => LEVELS.find((l) => l.key === k)?.label.toLowerCase()).join(" and ")} roles`;
  const banks = !a.banks?.length ? `all ${FIRM_LABEL} firms` : a.banks.length === 1 ? BANKS[a.banks[0]].name : `${a.banks.length} banks`;
  return `${area}${type} at ${banks}${a.city ? ` in ${a.city}` : ""}`;
}

const SMS_ICON = <svg width="16" height="16" viewBox="0 0 64 64" fill="#fff" aria-hidden="true"><path d="M32 9C17.6 9 6 18.4 6 30c0 6.1 3.3 11.7 8.6 15.6-.5 3.7-2 7.2-4.5 10.1-.3.4 0 1 .5 1 5.5-.5 10.6-2.4 14.6-5.4C27.4 51.7 29.7 52 32 52c14.4 0 26-9.4 26-21S46.4 9 32 9z"/></svg>;

// embedded: rendered inside the Alerts tab under its own hero, so no header or hero here;
// the Alerts tab's button bumps openSignal and the preferences slide open on the same page.
export default function StartFlow({ embedded = false, openSignal = 0, setup = false }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const clerk = useClerk();
  const isSubscribed = user?.publicMetadata?.subscribed === true;
  useTrackSignup(user);

  const [answers, setAnswers] = useState(EMPTY);
  const [reached, setReached] = useState(0); // 0 = only the hero; 1..4 = steps unlocked; 5 = checkout shown
  const [active, setActive] = useState(1); // the step that is open right now
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
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
        if (saved.answers) setAnswers(Object.fromEntries(Object.entries(EMPTY).map(([k, v]) => [k, saved.answers[k] ?? v])));
        if (Number.isInteger(saved.reached)) { setReached(Math.min(saved.reached, 4)); setActive(Math.min(Math.max(saved.reached, 1), 4)); }
        if (saved.email) setEmail(saved.email);
        if (saved.phone) setPhone(saved.phone);
        if (saved.smsConsent) setSmsConsent(true);
      }
    } catch {}
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, reached, email, phone, smsConsent })); } catch {}
  }, [restored, answers, reached, email, phone, smsConsent]);

  // /start?setup=1 skips the hero and opens the preferences (the Alerts tab now embeds them instead).
  useEffect(() => {
    if (!restored) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("setup") !== "1") return;
    url.searchParams.delete("setup");
    window.history.replaceState(null, "", url.pathname + url.search);
    capture("start_step_viewed", { step: 1 });
    setActive(1);
    setReached((r) => Math.max(r, 1));
    window.scrollTo(0, 0);
  }, [restored]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (embedded && restored && openSignal > 0) reveal(1);
  }, [openSignal, restored]); // eslint-disable-line react-hooks/exhaustive-deps

  // Signed in: their account email is the one we use.
  useEffect(() => { if (isSignedIn && user?.primaryEmailAddress?.emailAddress) setEmail(user.primaryEmailAddress.emailAddress); }, [isSignedIn, user]);

  // Back from the sign-up the last step asked for (/start?finish=1): turn the alerts on.
  useEffect(() => {
    if (!restored || !isLoaded || !isSignedIn) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("finish") !== "1") return;
    window.history.replaceState(null, "", "/start");
    turnOnTexts();
  }, [restored, isLoaded, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (el.classList.contains("sf-checkout")) {
      // The checkout is the last stop: wait for the steps above to fold, scroll it to the top,
      // then nudge once more in case anything above moved while scrolling.
      const go = (behavior) => {
        const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - margin, behavior });
      };
      const t1 = setTimeout(() => go(reduce ? "auto" : "smooth"), 120);
      const t2 = setTimeout(() => {
        const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        if (Math.abs(el.getBoundingClientRect().top - margin) > 12) go("smooth");
      }, 1100);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
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
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    // Unpicking the last one goes back to "all".
    return { ...a, [field]: next };
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
    // Either one is enough: a phone number means texts, an email means emails, both means both.
    const hasPhone = phone.trim() !== "", hasEmail = email.trim() !== "";
    if (!hasPhone && !hasEmail) { setContactError("Enter a phone number or an email."); return; }
    if (hasEmail && !validEmail(email)) { setContactError("That email doesn\u2019t look right."); return; }
    if (hasPhone && !validPhone(phone)) { setContactError("Enter a 10-digit US mobile number."); return; }
    if (hasPhone && !smsConsent) { setContactError("Check the box to agree to texts."); return; }
    capture("start_contact_entered", { signedIn: Boolean(isSignedIn) });
    startFree();
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
        // Signed out: straight to Stripe with the picks; the account is made after payment.
        body: JSON.stringify(isSignedIn ? { plan: "monthly", returnTo: "/start" } : {
          plan: "monthly", returnTo: "/start", next: "/notifications?welcome=1",
          prefs: toPrefs(answers), phone: phone.replace(/\D/g, ""), smsConsent: validPhone(phone) && smsConsent,
          wantsEmail: validEmail(email), email: validEmail(email) ? email.trim() : "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.alreadyPro) {
        if (isSignedIn) { await turnOnTexts(); return; } // their account is Pro: just save the alerts
        setError("That email already has Pro. Sign in to finish setting up your alerts.");
        setSaving(false);
        return;
      }
      if (!data.url) throw new Error(data.error || "checkout failed");
      window.location.href = data.url;
    } catch {
      setError("Couldn’t open checkout. Try again.");
      setSaving(false);
    }
  }

  // A visitor who clicked a job to get here gets it offered when they land (see openjob in the main page).
  const pendingJob = () => { try { return Boolean(sessionStorage.getItem("pp_open_job")); } catch { return false; } };

  // "Don't alert me": no alerts, straight on to the jobs (and the one they clicked, if any).
  // Preferences are still saved (alerts off), so Browse can filter to "My preferences".
  async function skipAlerts() {
    capture("start_alerts_skipped", { signedIn: Boolean(isSignedIn) });
    if (isSignedIn) {
      setSaving(true);
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false, ...toPrefs(answers), smsEnabled: false, smsConsent: false, phoneNumber: "" }),
      }).catch(() => {});
    }
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    window.location.href = pendingJob() ? "/jobs?openjob=1" : "/jobs";
  }

  // Last step: signed in turns the alerts on now; signed out makes a free account first.
  function startFree() {
    if (isSignedIn) { turnOnTexts(); return; }
    capture("start_signup_opened");
    clerk.openSignUp({ forceRedirectUrl: "/start?finish=1", signInForceRedirectUrl: "/start?finish=1" });
  }

  async function turnOnTexts() {
    setError("");
    const wantsSms = validPhone(phone) && smsConsent;
    const wantsEmail = validEmail(email);
    if (!wantsSms && !wantsEmail) { setReached((r) => Math.max(r, 4)); setActive(4); scrollTarget.current = 4; return; }
    setSaving(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: wantsEmail, ...toPrefs(answers), smsEnabled: wantsSms, smsConsent: wantsSms, phoneNumber: wantsSms ? phone.replace(/\D/g, "") : "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "save failed");
      capture("start_alerts_saved", { sms: wantsSms, email: wantsEmail });
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      window.location.href = pendingJob() ? "/jobs?welcome=1&openjob=1" : "/jobs?welcome=1";
    } catch {
      setError("Couldn’t turn on your texts. Try again.");
      setSaving(false);
    }
  }

  // One-line answers for the steps that are done.
  const summaries = [
    !answers.banks ? "" : answers.banks.length === 0 ? `All ${FIRM_LABEL} firms` : answers.banks.map((k) => BANKS[k]?.shortName).join(", "),
    !answers.areas ? "" : `${(answers.levels || []).map((k) => LEVELS.find((l) => l.key === k)?.label).join(", ") || "No level"} \u00b7 ${answers.areas.length === 0 ? "Open to anything" : answers.areas.map((k) => AREAS.find((x) => x.key === k)?.label).join(", ")}`,
    answers.city === null ? "" : answers.city || "Anywhere",
    reached >= 5 ? [formatPhone(phone), email.trim()].filter(Boolean).join(" \u00b7 ") : "",
  ];


  return (
    <div className={`st sf${reached >= 1 ? " sf-started" : ""}${embedded ? " sf-embed" : ""}`}>
      {!embedded && <header className="st-header">
        <Link href="/" className="logo logo-link" aria-label="Pete's Postings home">
          <img src="/logo-mark.svg" alt="" className="logo-icon" width="24" height="24" />
          <span className="logo-text">Pete&rsquo;s Postings</span>
        </Link>
        {isLoaded && !isSignedIn && (
          <SignInButton mode="modal" forceRedirectUrl="/jobs?alerts=1">
            <button className="st-signin">Sign in</button>
          </SignInButton>
        )}
      </header>}

      <main className="sf-main">
        {/* HERO: the promise, what it looks like, and one button */}
        {!embedded && !setup && <section className="sf-hero">
          <h1 className="st-q sf-title">Be first to apply. Not last to find out.</h1>
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
              Set up text alerts
            </button>
            <Link href="/jobs" className="st-skip" onClick={() => capture("start_browse_clicked")}>Just browse jobs &rarr;</Link>
          </div>
        </section>}

        {restored && reached >= 1 && (
          <section className="sf-prefs" ref={(el) => (sections.current[1] = el)}>
            <h2 className="sf-prefs-title">Let&rsquo;s set up your preferences</h2>
            <ol className="sf-track">
              {[1, 2, 3, 4].map((n) => {
                const open = active === n;
                const locked = n > reached;
                const done = summaries[n - 1] && !open && !locked;
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
                {/* Scrolls inside its own box so the Next button below is always on screen. */}
                <div className="sf-pills sf-pills-scroll">
                  <button className="sf-pill sf-pill-strong" aria-pressed={answers.banks !== null && answers.banks.length === 0} onClick={() => set({ banks: [] })}>All {FIRM_LABEL} firms</button>
                  {Object.entries(BANKS).map(([key, b]) => (
                    <button key={key} className="sf-pill" aria-pressed={(answers.banks || []).includes(key)} onClick={() => toggle("banks", key)}>
                      <BankLogo bankKey={key} size={16} />{b.shortName}
                    </button>
                  ))}
                </div>
                <button className="sf-next" disabled={answers.banks === null} onClick={() => reveal(2)}>Next</button>
                            </>
                          )}
                          {n === 2 && (
                            <>
                <div className="sf-pills sf-levels" role="group" aria-label="Experience level">
                  {LEVELS.map((l) => (
                    <button key={l.key} className="sf-pill" aria-pressed={(answers.levels || []).includes(l.key)} onClick={() => toggle("levels", l.key)}>{l.label}</button>
                  ))}
                </div>
                <div className="sf-pills">
                  {AREAS.map((a) => (
                    <button key={a.key} className="sf-pill" aria-pressed={(answers.areas || []).includes(a.key)} onClick={() => toggle("areas", a.key)}>{a.label}</button>
                  ))}
                  <button className="sf-pill sf-pill-strong" aria-pressed={answers.areas !== null && answers.areas.length === 0} onClick={() => set({ areas: [] })}>Open to anything</button>
                </div>
                <button className="sf-next" disabled={!answers.levels?.length || answers.areas === null} onClick={() => reveal(3)}>Next</button>
                {(!answers.levels?.length || answers.areas === null) && <p className="sf-need">{!answers.levels?.length && answers.areas === null ? "Pick at least one level, and an area." : !answers.levels?.length ? "Pick at least one level." : "Pick an area, or Open to anything."}</p>}
                            </>
                          )}
                          {n === 3 && (
                            <>
                <div className="sf-pills">
                  {CITIES.map((c) => (
                    <button key={c} className="sf-pill" aria-pressed={answers.city === c} onClick={() => set({ city: c })}>{c}</button>
                  ))}
                  <button className="sf-pill sf-pill-strong" aria-pressed={answers.city === ""} onClick={() => set({ city: "" })}>Anywhere</button>
                </div>
                <button className="sf-next" disabled={answers.city === null} onClick={() => reveal(4)}>Next</button>
                            </>
                          )}
                          {n === 4 && (
                            <>
                <form className="sf-form" onSubmit={(e) => { e.preventDefault(); confirmContact(); }} noValidate>
                  <p className="sf-need sf-need-top">Texts, email, or both. Fill in either one.</p>
                  <div className="sf-fields">
                    <div className="sf-field">
                      <label className="st-field-label" htmlFor="sf-email">Email</label>
                      <input id="sf-email" className="st-input" type="email" autoComplete="email" placeholder="you@school.edu"
                        value={email} onChange={(e) => { setEmail(e.target.value); setContactError(""); }} />
                    </div>
                    <div className="sf-field">
                      <label className="st-field-label" htmlFor="sf-phone">Mobile number</label>
                      <input id="sf-phone" className="st-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="(555) 000-0000"
                        value={phone} onChange={(e) => { setPhone(e.target.value); setContactError(""); }} onBlur={() => setPhone(formatPhone(phone))} />
                    </div>
                  </div>
                  {phone.trim() !== "" && (
                    <label className="st-consent">
                      <input type="checkbox" checked={smsConsent} onChange={(e) => { setSmsConsent(e.target.checked); setContactError(""); }} />
                      <span>
                        I agree to receive recurring automated text messages from Pete&rsquo;s Postings about new job postings matching my preferences. Message frequency varies based on new job postings matching your preferences, up to a few times per day. Message and data rates may apply. Reply <strong>STOP</strong> to cancel, <strong>HELP</strong> for help. Consent is not required to use Pete&rsquo;s Postings. See our{" "}
                        <Link href="/privacy" className="text-link" target="_blank">Privacy Policy</Link> and{" "}
                        <Link href="/terms" className="text-link" target="_blank">Terms of Service</Link>.
                      </span>
                    </label>
                  )}
                  {(contactError || error) && <p className="st-error" role="alert">{contactError || error}</p>}
                  <div className="sf-form-actions">
                    <button className="sf-next" type="submit" disabled={saving || !isLoaded}>{saving ? "Saving\u2026" : "Save preferences"}</button>
                    <button className="sf-skip" type="button" onClick={skipAlerts}>Don&rsquo;t alert me</button>
                  </div>
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

      </main>
    </div>
  );
}
