"use client";

// Every firm the site covers (lib/firms.js), searchable and grouped by type, for the Browse
// filter panel and the alert bank pickers (/start and the Alerts panel). With 350+ firms a flat
// list of buttons doesn't work: each type shows its first firms until "Show all" is opened.
// chipClass keeps each page's own button style; `on(key)` says which are selected.
import { useState } from "react";
import BankLogo from "@/lib/bank-logo";
import { BANKS } from "@/lib/banks";
import { ALL_FIRMS, FIRM_TYPES } from "@/lib/firms";

const PER_GROUP = 12;

// Original banks first (in lib/banks.js order), then the rest A–Z, within each type.
const GROUPS = FIRM_TYPES.map((t) => ({
  ...t,
  keys: [
    ...(t.key === "bank" ? Object.keys(BANKS) : []),
    ...Object.keys(ALL_FIRMS).filter((k) => !BANKS[k] && ALL_FIRMS[k].type === t.key).sort((a, b) => ALL_FIRMS[a].name.localeCompare(ALL_FIRMS[b].name)),
  ],
})).filter((g) => g.keys.length > 0);

export default function FirmPicker({ on, onPick, chipClass, counts, searchClass = "firm-search" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState({});
  const q = query.trim().toLowerCase();
  const matches = (k) => !q || ALL_FIRMS[k].name.toLowerCase().includes(q) || (ALL_FIRMS[k].shortName || "").toLowerCase().includes(q);

  return (
    <div className="firm-picker">
      <input className={searchClass} type="search" placeholder="Search firms" aria-label="Search firms" value={query} onChange={(e) => setQuery(e.target.value)} />
      {GROUPS.map((g) => {
        const keys = g.keys.filter(matches);
        if (keys.length === 0) return null;
        const shown = q || open[g.key] ? keys : keys.slice(0, PER_GROUP);
        return (
          <div key={g.key} className="firm-group">
            <p className="firm-group-label">{g.label} <span>{keys.length}</span></p>
            <div className="firm-group-chips">
              {shown.map((k) => (
                <button key={k} type="button" className={chipClass} aria-pressed={on(k)} onClick={() => onPick(k)}>
                  <BankLogo bankKey={k} bank={ALL_FIRMS[k].name} size={16} />
                  {ALL_FIRMS[k].shortName || ALL_FIRMS[k].name}
                  {counts && counts[k] > 0 && <span className="firm-count tnum">{counts[k]}</span>}
                </button>
              ))}
              {!q && keys.length > PER_GROUP && (
                <button type="button" className="firm-more" onClick={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}>
                  {open[g.key] ? "Show fewer" : `Show all ${keys.length}`}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {GROUPS.every((g) => !g.keys.some(matches)) && <p className="firm-empty">No firm matches &ldquo;{query.trim()}&rdquo;</p>}
    </div>
  );
}
