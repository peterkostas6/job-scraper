// Experience levels, read from the job title. Shared by the browse page, the alert setup and the
// alert cron so every place sorts a role the same way.
//
// Order matters: an internship that mentions a senior word ("Summer Associate") is still an
// internship; "Assistant Vice President" is mid level, not VP; a title with no level words at
// all ("Credit Risk Officer", "Trader") is treated as mid level, since banks put "Analyst",
// "Associate" or "Intern" in nearly every early-career title.

export const LEVELS = [
  { key: "intern", label: "Internship", sub: "Students, summer and off-cycle" },
  { key: "entry", label: "Entry level", sub: "Analyst, new grad, 0–2 years" },
  { key: "mid", label: "Mid level", sub: "Associate, AVP, 2–6 years" },
  { key: "senior", label: "Senior", sub: "VP, Director, MD" },
];
export const LEVEL_LABEL = Object.fromEntries(LEVELS.map((l) => [l.key, l.label]));
export const LEVEL_KEYS = LEVELS.map((l) => l.key);

// What existing alert users had before levels existed: internships and analyst roles.
export const DEFAULT_ALERT_LEVELS = ["intern", "entry"];

const INTERN = /\bintern(s|ship|ships)?\b|\bsummer\b|\bco-?op\b|off[- ]cycle|\bplacement\b|\bapprentice(ship)?\b|\bwinter analyst\b|\bspring (week|insight)\b|\binsight (program|week)\b/;
const MID_BEFORE_SENIOR = /\bassistant vice president\b|\bavp\b/;
const SENIOR = /\bmanaging director\b|\bexecutive director\b|\bdirector\b|\bvice president\b|\b[se]?vp\b|\bhead of\b|\bchief\b|\bprincipal\b|\bpartner\b(?! program)|\bsenior manager\b/;
const MID = /\bassociate\b|\bmba\b|\bsenior\b|\bsr\.?\b|\blead\b|\bmanager\b|\bspecialist\b|\bofficer\b|\bconsultant\b|\badvisor\b|\badviser\b|\bexperienced\b|\b(ii|iii|iv)\b|\b[2-9]\+? years\b/;
const ENTRY = /\banalyst\b|\bjunior\b|\bjr\.?\b|\btrainee\b|\bnew grad|\bgraduate\b|\bentry[- ]level\b|\bearly career\b|\bcampus\b|\brotational\b|\bdevelopment program\b|\bleadership program\b|\bassistant\b|\bclerk\b|\bcoordinator\b|\b(i|1)\b$/;

export function jobLevel(title) {
  const t = (title || "").toLowerCase();
  if (INTERN.test(t)) return "intern";
  if (MID_BEFORE_SENIOR.test(t)) return "mid";
  if (SENIOR.test(t)) return "senior";
  // "Senior Analyst", "Analyst II", "Associate": mid. Plain "Analyst": entry.
  if (MID.test(t)) return "mid";
  if (ENTRY.test(t)) return "entry";
  return "mid";
}

// Alert prefs saved before levels existed only have jobType; map it to the same roles they got.
export function levelsFromPrefs(prefs) {
  const saved = Array.isArray(prefs?.levels) ? prefs.levels.filter((k) => LEVEL_KEYS.includes(k)) : [];
  if (saved.length) return saved;
  if (prefs?.jobType === "internship") return ["intern"];
  if (prefs?.jobType === "fulltime") return ["entry"];
  return DEFAULT_ALERT_LEVELS;
}
