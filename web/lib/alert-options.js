import { jobLevel, levelsFromPrefs } from "./levels";
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
// Every city with a good number of live roles (about 50+ in Nov 2026), A to Z. The app offers all
// of them; the website keeps the short list above. Dallas covers Plano and Irving.
export const ALL_CITIES = [
  "Atlanta", "Austin", "Baltimore", "Boston", "Buffalo", "Charlotte", "Chicago", "Cincinnati",
  "Columbus", "Dallas", "Denver", "Greenwich", "Houston", "Jacksonville", "Jersey City",
  "Los Angeles", "Malvern", "McLean", "Minneapolis", "New York", "Newark", "Pittsburgh", "Quincy",
  "Saint Petersburg", "Salt Lake City", "San Antonio", "San Diego", "San Francisco", "Tampa",
  "Washington", "Westlake", "Wilmington",
];

// Someone can pick several cities; they're saved as one string, "Chicago; New York".
export const splitCities = (location) => (location || "").split(";").map((c) => c.trim()).filter(Boolean);
export const joinCities = (cities) => cities.join("; ");

export function isInternship(title) {
  const t = title.toLowerCase();
  return /\bintern\b/.test(t) || t.includes("internship") || t.includes("summer") || t.includes("co-op") || t.includes("coop");
}

// What people type for a city -> the words banks use for it in job locations.
// "NYC", "Manhattan" or "New York, NY" all match a job in "New York, NY, United States".
const CITY_ALIASES = [
  { typed: ["new york", "new york city", "nyc", "ny", "manhattan"], job: ["new york", "nyc", "manhattan"] },
  { typed: ["san francisco", "sf", "san fran", "bay area"], job: ["san francisco"] },
  { typed: ["dallas", "dfw", "dallas fort worth", "irving", "plano"], job: ["dallas", "irving", "plano", "fort worth"] },
  { typed: ["chicago", "chi"], job: ["chicago"] },
  { typed: ["charlotte", "clt"], job: ["charlotte"] },
  { typed: ["los angeles", "la"], job: ["los angeles"] },
  { typed: ["washington", "washington dc", "dc", "d.c."], job: ["washington"] },
  { typed: ["boston"], job: ["boston"] },
  { typed: ["london"], job: ["london"] },
];

// True when a job's location fits the city someone typed, or any of several (blank = anywhere).
export function locationMatches(jobLocation, typed) {
  const cities = splitCities(typed);
  if (cities.length > 1) return cities.some((c) => locationMatches(jobLocation, c));
  const want = (typed || "").trim().toLowerCase();
  if (!want) return true;
  const loc = (jobLocation || "").toLowerCase();
  const city = want.split(",")[0].trim(); // "New York, NY" -> "new york"
  const group = CITY_ALIASES.find((g) => g.typed.includes(city) || g.typed.includes(want));
  if (group) return group.job.some((w) => loc.includes(w));
  return loc.includes(city);
}

// Mirrors the notify cron's filter, so a preview shows what alerts would send.
// prefs: { jobType, categories, banks, location }
export function matchesAlertPrefs(job, prefs) {
  if (prefs.banks.length > 0 && !prefs.banks.includes(job.bankKey)) return false;
  if (prefs.categories.length > 0 && !prefs.categories.includes(job.category)) return false;
  if (!levelsFromPrefs(prefs).includes(jobLevel(job.title))) return false;
  if (!locationMatches(job.location, prefs.location)) return false;
  return true;
}
