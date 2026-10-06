// The choices behind job alerts, shared by the /start quiz and the Alerts tab so both
// ask the same questions in the same words and save the same settings.

export const JOB_TYPES = [
  { key: "internship", label: "Summer internship", sub: "Sophomores and juniors" },
  { key: "fulltime", label: "Full-time analyst", sub: "Seniors and recent grads" },
  { key: "all", label: "Both", sub: "Show me everything" },
];

// Each option maps to the job categories the scraper assigns.
export const AREAS = [
  { key: "ib", label: "Investment Banking", categories: ["Investment Banking"] },
  { key: "st", label: "Sales & Trading", categories: ["Sales & Trading"] },
  { key: "cb", label: "Corporate Banking", categories: ["Corporate Banking"] },
  { key: "wm", label: "Wealth Management", categories: ["Wealth Management"] },
  { key: "rq", label: "Research & Quant", categories: ["Research", "Quantitative"] },
  { key: "rot", label: "Risk, Ops & Tech", categories: ["Risk & Compliance", "Operations", "Technology"] },
];

export const CITIES = ["New York", "Charlotte", "Dallas", "Chicago", "San Francisco"];

export function isInternship(title) {
  const t = title.toLowerCase();
  return /\bintern\b/.test(t) || t.includes("internship") || t.includes("summer") || t.includes("co-op") || t.includes("coop");
}

// Mirrors the notify cron's filter, so a preview shows what alerts would send.
// prefs: { jobType, categories, banks, location }
export function matchesAlertPrefs(job, prefs) {
  if (prefs.banks.length > 0 && !prefs.banks.includes(job.bankKey)) return false;
  if (prefs.categories.length > 0 && !prefs.categories.includes(job.category)) return false;
  if (prefs.jobType === "internship" && !isInternship(job.title)) return false;
  if (prefs.jobType === "fulltime" && isInternship(job.title)) return false;
  if (prefs.location && !(job.location || "").toLowerCase().includes(prefs.location.toLowerCase())) return false;
  return true;
}
