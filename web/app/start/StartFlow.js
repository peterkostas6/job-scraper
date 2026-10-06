"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { useUser, SignUpButton, SignInButton } from "@clerk/nextjs";
import { BANKS } from "@/lib/banks";
import { decodeEntities } from "@/lib/text";
import { JOB_TYPES, AREAS, CITIES, matchesAlertPrefs } from "@/lib/alert-options";
import { useTrackSignup } from "@/lib/use-track-signup";

const BANK_COUNT = Object.keys(BANKS).length;
const STORAGE_KEY = "pp-start-v1";

const STEPS = ["type", "area", "banks", "city", "results", "phone", "done"];
const QUESTION_COUNT = 4;

const EMPTY = { jobType: null, areas: [], banks: [], city: null, channel: null };

const CHANNELS = [
  { key: "sms", label: "Text me", sub: "Fastest. Most people pick this." },
  { key: "both", label: "Text and email", sub: "A text plus the full list by email" },
  { key: "email", label: "Email me", sub: "No phone number needed" },
];

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

function ago(ms) {
  const hours = Math.floor((Date.now() - ms) / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;
}

// "Investment Banking internships at all 20 banks in New York"
function describe(a) {
  const area = a.areas.length === 0 ? "" : a.areas.map((k) => AREAS.find((x) => x.key === k)?.label).join(" or ") + " ";
  const type = a.jobType === "internship" ? "internships" : a.jobType === "fulltime" ? "analyst roles" : "roles";
  const banks = a.banks.length === 0 ? `all ${BANK_COUNT} banks` : a.banks.length === 1 ? BANKS[a.banks[0]].name : `${a.banks.length} banks`;
  return `${area}${type} at ${banks}${a.city ? ` in ${a.city}` : ""}`;
}

function capture(event, props) {
  try { posthog.capture(event, props); } catch {}
}

export default function StartFlow() {
  const { isLoaded, isSignedIn, user } = useUser();
  useTrackSignup(user);

  const [step, setStep] = useState("type");
  const [answers, setAnswers] = useState(EMPTY);
  const [pendingSignup, setPendingSignup] = useState(false);
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
      }
    } catch {}
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, step, pendingSignup })); } catch {}
  }, [restored, answers, step, pendingSignup]);

  // Back from sign-up: email-only alerts save right away; anything with texts asks for the number.
  useEffect(() => {
    if (!restored || !isLoaded || !isSignedIn || !pendingSignup) return;
    setPendingSignup(false);
    afterChannel(answers.channel);
  }, [restored, isLoaded, isSignedIn, pendingSignup]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const newThisWeek = matched ? matched.filter((j) => Date.now() - j.detectedAt < 7 * 86400000).length : 0;

  const go = (next) => setStep(next);
  const back = () => setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)]);
  const questionIndex = STEPS.indexOf(step);
  const set = (patch) => setAnswers((a) => ({ ...a, ...patch }));
  const toggle = (field, key) => setAnswers((a) => ({
    ...a,
    [field]: a[field].includes(key) ? a[field].filter((k) => k !== key) : [...a[field], key],
  }));

  function afterChannel(channel) {
    if (channel === "email") {
      saveAlerts({ emailOnly: true });
    } else {
      setEmailOn(channel === "both");
      setStep("phone");
    }
  }

  function chooseChannel(channel) {
    set({ channel });
    capture("start_channel_chosen", { channel, signedIn: Boolean(isSignedIn) });
    if (isSignedIn) afterChannel(channel);
    else setPendingSignup(true);
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
              {b.shortName}
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
              onClick={() => { set({ city: c }); go("results"); }}>
              <span className="st-option-label">{c}</span>
            </button>
          ))}
          <button className="st-option st-option-compact" aria-pressed={answers.city === ""}
            onClick={() => { set({ city: "" }); go("results"); }}>
            <span className="st-option-label">Anywhere</span>
          </button>
        </div>
      </>
    );
  } else if (step === "results") {
    const shown = matched ? matched.slice(0, 5) : [];
    const channelOption = (c) => {
      const option = (
        <button key={c.key} className="st-option" aria-pressed={answers.channel === c.key}
          disabled={!isLoaded || saving} onClick={() => chooseChannel(c.key)}>
          <span className="st-option-label">{c.label}</span>
          <span className="st-option-sub">{c.sub}</span>
        </button>
      );
      return isSignedIn ? option : (
        <SignUpButton key={c.key} mode="modal" forceRedirectUrl="/start" signInForceRedirectUrl="/start">{option}</SignUpButton>
      );
    };
    body = (
      <>
        <button className="st-back st-back-top" onClick={back}>&larr; Change answers</button>
        {matched === null ? (
          <h1 className="st-q">Finding your matches&hellip;</h1>
        ) : matched.length > 0 ? (
          <>
            <h1 className="st-result-title"><span className="tnum">{matched.length}</span> {matched.length === 1 ? "role matches" : "roles match"} you right now</h1>
            <p className="st-result-sub">
              {describe(answers)}.{newThisWeek > 0 && <> <strong>{newThisWeek} posted this week.</strong></>}
            </p>
          </>
        ) : (
          <>
            <h1 className="st-result-title">Nothing open right now</h1>
            <p className="st-result-sub">No {describe(answers)} are posted today. That&rsquo;s when alerts matter most: the next one could go up tonight.</p>
          </>
        )}

        {shown.length > 0 && (
          <div className="st-matches">
            {shown.map((j) => (
              <div className="st-match" key={j.link}>
                <div className="st-match-title">{j.title}</div>
                <div className="st-match-meta">
                  <span>{j.bank}</span>
                  {j.location && <><span aria-hidden="true">&middot;</span><span>{j.location}</span></>}
                  <span className="st-match-time">{ago(j.detectedAt)}</span>
                </div>
              </div>
            ))}
            {matched.length > shown.length && <div className="st-match-more">+ {matched.length - shown.length} more</div>}
          </div>
        )}

        <div className="st-pitch">
          <h2 className="st-pitch-title">Want to hear about the next one first?</h2>
          <p className="st-pitch-text">We check all {BANK_COUNT} bank career sites every 5 minutes. Pick how you want to hear about new roles like these.</p>
          <div className="st-options st-options-tight">
            {CHANNELS.map(channelOption)}
          </div>
          {saving && <p className="st-fine">Saving your alerts&hellip;</p>}
          {error && <p className="st-error" role="alert">{error}</p>}
          <p className="st-fine">Free account &middot; 5 free alerts &middot; No card needed</p>
        </div>
        <Link href="/jobs" className="st-skip" onClick={() => capture("start_browse_clicked")}>No thanks, just browse jobs &rarr;</Link>
      </>
    );
  } else if (step === "phone") {
    body = (
      <>
        <p className="st-kicker">Last step</p>
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
        <button className="st-cta" onClick={saveAlerts} disabled={saving}>{saving ? "Saving…" : "Turn on my alerts"}</button>
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
