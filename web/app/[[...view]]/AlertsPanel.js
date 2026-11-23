"use client";

// Alert preferences, opened from the Alerts button next to the Browse filters.
// Desktop: a card under the filters (what you hear about | how we reach you).
// Phones: a bottom sheet, one column. Every choice is visible at once: no accordions.
import Link from "next/link";
import { AREAS, CITIES } from "@/lib/alert-options";
import { LEVELS, levelsFromPrefs } from "@/lib/levels";
import { FIRM_LABEL } from "@/lib/firms";
import FirmPicker from "@/app/FirmPicker";

const formatPhone = (raw) => {
  const d = (raw || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw || "";
};

export default function AlertsPanel({
  prefs, saved, loading, email, trialOver,
  pickBanks, onPickBanks, onChange, onToggleArea, onToggleBank,
  editingPhone, onEditPhone, onSave, saving, dirty, blocker, onClose,
}) {
  const on = Boolean(saved && (saved.enabled || saved.smsEnabled));
  const city = (prefs?.location || "").trim();
  const showBanks = pickBanks || (prefs?.banks || []).length > 0;
  const savedPhone = saved?.smsEnabled && saved?.phoneNumber && !editingPhone;
  const status = on
    ? [saved.smsEnabled && `Texting ${formatPhone(saved.phoneNumber)}`, saved.enabled && `emailing ${email || "you"}`].filter(Boolean).join(" and ")
    : "Off. Pick what you want below, then save.";

  return (
    <div className="alx-wrap" role="dialog" aria-label="Alert preferences">
      <button className="alx-shade" aria-label="Close alerts" onClick={onClose} />
      <div className="alx">
        <header className="alx-head">
          <div>
            <h2 className="alx-title">Alerts</h2>
            <p className="alx-status">{status}</p>
          </div>
          <button className="alx-x" aria-label="Close alerts" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>
        {trialOver && (
          <p className="alx-note">Alerts still arrive, and opening them takes Premium. <Link href="/pricing">Get Premium</Link></p>
        )}

        {loading || !prefs ? (
          <div className="alx-loading"><div className="spinner" /></div>
        ) : (
          <>
            <div className="alx-body">
              <section className="alx-col" aria-label="What you'll hear about">
                <h3 className="alx-h">What you&rsquo;ll hear about</h3>

                <div className="alx-field">
                  <p className="alx-label">Level</p>
                  <div className="alx-chips">
                    {LEVELS.map((l) => {
                      const cur = levelsFromPrefs(prefs);
                      const on = cur.includes(l.key);
                      // At least one level stays picked.
                      const next = on ? (cur.length > 1 ? cur.filter((k) => k !== l.key) : cur) : [...cur, l.key];
                      return <button key={l.key} className="alx-chip" aria-pressed={on} onClick={() => onChange({ levels: next })}>{l.label}</button>;
                    })}
                  </div>
                </div>

                <div className="alx-field">
                  <p className="alx-label">Areas</p>
                  <div className="alx-chips">
                    <button className="alx-chip" aria-pressed={prefs.categories.length === 0} onClick={() => onChange({ categories: [] })}>Open to anything</button>
                    {AREAS.map((a) => (
                      <button key={a.key} className="alx-chip" aria-pressed={a.categories.every((c) => prefs.categories.includes(c))} onClick={() => onToggleArea(a)}>{a.label}</button>
                    ))}
                  </div>
                </div>

                <div className="alx-field">
                  <p className="alx-label">Banks</p>
                  <div className="alx-chips">
                    <button className="alx-chip" aria-pressed={!showBanks} onClick={() => { onPickBanks(false); onChange({ banks: [] }); }}>All {FIRM_LABEL} firms</button>
                    <button className="alx-chip" aria-pressed={showBanks} onClick={() => onPickBanks(true)}>Choose firms</button>
                  </div>
                  {showBanks && (
                    <div className="alx-banks">
                      <FirmPicker chipClass="alx-chip" searchClass="firm-search alx-input" on={(k) => prefs.banks.includes(k)} onPick={onToggleBank} />
                    </div>
                  )}
                </div>

                <div className="alx-field">
                  <p className="alx-label">City</p>
                  <div className="alx-chips">
                    <button className="alx-chip" aria-pressed={!city} onClick={() => onChange({ location: "" })}>Anywhere</button>
                    {CITIES.map((c) => (
                      <button key={c} className="alx-chip" aria-pressed={city.toLowerCase() === c.toLowerCase()} onClick={() => onChange({ location: c })}>{c}</button>
                    ))}
                  </div>
                  <input className="alx-input" type="text" aria-label="Another city" placeholder="Or type another city"
                    value={CITIES.some((c) => c.toLowerCase() === city.toLowerCase()) ? "" : city}
                    onChange={(e) => onChange({ location: e.target.value })} />
                </div>
              </section>

              <section className="alx-col" aria-label="How we reach you">
                <h3 className="alx-h">How we reach you</h3>

                <div className="alx-channel">
                  <div className="alx-channel-row">
                    <div>
                      <p className="alx-channel-name">Text message</p>
                      <p className="alx-channel-sub">
                        {savedPhone ? <>{formatPhone(saved.phoneNumber)} &middot; <button className="alx-link" onClick={() => onEditPhone(true)}>Change</button></> : "Fastest. Most people use this."}
                      </p>
                    </div>
                    <button className={`alx-switch${prefs.smsEnabled ? " is-on" : ""}`} role="switch" aria-checked={Boolean(prefs.smsEnabled)} aria-label="Text alerts" onClick={() => onChange({ smsEnabled: !prefs.smsEnabled })}><span /></button>
                  </div>
                  {prefs.smsEnabled && !savedPhone && (
                    <div className="alx-phone">
                      <label className="alx-label" htmlFor="alx-phone-input">Mobile number</label>
                      <input id="alx-phone-input" className="alx-input" type="tel" autoComplete="tel" placeholder="(555) 000-0000"
                        value={prefs.phoneNumber || ""} onChange={(e) => onChange({ phoneNumber: e.target.value })} />
                      <label className="alx-consent">
                        <input type="checkbox" checked={Boolean(prefs.smsConsent)} onChange={(e) => onChange({ smsConsent: e.target.checked })} />
                        <span>
                          I agree to receive recurring automated text messages from Pete&rsquo;s Postings about new job postings matching my preferences. Message frequency varies, up to a few times per day. Message and data rates may apply. Reply <strong>STOP</strong> to cancel, <strong>HELP</strong> for help. Consent is not required to use Pete&rsquo;s Postings. See our <Link href="/privacy" target="_blank">Privacy Policy</Link> and <Link href="/terms" target="_blank">Terms</Link>.
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                <div className="alx-channel">
                  <div className="alx-channel-row">
                    <div>
                      <p className="alx-channel-name">Email</p>
                      <p className="alx-channel-sub">{email || "Your account email"}</p>
                    </div>
                    <button className={`alx-switch${prefs.enabled ? " is-on" : ""}`} role="switch" aria-checked={Boolean(prefs.enabled)} aria-label="Email alerts" onClick={() => onChange({ enabled: !prefs.enabled })}><span /></button>
                  </div>
                </div>
              </section>
            </div>

            <footer className="alx-foot">
              <p className={`alx-foot-note${blocker ? " is-blocked" : ""}`}>{blocker || (dirty ? "You have unsaved changes." : "All changes saved.")}</p>
              <button className="alx-save" onClick={onSave} disabled={saving || Boolean(blocker) || !dirty}>{saving ? "Saving…" : "Save preferences"}</button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
