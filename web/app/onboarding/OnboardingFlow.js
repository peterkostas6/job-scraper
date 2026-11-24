"use client";

// The iPhone app's first launch, one screen at a time (Duolingo style): Pete says hi, what
// changes for you, three questions (firms, level, location), how many live roles match, then
// the hard paywall, saving the account, and turning on alerts. Answers are kept on the phone
// until there is an account to save them to, in the same shape as the website's alert settings.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useUser, useSignIn, useSignUp } from "@clerk/nextjs";
import { purchasesReady, getPremiumPackage, buyPremium, restorePremium, linkPurchaseToAccount, enablePush, appleSignInReady, appleIdentityToken } from "@/lib/native";
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
import { TOUR_KEY, TOUR_SEEN_KEY } from "@/app/AppTour";

const STORAGE_KEY = "pp-onboarding-v1";
const STEPS = ["welcome", "why", "firms", "level", "location", "match", "paywall", "account", "notify"];
const PROGRESS = { firms: 25, level: 50, location: 75, match: 100 };
// Every setup screen (and the paywall) has a back arrow so answers can be changed.
const BACK = { why: "welcome", firms: "why", level: "firms", location: "level", match: "location", paywall: "match" };
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
  const router = useRouter();
  const { signIn: clerkSignIn, setActive } = useSignIn();
  const { signUp: clerkSignUp } = useSignUp();
  const [step, setStep] = useState("welcome");
  const [pkg, setPkg] = useState(null); // Apple's Premium package (price in the local currency)
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
    if (purchasesReady()) getPremiumPackage().then(setPkg).catch(() => {});
  }, []);

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

  // A purchase made on this phone is recorded on the account once there is one.
  async function attachPurchase() {
    if (!purchasesReady() || !user?.id) return;
    await linkPurchaseToAccount(user.id);
    await user.reload().catch(() => {});
  }

  async function subscribe() {
    capture("app_subscribe_tapped");
    if (purchasesReady() && pkg) {
      setBusy(true);
      try {
        const ok = await buyPremium(pkg, user?.id);
        if (ok) { capture("app_subscribed"); go("account"); }
      } catch {
        setNote("The purchase didn’t go through. Try again.");
      }
      setBusy(false);
      return;
    }
    if (isTestHost()) { unlockForTesting(); go("account"); return; }
    setNote("Subscriptions open when the app launches on the App Store.");
  }

  async function restore() {
    if (!purchasesReady()) { setNote(isSignedIn ? "No purchases to restore." : "Sign in to restore a purchase."); return; }
    setBusy(true);
    const ok = await restorePremium(user?.id).catch(() => false);
    setBusy(false);
    if (!ok) { setNote("No Premium purchase found for this Apple ID."); return; }
    if (isSignedIn) { await attachPurchase(); finish(); } else go("account");
  }

  // Sign in with Apple: Apple's Face ID sheet gives a signed token Clerk checks. A new Apple ID
  // comes back "transferable" from sign-in and becomes a new account.
  async function appleSignIn() {
    const token = await appleIdentityToken();
    if (!token) return;
    setBusy(true);
    try {
      let session;
      const attempt = await clerkSignIn.create({ strategy: "oauth_token_apple", token });
      if (attempt.status === "complete") session = attempt.createdSessionId;
      else if (attempt.firstFactorVerification?.status === "transferable") {
        const created = await clerkSignUp.create({ transfer: true });
        session = created.createdSessionId;
      }
      if (!session) throw new Error("not complete");
      await setActive({ session });
      capture("app_apple_signin");
    } catch (err) {
      const reason = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || "unknown";
      capture("app_apple_signin_failed", { reason, code: err?.errors?.[0]?.code || null });
      setNote(`Couldn’t sign in with Apple (${reason}). Try email instead.`);
    }
    setBusy(false);
  }

  async function saveAndNext() {
    if (busy) return;
    setBusy(true);
    await attachPurchase();
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
    // The app tour runs once on the jobs screen, the first time someone gets past onboarding.
    try {
      localStorage.removeItem(STORAGE_KEY);
      if (!localStorage.getItem(TOUR_SEEN_KEY)) localStorage.setItem(TOUR_KEY, "pending");
    } catch {}
    router.replace("/jobs"); // in place, no full-page reload flash
  }

  // Wait for the sign-in to load before showing anything: a returning member goes straight to
  // their jobs instead of seeing "Hi!" flash first.
  if (!restored || !isLoaded || (isSignedIn && paid && (step === "welcome" || step === "paywall"))) return <div className="ob ob-navy" />;

  const back = BACK[step] && (
    <button type="button" className="ob-back" aria-label="Back" onClick={() => go(BACK[step])}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </button>
  );
  const bar = (
    <div className="ob-top">
      {back}
      {PROGRESS[step] != null && <div className="ob-progress" role="progressbar" aria-valuenow={PROGRESS[step]} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${PROGRESS[step]}%` }} /></div>}
    </div>
  );
  const ask = (text) => (
    <div className="ob-ask"><Pete size={60} /><p className="ob-bubble">{text}</p></div>
  );

  if (step === "welcome") return (
    <main key={step} className="ob ob-navy">
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
    <main key={step} className="ob ob-navy">
      {bar}
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
    <main key={step} className="ob ob-cream">
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
    <main key={step} className="ob ob-cream">
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
    <main key={step} className="ob ob-cream">
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
      <main key={step} className="ob ob-navy">
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
    <main key={step} className="ob ob-cream">
      {bar}
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
        <button className="ob-btn" disabled={busy} onClick={subscribe}>Subscribe</button>
        {note && <p className="ob-note" role="status">{note}</p>}
        <p className="ob-fine">{pkg?.product?.priceString || `$${price}`}/month, charged to your Apple ID. Renews monthly until you cancel in Settings.</p>
        <button type="button" className="ob-link" onClick={signIn}>Already pay on the website? Sign in</button>
        <p className="ob-legal">
          <button type="button" className="ob-link ob-link-quiet" disabled={busy} onClick={restore}>Restore purchases</button>
          <a href="/terms">Terms</a><a href="/privacy">Privacy</a>
        </p>
      </div>
    </main>
  );

  if (step === "account") return (
    <main key={step} className="ob ob-cream">
      <div className="ob-center ob-center-top">
        <Pete size={96} mood="happy" />
        <h1 className="ob-h1">You&rsquo;re in!<br />Save your account</h1>
        <p className="ob-sub ob-sub-dark">So your subscription and picks follow you to a new phone.</p>
      </div>
      <div className="ob-actions">
        {!isSignedIn && appleSignInReady() && (
          <button className="ob-btn ob-btn-apple" disabled={busy} onClick={appleSignIn}>
            <svg width="18" height="22" viewBox="0 0 384 512" aria-hidden="true"><path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
            Sign in with Apple
          </button>
        )}
        <button className={`ob-btn${!isSignedIn && appleSignInReady() ? " ob-btn-light" : ""}`} disabled={busy} onClick={createAccount}>{busy ? "Saving…" : isSignedIn ? "Continue" : "Continue with email"}</button>
        {note && <p className="ob-note" role="status">{note}</p>}
        <p className="ob-fine">Email sign-in sends you a 6-digit code. No passwords.</p>
      </div>
    </main>
  );

  // notify
  return (
    <main key={step} className="ob ob-navy">
      <div className="ob-center ob-center-top">
        <h1 className="ob-h1">The second a role posts,<br />you&rsquo;ll know</h1>
        <p className="ob-sub">Turn on notifications so you hear about new roles before other job platforms do.</p>
      </div>
      <div className="ob-push" aria-hidden="true">
        <div><img src="/logo-mark.svg" alt="" width="22" height="22" /><p><b>Pete&rsquo;s Postings <i>now</i></b>Goldman Sachs just posted: 2027 Investment Banking Summer Analyst. Apply →</p></div>
        <div><img src="/logo-mark.svg" alt="" width="22" height="22" /><p><b>Pete&rsquo;s Postings <i>4m ago</i></b>Morgan Stanley just posted: 2027 Sales &amp; Trading Summer Analyst. Apply →</p></div>
      </div>
      <div className="ob-actions">
        <button className="ob-btn" disabled={busy} onClick={async () => {
          capture("app_notifications_tapped");
          setBusy(true);
          const on = await enablePush();
          capture(on ? "app_notifications_on" : "app_notifications_declined");
          finish();
        }}>Turn on alerts</button>
        <button className="ob-btn ob-btn-text" onClick={finish}>Not now</button>
      </div>
    </main>
  );
}
