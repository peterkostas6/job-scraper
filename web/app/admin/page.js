"use client";

// Pete's admin page: every user with their contact info and what we've sent them,
// bank health, and buttons to text yourself a sample alert. The data routes check
// the signed-in account on the server, so this page shows nothing to anyone else.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { BANKS } from "@/lib/banks";
import { isAdminUser } from "@/lib/admin-id";

const fmtPhone = (raw) => {
  const d = (raw || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw || "";
};
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }) : "");
const ago = (v) => {
  if (!v) return "";
  const m = Math.round((Date.now() - new Date(v).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};
const money = (n) => `$${n.toFixed(n > 0 && n < 1 ? 3 : 2)}`;
const PLAN_LABEL = { premium: "Premium", trial: "Free days", free: "No Premium" };
const SORTS = {
  texts: { label: "Most texts", fn: (a, b) => b.texts - a.texts || b.createdAt - a.createdAt },
  newest: { label: "Newest", fn: (a, b) => b.createdAt - a.createdAt },
  cost: { label: "Text cost", fn: (a, b) => (b.textCost?.cost || 0) - (a.textCost?.cost || 0) },
  lastText: { label: "Last texted", fn: (a, b) => (b.lastTextAt ? Date.parse(b.lastTextAt) : 0) - (a.lastTextAt ? Date.parse(a.lastTextAt) : 0) },
};

export default function AdminPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const isAdmin = isLoaded && isAdminUser(user);
  const [data, setData] = useState(null);
  const [banks, setBanks] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState("all");
  const [sort, setSort] = useState("texts");
  const [open, setOpen] = useState(null);
  const [sending, setSending] = useState("");
  const [sendResult, setSendResult] = useState("");

  const myPhone = user?.unsafeMetadata?.notifications?.phoneNumber || "";

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/users?format=json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Users: ${r.status}`))))
      .then(setData)
      .catch((e) => setError(e.message));
    fetch("/api/admin/bank-status")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setBanks(d.banks || []))
      .catch(() => setBanks([]));
  }, [isAdmin]);

  const users = data?.users || [];
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return users
      .filter((u) => plan === "all" || u.plan === plan || (plan === "textsOn" && u.textsOn))
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (qDigits.length >= 3 && u.phone.replace(/\D/g, "").includes(qDigits)))
      .sort(SORTS[sort].fn);
  }, [users, query, plan, sort]);

  async function sendTest(kind) {
    setSending(kind);
    setSendResult("");
    try {
      const extra = kind === "locked" ? "&locked=1" : kind === "welcome" ? "&welcome=1" : "";
      const r = await fetch(`/api/admin/test-notification?phone=${encodeURIComponent(myPhone)}${extra}`);
      const body = await r.json();
      setSendResult(body.smsSent ? `Sent to ${fmtPhone(myPhone)}.` : `Not sent: ${body.error || body.smsError || (body.smsConfigured === false ? "texting isn't set up here" : "unknown error")}`);
    } catch (e) {
      setSendResult(`Not sent: ${e.message}`);
    }
    setSending("");
  }

  if (!isLoaded) return <div className="adm"><div className="spinner" /></div>;
  if (!isSignedIn || !isAdmin) {
    return (
      <div className="adm adm-denied">
        <p>This page isn&rsquo;t available.</p>
        {isSignedIn && <p className="adm-sub-dark">Signed in as {user?.primaryEmailAddress?.emailAddress}</p>}
        <Link href="/jobs">Browse jobs</Link>
      </div>
    );
  }

  const count = (fn) => users.filter(fn).length;
  const totalTexts = users.reduce((n, u) => n + u.texts, 0);
  const stats = [
    ["Users", users.length],
    ["Premium", count((u) => u.plan === "premium")],
    ["In free days", count((u) => u.plan === "trial")],
    ["Texts on", count((u) => u.textsOn)],
    ["Texts sent", totalTexts],
    ["Text cost", data?.textCost ? money(data.textCost.total) : "—"],
  ];
  const bankIssues = (banks || []).filter((b) => b.lastError);

  return (
    <div className="adm">
      <header className="adm-head">
        <div>
          <Link href="/jobs" className="adm-back">&larr; Pete&rsquo;s Postings</Link>
          <h1 className="adm-title">Admin</h1>
        </div>
      </header>

      {error && <p className="adm-error">{error}</p>}

      <section className="adm-stats">
        {stats.map(([label, value]) => (
          <div key={label} className="adm-stat">
            <span className="adm-stat-value tnum">{data ? value : "…"}</span>
            <span className="adm-stat-label">{label}</span>
          </div>
        ))}
      </section>

      <section className="adm-card">
        <h2 className="adm-h">Text yourself a sample</h2>
        {myPhone ? (
          <>
            <p className="adm-sub">Goes to {fmtPhone(myPhone)}, the number in your alert preferences.</p>
            <div className="adm-actions">
              <button className="adm-btn" onClick={() => sendTest("normal")} disabled={Boolean(sending)}>{sending === "normal" ? "Sending…" : "Normal alert"}</button>
              <button className="adm-btn adm-btn-coral" onClick={() => sendTest("locked")} disabled={Boolean(sending)}>{sending === "locked" ? "Sending…" : "No-Premium alert"}</button>
              <button className="adm-btn" onClick={() => sendTest("welcome")} disabled={Boolean(sending)}>{sending === "welcome" ? "Sending…" : "Welcome text + contact card"}</button>
            </div>
            {sendResult && <p className="adm-sub adm-result" role="status">{sendResult}</p>}
          </>
        ) : (
          <p className="adm-sub">Save a phone number in <Link href="/jobs?alerts=1">Alerts &amp; preferences</Link> first.</p>
        )}
      </section>

      <section className="adm-card">
        <div className="adm-toolbar">
          <h2 className="adm-h">Users <span className="adm-count tnum">{shown.length}</span></h2>
          <input className="adm-input" type="search" placeholder="Search name, email or phone" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search users" />
          <select className="adm-input adm-select" value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Filter users">
            <option value="all">Everyone</option>
            <option value="premium">Premium</option>
            <option value="trial">In free days</option>
            <option value="free">No Premium</option>
            <option value="textsOn">Texts on</option>
          </select>
          <select className="adm-input adm-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort users">
            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </div>

        {!data && !error ? <div className="spinner" /> : (
          <div className="adm-table-wrap">
            <table className="adm-table adm-users">
              <thead>
                <tr><th>User</th><th>Phone</th><th>Plan</th><th>Alerts</th><th className="num">Texts</th><th className="num">Emails</th><th>Last text</th><th className="num">Text cost</th><th>Joined</th></tr>
              </thead>
              <tbody>
                {shown.map((u) => (
                  <FragmentRow key={u.id} u={u} open={open === u.id} onToggle={() => setOpen(open === u.id ? null : u.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data?.costError && <p className="adm-sub">Text cost unavailable: {data.costError}</p>}
      </section>

      <section className="adm-card">
        <h2 className="adm-h">Banks {bankIssues.length > 0 && <span className="adm-pill adm-pill-bad">{bankIssues.length} with errors</span>}</h2>
        {!banks ? <div className="spinner" /> : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Bank</th><th className="num">Live jobs</th><th>Last success</th><th>Last new job</th><th>Error</th></tr></thead>
              <tbody>
                {[...banks].sort((a, b) => Boolean(b.lastError) - Boolean(a.lastError) || (BANKS[a.bank]?.name || a.name).localeCompare(BANKS[b.bank]?.name || b.name)).map((b) => (
                  <tr key={b.bank}>
                    <td>{b.name}</td>
                    <td className="num tnum">{b.live}</td>
                    <td>{ago(b.lastSuccessAt)}</td>
                    <td>{ago(b.lastNewJob)}</td>
                    <td className={b.lastError ? "adm-bad" : "adm-muted"}>{b.lastError ? String(b.lastError).slice(0, 80) : "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FragmentRow({ u, open, onToggle }) {
  const bankNames = u.banks.length ? u.banks.map((k) => BANKS[k]?.shortName || k).join(", ") : "All banks";
  return (
    <>
      <tr className={`adm-row${open ? " is-open" : ""}`} onClick={onToggle}>
        <td className="adm-user">
          <span className="adm-name">{u.name || "(no name)"}</span>
          <a className="adm-email" href={`mailto:${u.email}`} onClick={(e) => e.stopPropagation()}>{u.email}</a>
        </td>
        <td className="adm-nowrap" data-label="Phone">{u.phone ? <a href={`tel:${u.phone}`} onClick={(e) => e.stopPropagation()}>{fmtPhone(u.phone)}</a> : <span className="adm-muted">None</span>}</td>
        <td data-label="Plan"><span className={`adm-pill adm-pill-${u.plan}`}>{PLAN_LABEL[u.plan]}</span></td>
        <td className="adm-nowrap" data-label="Alerts">
          <span className={u.textsOn ? "adm-on" : "adm-muted"}>Texts {u.textsOn ? "on" : "off"}</span>
          <span className={u.emailsOn ? "adm-on" : "adm-muted"}> · Email {u.emailsOn ? "on" : "off"}</span>
        </td>
        <td className="num tnum" data-label="Texts">{u.texts}</td>
        <td className="num tnum" data-label="Emails">{u.emails}</td>
        <td className="adm-nowrap" data-label="Last text">{u.lastTextAt ? ago(u.lastTextAt) : <span className="adm-muted">Never</span>}</td>
        <td className="num tnum" data-label="Text cost">{u.textCost ? money(u.textCost.cost) : <span className="adm-muted">—</span>}</td>
        <td className="adm-nowrap" data-label="Joined">{fmtDate(u.createdAt)}</td>
      </tr>
      {open && (
        <tr className="adm-detail">
          <td colSpan={9}>
            <dl className="adm-dl">
              <div><dt>Preferences saved</dt><dd>{u.hasPrefs ? "Yes" : "No"}</dd></div>
              <div><dt>Roles</dt><dd>{u.jobType === "all" ? "Analyst and internships" : u.jobType}</dd></div>
              <div><dt>Areas</dt><dd>{u.categories.length ? u.categories.join(", ") : "Anything"}</dd></div>
              <div><dt>Banks</dt><dd>{bankNames}</dd></div>
              <div><dt>City</dt><dd>{u.location || "Anywhere"}</dd></div>
              <div><dt>Jobs in texts</dt><dd className="tnum">{u.jobsTexted}</dd></div>
              <div><dt>Last signed in</dt><dd>{u.lastSignInAt ? ago(u.lastSignInAt) : "Never"}</dd></div>
              <div><dt>User ID</dt><dd className="adm-mono">{u.id}</dd></div>
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}
