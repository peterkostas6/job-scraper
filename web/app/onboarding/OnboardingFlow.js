"use client";

// The iPhone app's first launch, one screen at a time (Duolingo style): Pete says hi, what
// changes for you, three questions (firms, level, location), how many live roles match, then
// the hard paywall and turning on alerts. There's no account to make: paying (or restoring a
// purchase) signs them in to an app-only account tied to the purchase (app/api/app/session).
// Answers are kept on the phone until then, in the same shape as the website's alert settings.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useUser, useSignIn } from "@clerk/nextjs";
import { purchasesReady, getPremiumPackage, buyPremium, restorePremium, linkPurchaseToAccount, purchasesAppUserId, enablePush } from "@/lib/native";
import BankLogo from "@/lib/bank-logo";
import { decodeEntities } from "@/lib/text";
import { capture } from "@/lib/analytics";
import { matchesAlertPrefs, AREAS, ALL_CITIES, splitCities, joinCities } from "@/lib/alert-options";
import { LEVELS, DEFAULT_ALERT_LEVELS } from "@/lib/levels";
import { FIRM_LABEL, ALL_FIRMS } from "@/lib/firms";
import { PLANS } from "@/lib/plans";
import { hasAppAccess, isTestHost, unlockForTesting } from "@/lib/app-access";
import FirmPicker from "@/app/FirmPicker";
import Pete from "./Pete";
import { TOUR_KEY, TOUR_SEEN_KEY } from "@/app/AppTour";

const STORAGE_KEY = "pp-onboarding-v1";
// "signin" is where a phone that has been signed in before lands (a lapsed session, or a
// website member who signed out): restore the subscription, or sign in for website members.
const STEPS = ["signin", "welcome", "area", "level", "location", "firms", "match", "timing", "paywall", "notify"];
const TEST_MEMBER_KEY = "pp_test_member"; // dev "Skip payment": this phone's stand-in purchase id
const PROGRESS = { area: 20, level: 40, location: 60, firms: 80, match: 100 };
// Every setup screen (and the paywall) has a back arrow so answers can be changed.
const BACK = { area: "welcome", level: "area", location: "level", firms: "location", match: "firms", timing: "match", paywall: "timing" };
// answers.city holds the picked cities as one string ("Chicago; New York"), the shape alert
// settings save; blank means anywhere.
const WELCOME = "Hi! I\u2019m Pete, your agent who checks career pages for you. I\u2019ll notify you the second jobs go live!";
const TYPE_MS = 26;
const price = PLANS.monthly.price.toFixed(2);

const areaCategories = (keys = []) => AREAS.filter((x) => keys.includes(x.key)).flatMap((x) => x.categories);
const toPrefs = (a) => ({ banks: a.banks, categories: areaCategories(a.areas), jobType: "all", levels: a.levels, location: a.city });
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
  const [step, setStep] = useState("welcome");
  const [pkg, setPkg] = useState(null); // Apple's Premium package (price in the local currency)
  const [answers, setAnswers] = useState({ banks: [], levels: DEFAULT_ALERT_LEVELS, city: "", areas: [] });
  const [restored, setRestored] = useState(false);
  const [jobs, setJobs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [typed, setTyped] = useState(0); // letters of the welcome shown so far

  // Pick up where they left off (also after coming back from the sign-in box).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.answers) setAnswers({ areas: [], ...saved.answers });
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

  // Pete types his hello out letter by letter (all at once for people who turn off motion).
  const showWelcome = restored && isLoaded && step === "welcome";
  useEffect(() => {
    if (!showWelcome) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setTyped(WELCOME.length); return; }
    setTyped(0);
    let id, wait, gone = false;
    // Start only once everything has loaded: the page, its fonts, and the app's loading screen
    // (Pete hopping) has cleared, so nobody misses the first words.
    const loaded = document.readyState === "complete" ? Promise.resolve() : new Promise((r) => window.addEventListener("load", r, { once: true }));
    const splashGone = () => new Promise((r) => {
      const t0 = Date.now();
      const check = () => (!document.querySelector(".app-splash") || Date.now() - t0 > 8000 ? r() : setTimeout(check, 100));
      check();
    });
    loaded.then(() => document.fonts?.ready).then(splashGone).then(() => {
      if (gone) return;
      wait = setTimeout(() => {
        id = setInterval(() => setTyped((n) => { if (n + 1 >= WELCOME.length) clearInterval(id); return n + 1; }), TYPE_MS);
      }, 350);
    });
    return () => { gone = true; clearTimeout(wait); clearInterval(id); };
  }, [showWelcome]);

  // Back from the sign-in box: a paying account goes straight in; otherwise carry on.
  useEffect(() => {
    if (!restored || !isLoaded || !isSignedIn) return;
    if (step === "welcome" || step === "paywall") { if (paid) finish(); return; }
    // Signed back in: a paying account goes to its jobs; one that isn't paying sees the paywall.
    if (step === "signin") { if (paid) finish(); else go("paywall"); return; }
  }, [restored, isLoaded, isSignedIn, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (s) => { setNote(""); setStep(s); window.scrollTo(0, 0); };
  const set = (patch) => setAnswers((a) => ({ ...a, ...patch }));
  const toggleBank = (k) => set({ banks: answers.banks.includes(k) ? answers.banks.filter((x) => x !== k) : [...answers.banks, k] });
  const toggleLevel = (k) => set({ levels: answers.levels.includes(k) ? answers.levels.filter((x) => x !== k) : [...answers.levels, k] });
  const toggleCity = (c) => { const now = splitCities(answers.city); set({ city: joinCities(now.includes(c) ? now.filter((x) => x !== c) : [...now, c]) }); };
  const toggleArea = (k) => set({ areas: answers.areas.includes(k) ? answers.areas.filter((x) => x !== k) : [...answers.areas, k] });

  function signIn() {
    capture("app_onboarding_signin_opened", { from: step });
    const back = `/onboarding?step=${step === "welcome" || step === "signin" ? step : "paywall"}`;
    clerk.openSignIn({ forceRedirectUrl: back, signUpForceRedirectUrl: back });
  }

  // A purchase made on this phone is recorded on the account once there is one.
  async function attachPurchase() {
    if (!purchasesReady() || !user?.id) return;
    await linkPurchaseToAccount(user.id);
    await user.reload().catch(() => {});
  }

  // The onboarding answers become their alert preferences (alerts stay off until notifications
  // are on; the answers still power "My Preferences").
  async function savePrefs() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false, ...toPrefs(answers), smsEnabled: false, smsConsent: false, phoneNumber: "" }),
    }).catch(() => {});
  }

  // Paid or restored, with no account: the server checks the purchase and hands back a one-time
  // sign-in token for the app-only account tied to it (made now if it's new). fromSurvey: they
  // just answered the questions, so those become their preferences even on an older account.
  async function enterApp({ test = false, fromSurvey = true } = {}) {
    let rcId = null;
    if (test) {
      try { rcId = localStorage.getItem(TEST_MEMBER_KEY); } catch {}
      if (!rcId) { rcId = `test:${crypto.randomUUID()}`; try { localStorage.setItem(TEST_MEMBER_KEY, rcId); } catch {} }
    } else rcId = await purchasesAppUserId();
    if (!rcId) throw new Error("no purchase id");
    const res = await fetch("/api/app/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rcId, test }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok || !data?.token) throw new Error(data?.error || "no session");
    const fresh = data.created || fromSurvey;
    // Move on before the session lands, so the "already paid" check doesn't skip notifications.
    if (fresh) go("notify");
    const attempt = await clerkSignIn.create({ strategy: "ticket", ticket: data.token });
    await setActive({ session: attempt.createdSessionId });
    capture(data.created ? "app_member_created" : "app_member_signed_in", { test });
    // RevenueCat now files this phone's purchase under the account, so renewals and
    // cancellations reach it (lib/app-store.js, the RevenueCat webhook).
    if (!test) await linkPurchaseToAccount(data.userId).catch(() => {});
    if (fresh) await savePrefs(); else finish();
  }

  async function subscribe() {
    capture("app_subscribe_tapped");
    if (purchasesReady() && pkg) {
      setBusy(true);
      let ok = false;
      try { ok = await buyPremium(pkg, user?.id); } catch { setNote("The purchase didn’t go through. Try again."); }
      if (ok) {
        capture("app_subscribed");
        try {
          // A website account signed in here keeps using that account; everyone else gets in with none.
          if (isSignedIn) { await attachPurchase(); go("notify"); await savePrefs(); } else await enterApp();
        } catch {
          setNote("You’re subscribed, but the app couldn’t open. Tap Restore purchases.");
        }
      }
      setBusy(false);
      return;
    }
    if (isTestHost()) { await skipPayment(); return; }
    setNote("Subscriptions open when the app launches on the App Store.");
  }

  // dev.petespostings.com / localhost only: in without Apple's purchase sheet.
  async function skipPayment() {
    unlockForTesting();
    if (isSignedIn) { go("notify"); await savePrefs(); return; }
    setBusy(true);
    try { await enterApp({ test: true }); } catch (err) { setNote(`Test sign-in failed (${err?.message || "unknown"}).`); }
    setBusy(false);
  }

  async function restore() {
    if (!purchasesReady()) { setNote("Restoring works in the App Store version of the app."); return; }
    setBusy(true);
    const ok = await restorePremium(user?.id).catch(() => false);
    if (!ok) { setBusy(false); setNote("No Premium subscription found for this Apple ID."); return; }
    capture("app_restored");
    try {
      if (isSignedIn) { await attachPurchase(); finish(); } else await enterApp({ fromSurvey: step === "paywall" });
    } catch {
      setNote("We found your subscription but couldn’t open the app. Try again.");
    }
    setBusy(false);
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
  if (!restored || !isLoaded || (isSignedIn && paid && (step === "welcome" || step === "paywall" || step === "signin"))) {
    return <div className="ob ob-navy ob-loading" role="status" aria-label="Loading"><span className="pete-hop" aria-hidden="true" /></div>;
  }

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

  if (step === "signin") return (
    <main key={step} className="ob ob-navy">
      <div className="ob-brand"><img src="/logo-mark.svg" alt="" width="22" height="22" /> Pete&rsquo;s Postings</div>
      <div className="ob-hero">
        <p className="ob-say">Welcome back! Restore your subscription to pick up where you left off.</p>
        <Pete size={170} wave />
      </div>
      <div className="ob-actions">
        <button className="ob-btn" disabled={busy} onClick={restore}>{busy ? "Checking…" : "Restore my subscription"}</button>
        <button className="ob-btn ob-btn-ghost" disabled={busy} onClick={signIn}>I pay on the website</button>
        {note && <p className="ob-note" role="status">{note}</p>}
        <button type="button" className="ob-link" onClick={() => { capture("app_signin_new_here"); go("welcome"); }}>I&rsquo;m new here</button>
      </div>
    </main>
  );

  if (step === "welcome") return (
    <main key={step} className="ob ob-navy">
      <div className="ob-brand"><img src="/logo-mark.svg" alt="" width="22" height="22" /> Pete&rsquo;s Postings</div>
      <div className="ob-hero">
        <p className="ob-say ob-say-long">
          <span className="sr-only">{WELCOME}</span>
          <span aria-hidden="true">{WELCOME.slice(0, typed)}</span>
          {typed < WELCOME.length && <span className="tour-caret" aria-hidden="true" />}
          <span aria-hidden="true" className="tour-rest">{WELCOME.slice(typed)}</span>
        </p>
        <Pete size={170} wave />
      </div>
      <div className="ob-actions">
        <button className="ob-btn" onClick={() => go("area")}>Get started</button>
      </div>
    </main>
  );

  if (step === "firms") return (
    <main key={step} className="ob ob-cream">
      {bar}
      {ask("Last one. Which firms should I notify you about?")}
      <button type="button" className="ob-tile ob-tile-big" aria-pressed={answers.banks.length === 0} onClick={() => set({ banks: [] })}>
        <span>All {FIRM_LABEL} firms</span>{answers.banks.length === 0 && <Check />}
      </button>
      <p className="ob-label">Or pick your targets</p>
      <FirmPicker chipClass="ob-chip" searchClass="ob-search" on={(k) => answers.banks.includes(k)} onPick={toggleBank} />
      <div className="ob-actions ob-sticky"><button className="ob-btn" onClick={() => go("match")}>Continue</button></div>
    </main>
  );

  if (step === "area") return (
    <main key={step} className="ob ob-cream">
      {bar}
      {ask("What type of role are you looking for?")}
      <button type="button" className="ob-tile ob-tile-big" aria-pressed={answers.areas.length === 0} onClick={() => set({ areas: [] })}>
        <span>Any type of role</span>{answers.areas.length === 0 && <Check />}
      </button>
      <p className="ob-label">Or pick yours</p>
      <div className="ob-stack">
        {AREAS.map((x) => (
          <button key={x.key} type="button" className="ob-tile" aria-pressed={answers.areas.includes(x.key)} onClick={() => toggleArea(x.key)}>
            <span className="ob-tile-text"><strong>{x.label}</strong></span>
            {answers.areas.includes(x.key) && <Check />}
          </button>
        ))}
      </div>
      <div className="ob-actions"><button className="ob-btn" onClick={() => go("level")}>Continue</button></div>
    </main>
  );

  if (step === "level") return (
    <main key={step} className="ob ob-cream">
      {bar}
      {ask("What level?")}
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
      {ask("Where do you want to work?")}
      <div className="ob-chips">
        <button type="button" className="ob-chip ob-chip-big" aria-pressed={!answers.city} onClick={() => set({ city: "" })}>Anywhere</button>
        {ALL_CITIES.map((c) => (
          <button key={c} type="button" className="ob-chip ob-chip-big" aria-pressed={splitCities(answers.city).includes(c)} onClick={() => toggleCity(c)}>{c}</button>
        ))}
      </div>
      <div className="ob-actions ob-sticky"><button className="ob-btn" onClick={() => go("firms")}>Continue</button></div>
    </main>
  );

  if (step === "match") {
    const levels = answers.levels.map((k) => LEVELS.find((l) => l.key === k)?.label).join(" + ");
    const picked = splitCities(answers.city);
    const cities = picked.length === 0 ? "Anywhere" : picked.length <= 2 ? picked.join(" + ") : `${picked.length} cities`;
    const firms = answers.banks.length === 0 ? "all firms" : answers.banks.length === 1 ? ALL_FIRMS[answers.banks[0]]?.name : `${answers.banks.length} firms`;
    return (
      <main key={step} className="ob ob-navy">
        {bar}
        <div className="ob-center">
          <span className="ob-bounce"><Pete size={100} mood="happy" /></span>
          <h1 className="ob-h1">WooHoo! I&rsquo;ve found</h1>
          <p className="ob-count tnum">{matches ? matches.length.toLocaleString() : "…"}</p>
          <h1 className="ob-h1">{matches?.length === 1 ? "role that matches" : "roles that match"}</h1>
          <p className="ob-sub">{levels} · {cities} · {firms}</p>
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
        <div className="ob-actions"><button className="ob-btn" onClick={() => go("timing")}>See my roles</button></div>
      </main>
    );
  }

  // Why speed matters, between the match count and the paywall.
  if (step === "timing") return (
    <main key={step} className="ob ob-navy">
      {bar}
      <div className="ob-mid">
        <div className="ob-center">
          <p className="ob-kicker">Timing is everything</p>
          <h1 className="ob-h1">Early applicants land <span className="ob-hl">2.3x</span> more interviews</h1>
          <div className="ob-bars" role="img" aria-label="Applying in the first few hours: 2.3 times the interviews of applying 2 days later">
            <div className="ob-bar-col"><b className="tnum">2.3x</b><span className="ob-bar ob-bar-win" /><small>First few hours</small></div>
            <div className="ob-bar-col"><span className="ob-bar ob-bar-late" /><small>2 days later</small></div>
          </div>
          <p className="ob-sub">Apply in the first few hours after a role goes live and you&rsquo;ll land 2.3x more interviews than if you wait 2 days.</p>
        </div>
        <div className="ob-ask"><Pete size={60} /><p className="ob-bubble">That&rsquo;s why I tell you the second a job goes live.</p></div>
      </div>
      <div className="ob-actions"><button className="ob-btn" onClick={() => go("paywall")}>Let&rsquo;s go</button></div>
    </main>
  );

  if (step === "paywall") return (
    <main key={step} className="ob ob-cream">
      {bar}
      <div className="ob-mid">
      <div className="ob-pay-head"><Pete size={76} mood="lock" /><h1 className="ob-h1">Land more interviews</h1></div>
      <p className="ob-pay-proof">Apply before your competition. Here&rsquo;s how:</p>
      <ul className="ob-checks">
        <li><Check />Tracked directly from bank career sites, not from a third party</li>
        <li><Check />Push notifications the second roles go live</li>
      </ul>
      <div className="ob-plan"><span><strong>Premium</strong><small>Billed monthly</small></span><b className="tnum">${price}<small>/mo</small></b></div>
      </div>
      <div className="ob-actions">
        <button className="ob-btn" disabled={busy} onClick={subscribe}>Start landing interviews</button>
        {note && <p className="ob-note" role="status">{note}</p>}
        <p className="ob-fine">{pkg?.product?.priceString || `$${price}`}/month, charged to your Apple ID. Renews monthly until you cancel in Settings.</p>
        <p className="ob-legal">
          <button type="button" className="ob-link ob-link-quiet" disabled={busy} onClick={restore}>Restore purchases</button>
          <a href="/terms">Terms</a><a href="/privacy">Privacy</a>
        </p>
        {/* dev.petespostings.com / localhost only (never the live site the App Store app uses):
            skip Apple's purchase sheet, which needs a sandbox Apple account on a test install. */}
        {isTestHost() && (
          <button type="button" className="ob-link ob-link-quiet" disabled={busy} onClick={skipPayment}>
            Skip payment (test build only)
          </button>
        )}
      </div>
    </main>
  );

  // notify
  return (
    <main key={step} className="ob ob-navy">
      <div className="ob-center ob-center-top">
        <h1 className="ob-h1">You&rsquo;re in! The second a role posts, you&rsquo;ll know</h1>
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
        <button className="ob-btn ob-btn-text" disabled={busy} onClick={finish}>Not now</button>
      </div>
    </main>
  );
}
