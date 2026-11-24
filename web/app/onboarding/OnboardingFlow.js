"use client";

// The iPhone app's first launch, one screen at a time (Duolingo style): Pete says hi, what
// changes for you, three questions (firms, level, location), how many live roles match, then
// the hard paywall, saving the account, and turning on alerts. Answers are kept on the phone
// until there is an account to save them to, in the same shape as the website's alert settings.
import { useEffect, useMemo, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import BankLogo from "@/lib/bank-logo";
import { decodeEntities } from "@/lib/text";
import { capture } from "@/lib/analytics";
import { matchesAlertPrefs } from "@/lib/alert-options";
import { LEVELS, DEFAULT_ALERT_LEVELS } from "@/lib/levels";
import { FIRM_LABEL, ALL_FIRMS } from "@/lib/firms";
import { PLANS } from "@/lib/plans";
import { hasAppAccess, isTestHost, unlockForTesting } from "@/lib/app-access";
import FirmPicker from "@/app/FirmPicker";
import Pete from "./Pete";

const STORAGE_KEY = "pp-onboarding-v1";
const STEPS = ["welcome", "why", "firms", "level", "location", "match", "paywall", "account", "notify"];
const PROGRESS = { firms: 25, level: 50, location: 75, match: 100 };
const BACK = { why: "welcome", firms: "why", level: "firms", location: "level", match: "location" };
// Alert settings keep one location; CITY_ALIASES in lib/alert-options.js knows each of these.
const CITIES = ["New York", "Charlotte", "Dallas", "Chicago", "San Francisco", "Boston", "Los Angeles", "Washington"];
const price = PLANS.monthly.price.toFixed(2);

const toPrefs = (a) => ({ banks: a.banks, categories: [], jobType: "all", levels: a.levels, location: a.city });
const postedAt = (j) => Date.parse(j.postedDate) || j.detectedAt || 0;
const ago = (t) => {
  const m = Math.max(1, Math.round((Date.now() - t) / 60000));
  return m < 60 ? `${m}m ago` : m < 24 * 60 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};
const Check = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor" /><path d="M7 12.5l3.2 3L17 9" stroke="var(--ob-check-ink, #fff)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export default function OnboardingFlow() {
  const { isLoaded, isSignedIn, user } = useUser();
  const clerk = useClerk();
  const [step, setStep] = useState("welcome");
  const [answers, setAnswers] = useState({ banks: [], levels: DEFAULT_ALERT_LEVELS, city: "" });
  const [restored, setRestored] = useState(false);
  const [jobs, setJobs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  // Pick up where they left off (also after coming back from the sign-in box).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.answers) setAnswers(saved.answers);
      const fromUrl = new URL(window.location.href).searchParams.get("step");
      const s = STEPS.includes(fromUrl) ? fromUrl : saved?.step;
      if (STEPS.includes(s)) setStep(s);
    } catch {}
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, answers })); } catch {}
    capture("app_onboarding_step", { step });
  }, [restored, step, answers]);

  useEffect(() => {
    fetch("/api/jobs-live")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setJobs((d.jobs || []).map((j) => ({ ...j, title: decodeEntities(j.title) }))))
      .catch(() => setJobs([]));
  }, []);

  const matches = useMemo(() => {
    if (!jobs) return null;
    const prefs = toPrefs(answers);
    return jobs.filter((j) => matchesAlertPrefs(j, prefs)).sort((a, b) => postedAt(b) - postedAt(a));
  }, [jobs, answers]);

  const paid = isLoaded && hasAppAccess(user);

  // Back from the sign-in box: a paying account goes straight in; otherwise carry on.
  useEffect(() => {
    if (!restored || !isLoaded || !isSignedIn) return;
    if (step === "welcome" || step === "paywall") { if (paid) finish(); return; }
    if (step === "account") saveAndNext();
  }, [restored, isLoaded, isSignedIn, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (s) => { setNote(""); setStep(s); window.scrollTo(0, 0); };
  const set = (patch) => setAnswers((a) => ({ ...a, ...patch }));
  const toggleBank = (k) => set({ banks: answers.banks.includes(k) ? answers.banks.filter((x) => x !== k) : [...answers.banks, k] });
  const toggleLevel = (k) => set({ levels: answers.levels.includes(k) ? answers.levels.filter((x) => x !== k) : [...answers.levels, k] });

  function signIn() {
    capture("app_onboarding_signin_opened", { from: step });
    const back = `/onboarding?step=${step === "welcome" ? "welcome" : "paywall"}`;
    clerk.openSignIn({ forceRedirectUrl: back, signUpForceRedirectUrl: back });
  }

  function subscribe() {
    capture("app_subscribe_tapped");
    // TODO(app IAP): buy the Premium product through RevenueCat here.
    if (isTestHost()) { unlockForTesting(); go("account"); return; }
    setNote("Subscriptions open when the app launches on the App Store.");
  }

  async function saveAndNext() {
    if (busy) return;
    setBusy(true);
    // Alerts stay off until notifications are on; the answers still power "My preferences".
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false, ...toPrefs(answers), smsEnabled: false, smsConsent: false, phoneNumber: "" }),
    }).catch(() => {});
    setBusy(false);
    go("notify");
  }

  function createAccount() {
    if (isSignedIn) { saveAndNext(); return; }
    capture("app_onboarding_signup_opened");
    clerk.openSignUp({ forceRedirectUrl: "/onboarding?step=account", signInForceRedirectUrl: "/onboarding?step=account" });
  }

  function finish() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    window.location.href = "/jobs";
  }

  if (!restored) return <div className="ob ob-navy" />;

  const bar = PROGRESS[step] != null && (
    <div className="ob-top">
      <button type="button" className="ob-back" aria-label="Back" onClick={() => go(BACK[step])}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <div className="ob-progress" role="progressbar" aria-valuenow={PROGRESS[step]} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${PROGRESS[step]}%` }} /></div>
    </div>
  );
  const ask = (text) => (
    <div className="ob-ask"><Pete size={60} /><p className="ob-bubble">{text}</p></div>
  );

  if (step === "welcome") return (
    <main className="ob ob-navy">
      <div className="ob-brand"><img src="/logo-mark.svg" alt="" width="22" height="22" /> Pete&rsquo;s Postings</div>
      <div className="ob-hero">
        <p className="ob-say">Hi! I&rsquo;m Pete. I&rsquo;ll notify you the second a firm posts a role you want.</p>
        <Pete size={170} wave />
      </div>
      <div className="ob-actions">
        <button className="ob-btn" onClick={() => go("why")}>Get started</button>
        <button className="ob-btn ob-btn-ghost" onClick={signIn}>I already have an account</button>
      </div>
    </main>
  );

  if (step === "why") return (
    <main className="ob ob-navy">
      <div className="ob-mid">
      <div className="ob-ask ob-ask-dark"><Pete size={60} /><p className="ob-bubble">Here&rsquo;s what changes for you.</p></div>
      <ul className="ob-why">
        <li><span className="ob-why-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4M7 8h4M7 11h7" /></svg></span>
          <div><strong>No more switching between career pages</strong><span>{FIRM_LABEL} firms&rsquo; openings, all in one feed.</span></div></li>
        <li><span className="ob-why-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" /><path d="M4 20L20 4" strokeWidth="2.6" /></svg></span>
          <div><strong>No more spreadsheets</strong><span>Save roles and track what you&rsquo;ve applied to right here.</span></div></li>
        <li><span className="ob-why-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></svg></span>
          <div><strong>Be first to know</strong><span>Get notified the moment we pick up a new posting, before other job platforms.</span></div></li>
      </ul>
      </div>
      <div className="ob-actions"><button className="ob-btn" onClick={() => go("firms")}>Set me up</button></div>
    </main>
  );

  if (step === "firms") return (
    <main className="ob ob-cream">
      {bar}
      {ask("Which firms are you after?")}
      <button type="button" className="ob-tile ob-tile-big" aria-pressed={answers.banks.length === 0} onClick={() => set({ banks: [] })}>
        <span>All {FIRM_LABEL} firms</span>{answers.banks.length === 0 && <Check />}
      </button>
      <p className="ob-label">Or pick your targets</p>
      <FirmPicker chipClass="ob-chip" searchClass="ob-search" on={(k) => answers.banks.includes(k)} onPick={toggleBank} />
      <div className="ob-actions ob-sticky"><button className="ob-btn" onClick={() => go("level")}>Continue</button></div>
    </main>
  );

  if (step === "level") return (
    <main className="ob ob-cream">
      {bar}
      {ask("What kind of role? Pick as many as you like.")}
      <div className="ob-stack">
        {LEVELS.map((l) => (
          <button key={l.key} type="button" className="ob-tile" aria-pressed={answers.levels.includes(l.key)} onClick={() => toggleLevel(l.key)}>
            <span className="ob-tile-text"><strong>{l.label}</strong><small>{l.sub}</small></span>
            {answers.levels.includes(l.key) && <Check />}
          </button>
        ))}
      </div>
      <div className="ob-actions">
        <button className="ob-btn" disabled={!answers.levels.length} onClick={() => go("location")}>Continue</button>
        {!answers.levels.length && <p className="ob-note">Pick at least one.</p>}
      </div>
    </main>
  );

  if (step === "location") return (
    <main className="ob ob-cream">
      {bar}
      {ask("Last one. Where do you want to work?")}
      <div className="ob-chips">
        {["", ...CITIES].map((c) => (
          <button key={c || "any"} type="button" className="ob-chip ob-chip-big" aria-pressed={answers.city === c} onClick={() => set({ city: c })}>{c || "Anywhere"}</button>
        ))}
      </div>
      <div className="ob-actions"><button className="ob-btn" onClick={() => go("match")}>Continue</button></div>
    </main>
  );

  if (step === "match") {
    const levels = answers.levels.map((k) => LEVELS.find((l) => l.key === k)?.label).join(" + ");
    const firms = answers.banks.length === 0 ? "all firms" : answers.banks.length === 1 ? ALL_FIRMS[answers.banks[0]]?.name : `${answers.banks.length} firms`;
    return (
      <main className="ob ob-navy">
        {bar}
        <div className="ob-center">
          <Pete size={100} mood="happy" />
          <p className="ob-count tnum">{matches ? matches.length.toLocaleString() : "…"}</p>
          <h1 className="ob-h1">{matches?.length === 1 ? "role matches" : "roles match"} you<br />right now</h1>
          <p className="ob-sub">{levels} · {answers.city || "Anywhere"} · {firms}</p>
        </div>
        {matches?.length > 0 && (
          <ul className="ob-preview" aria-label="Your newest matches, locked">
            {matches.slice(0, 3).map((j) => (
              <li key={j.link}>
                <BankLogo bankKey={j.bankKey} bank={j.bank} size={34} />
                <span className="ob-preview-text"><span className="ob-redact" aria-hidden="true" /><small>{j.bank} · {(j.location || "").split(/[;,]/)[0]}</small></span>
                <span className="ob-preview-time">{ago(postedAt(j))}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="ob-actions"><button className="ob-btn" onClick={() => go("paywall")}>See my roles</button></div>
      </main>
    );
  }

  if (step === "paywall") return (
    <main className="ob ob-cream">
      <div className="ob-mid">
      <div className="ob-pay-head"><Pete size={76} mood="lock" /><h1 className="ob-h1">Unlock {matches?.length ? `your ${matches.length.toLocaleString()} roles` : "every role"}</h1></div>
      <ul className="ob-checks">
        <li><Check />Instant notifications from {FIRM_LABEL} firms</li>
        <li><Check />Every role from the last 48 hours</li>
        <li><Check />Save jobs and track applications</li>
      </ul>
      <div className="ob-plan"><span><strong>Premium</strong><small>Billed monthly</small></span><b className="tnum">${price}<small>/mo</small></b></div>
      </div>
      <div className="ob-actions">
        <button className="ob-btn" onClick={subscribe}>Subscribe</button>
        {note && <p className="ob-note" role="status">{note}</p>}
        <p className="ob-fine">${price}/month, charged to your Apple ID. Renews monthly until you cancel in Settings.</p>
        <button type="button" className="ob-link" onClick={signIn}>Already pay on the website? Sign in</button>
        <p className="ob-legal">
          {/* TODO(app IAP): Restore purchases through RevenueCat. */}
          <button type="button" className="ob-link ob-link-quiet" onClick={() => setNote(isSignedIn ? "No purchases to restore yet." : "Sign in to restore a purchase.")}>Restore purchases</button>
          <a href="/terms">Terms</a><a href="/privacy">Privacy</a>
        </p>
      </div>
    </main>
  );

  if (step === "account") return (
    <main className="ob ob-cream">
      <div className="ob-center ob-center-top">
        <Pete size={96} mood="happy" />
        <h1 className="ob-h1">You&rsquo;re in!<br />Save your account</h1>
        <p className="ob-sub ob-sub-dark">So your subscription and picks follow you to a new phone.</p>
      </div>
      <div className="ob-actions">
        {/* TODO(app): Sign in with Apple needs the Apple Developer Program + a Clerk Apple connection. */}
        <button className="ob-btn" disabled={busy} onClick={createAccount}>{busy ? "Saving…" : isSignedIn ? "Continue" : "Continue with email"}</button>
        <p className="ob-fine">We email you a 6-digit code. No passwords.</p>
      </div>
    </main>
  );

  // notify
  return (
    <main className="ob ob-navy">
      <div className="ob-center ob-center-top">
        <h1 className="ob-h1">The second a role posts,<br />you&rsquo;ll know</h1>
        <p className="ob-sub">Turn on notifications so you hear about new roles before other job platforms do.</p>
      </div>
      <div className="ob-push" aria-hidden="true">
        <div><img src="/logo-mark.svg" alt="" width="22" height="22" /><p><b>Pete&rsquo;s Postings <i>now</i></b>Goldman Sachs just posted: 2027 Investment Banking Summer Analyst. Apply →</p></div>
        <div><img src="/logo-mark.svg" alt="" width="22" height="22" /><p><b>Pete&rsquo;s Postings <i>4m ago</i></b>Morgan Stanley just posted: 2027 Sales &amp; Trading Summer Analyst. Apply →</p></div>
      </div>
      <div className="ob-actions">
        {/* TODO(app push): ask for notification permission and register this phone. */}
        <button className="ob-btn" onClick={() => { capture("app_notifications_tapped"); finish(); }}>Turn on alerts</button>
        <button className="ob-btn ob-btn-text" onClick={finish}>Not now</button>
      </div>
    </main>
  );
}
