"use client";

// The app's Request tab: search first. Firms we already track show as tracked (tap to see their
// roles); anything else gets one Request button. Below: the firms most people have asked for, and
// this person's own requests, marked Added once that firm shows up in the firm list.
import { useEffect, useMemo, useState } from "react";
import { ALL_FIRMS } from "@/lib/firms";
import { capture } from "@/lib/analytics";
import BankLogo from "@/lib/bank-logo";

const norm = (s) => (s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
const FIRMS = Object.entries(ALL_FIRMS).map(([key, f]) => ({ key, name: f.name, short: f.shortName || f.name, n: norm(f.name), ns: norm(f.shortName || f.name) }));
// A requested name counts as tracked when it and a firm's name start the same way ("Houlihan" ~ "Houlihan Lokey").
const trackedFirm = (name) => {
  const q = norm(name);
  if (q.length < 2) return null;
  return FIRMS.find((f) => f.n === q || f.ns === q || f.n.startsWith(`${q} `) || q.startsWith(`${f.n} `) || q === f.n.split(" ")[0] && f.n.split(" ").length > 1 && q.length > 4) || null;
};
const when = (at) => {
  const d = new Date(at);
  const days = Math.floor((Date.now() - d.getTime()) / 864e5);
  return days < 1 ? "Today" : days < 2 ? "Yesterday" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function RequestPage({ counts, onOpenFirm }) {
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(null); // null while loading
  const [popular, setPopular] = useState([]);
  const [sending, setSending] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/company-request")
      .then((r) => (r.ok ? r.json() : { mine: [], popular: [] }))
      .then((d) => { setMine(d.mine || []); setPopular(d.popular || []); })
      .catch(() => setMine([]));
  }, []);

  const query = q.trim();
  const requested = useMemo(() => new Set((mine || []).map((r) => norm(r.company))), [mine]);
  const matches = useMemo(() => {
    const nq = norm(query);
    if (nq.length < 2) return [];
    return FIRMS.filter((f) => f.n.includes(nq) || f.ns.includes(nq))
      .sort((a, b) => (b.n.startsWith(nq) - a.n.startsWith(nq)) || (counts[b.key] || 0) - (counts[a.key] || 0))
      .slice(0, 5);
  }, [query, counts]);
  const exact = trackedFirm(query);
  const canRequest = query.length >= 2 && !exact;
  const alreadyAsked = requested.has(norm(query));
  const popularOpen = popular.filter((p) => !trackedFirm(p.company) && !requested.has(norm(p.company))).slice(0, 6);

  async function send(name) {
    const company = name.trim();
    if (!company || sending) return;
    setSending(company); setError("");
    const res = await fetch("/api/company-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setSending("");
    if (!res?.ok) { setError(data?.error || "Couldn’t send your request. Try again."); return; }
    capture("bank_requested", { company, where: "app_request_tab" });
    setMine((m) => [{ company, at: new Date().toISOString(), fresh: true }, ...(m || [])]);
  }

  return (
    <div className="rq">
      <h1 className="rq-title">Request a firm</h1>
      <p className="rq-sub">Search first. If we don&rsquo;t track it yet, one tap asks us to add it.</p>
      <label className="rq-search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
        <input type="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" placeholder="Firm name" aria-label="Firm name" value={q} maxLength={100}
          onChange={(e) => { setQ(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); if (canRequest && !alreadyAsked) send(query); } }} />
        {q && <button type="button" className="rq-clear" aria-label="Clear" onClick={() => setQ("")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>}
      </label>

      {query.length >= 2 && (
        <div className="rq-results" key={norm(query).slice(0, 3)}>
          {matches.map((f, i) => (
            <button type="button" key={f.key} className="rq-row" style={{ animationDelay: `${i * 35}ms` }} onClick={() => { capture("request_tracked_firm_opened", { firm: f.key }); onOpenFirm(f.key); }}>
              <BankLogo bankKey={f.key} bank={f.name} size={30} />
              <span className="rq-row-text"><strong>{f.name}</strong><small>{counts[f.key] ? `${counts[f.key]} open ${counts[f.key] === 1 ? "role" : "roles"}` : "Tracked"}</small></span>
              <span className="rq-tracked">Tracked ✓</span>
            </button>
          ))}
          {canRequest && (
            <div className="rq-row rq-row-ask" style={{ animationDelay: `${matches.length * 35}ms` }}>
              <span className="rq-row-text"><strong>{query}</strong><small>{alreadyAsked ? "You’ve asked for this one" : "Not tracked yet"}</small></span>
              {alreadyAsked
                ? <span className="rq-done">Requested</span>
                : <button type="button" className="rq-ask" disabled={Boolean(sending)} onClick={() => send(query)}>{sending ? "Sending…" : "Request"}</button>}
            </div>
          )}
        </div>
      )}
      {error && <p className="rq-error" role="alert">{error}</p>}

      {query.length < 2 && popularOpen.length > 0 && (
        <section className="rq-sec">
          <h2 className="rq-h">Popular requests</h2>
          <div className="rq-chips">
            {popularOpen.map((p) => <button type="button" key={p.company} className="rq-chip" onClick={() => setQ(p.company)}>{p.company}</button>)}
          </div>
        </section>
      )}

      <section className="rq-sec">
        <h2 className="rq-h">Your requests</h2>
        {mine === null ? <p className="rq-empty">Loading…</p>
          : mine.length === 0 ? <p className="rq-empty">Nothing yet. Search for a firm above.</p>
          : (
            <ul className="rq-mine">
              {mine.map((r) => {
                const firm = trackedFirm(r.company);
                const inner = (
                  <>
                    <span className={`rq-dot${firm ? " is-added" : ""}`} aria-hidden="true" />
                    <span className="rq-row-text"><strong>{firm ? firm.name : r.company}</strong><small>{firm ? "Added. Its roles are in Jobs" : r.fresh ? "Requested. We’ll add it if we can" : "Requested"}</small></span>
                    <span className="rq-when">{when(r.at)}</span>
                  </>
                );
                return (
                  <li key={`${r.company}-${r.at}`} className={r.fresh ? "is-fresh" : ""}>
                    {firm ? <button type="button" className="rq-mine-row" onClick={() => onOpenFirm(firm.key)}>{inner}</button> : <div className="rq-mine-row">{inner}</div>}
                  </li>
                );
              })}
            </ul>
          )}
      </section>
    </div>
  );
}
