// GET /api/jobs-db — fetches Deutsche Bank US jobs from beesite API
// Two sources: Professional roles + Student/Graduate programmes
const PROF_URL = "https://api-deutschebank.beesite.de/search";
const GRAD_URL = "https://api-deutschebank.beesite.de/graduatesearch";
const PROF_BASE = "https://careers.db.com/professionals/search-roles/#/professional/job/";
const US_COUNTRY = "231";

const FIELDS = [
  "PositionID",
  "PositionTitle",
  "PositionURI",
  "PositionLocation.CityName",
  "PositionLocation.Country",
  "CareerLevel.Name",
  "PublicationStartDate",
];

function categorizeJob(title) {
  const t = title.toLowerCase();
  if (/investment\s*bank/.test(t) || t.includes("ibd") || t.includes("m&a") || t.includes("leveraged finance") || t.includes("ecm") || t.includes("dcm")) return "Investment Banking";
  if (t.includes("sales & trading") || t.includes("sales and trading") || t.includes("trading") || t.includes("markets") || t.includes("fixed income") || t.includes("equities") || t.includes("securities") || t.includes("commodit")) return "Sales & Trading";
  if (t.includes("risk") || t.includes("compliance") || t.includes("audit") || t.includes("regulatory")) return "Risk & Compliance";
  if (t.includes("technolog") || t.includes("engineer") || t.includes("developer") || t.includes("software") || t.includes("data sci") || t.includes("cyber") || t.includes("cloud")) return "Technology";
  if (t.includes("wealth") || t.includes("asset manage") || t.includes("private bank") || t.includes("private client") || t.includes("portfolio")) return "Wealth Management";
  if (t.includes("research") || t.includes("economist")) return "Research";
  if (t.includes("operations") || /\bops\b/.test(t) || t.includes("middle office") || t.includes("back office")) return "Operations";
  if (t.includes("corporate bank") || t.includes("commercial bank") || t.includes("lending") || t.includes("loan") || t.includes("credit")) return "Corporate Banking";
  if (t.includes("finance") || t.includes("accounting") || t.includes("controller") || t.includes("treasury") || t.includes("tax")) return "Finance";
  if (t.includes("human resources") || t.includes("talent") || t.includes("recruiting")) return "Human Resources";
  if (t.includes("legal") || t.includes("counsel")) return "Legal";
  if (t.includes("quantitative") || t.includes("quant ") || t.includes("strats")) return "Quantitative";
  return "Other";
}

function buildPayload(countryCode, maxItems) {
  return {
    LanguageCode: "EN",
    SearchParameters: {
      FirstItem: 1,
      CountItem: maxItems,
      MatchedObjectDescriptor: FIELDS,
      Sort: [{ Criterion: "PublicationStartDate", Direction: "DESC" }],
    },
    SearchCriteria: [
      { CriterionName: "PositionLocation.Country", CriterionValue: String(countryCode) },
    ],
  };
}

async function fetchJobs(endpoint, countryCode, maxItems) {
  const data = buildPayload(countryCode, maxItems);
  const url = `${endpoint}/?data=${encodeURIComponent(JSON.stringify(data))}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DB API ${endpoint} returned ${res.status}`);
  const json = await res.json();
  return json.SearchResult;
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [prof, grad] = await Promise.all([
      fetchJobs(PROF_URL, US_COUNTRY, 500),
      fetchJobs(GRAD_URL, US_COUNTRY, 100),
    ]);

    const jobs = [];
    const seen = new Set();

    // Professional jobs — link to careers.db.com SPA
    // Only include analyst/intern level, exclude associate and above
    const EXCLUDE_LEVELS = new Set(["associate", "avp", "vp", "vice president", "director", "managing director", "md"]);
    function isJuniorRole(item) {
      const level = (item.MatchedObjectDescriptor?.CareerLevel?.Name || "").toLowerCase();
      const title = (item.MatchedObjectDescriptor?.PositionTitle || "").toLowerCase();
      if (EXCLUDE_LEVELS.has(level)) return false;
      if (/\bassociate\b/.test(title) && !/\banalyst\b/.test(title) && !/\bintern\b/.test(title)) return false;
      return true;
    }

    for (const item of prof.SearchResultItems || []) {
      if (!isJuniorRole(item)) continue;
      const d = item.MatchedObjectDescriptor;
      const id = d.PositionID;
      const link = PROF_BASE + id;
      if (seen.has(id)) continue;
      seen.add(id);
      const city = d.PositionLocation?.[0]?.CityName || "";
      jobs.push({ title: d.PositionTitle, link, location: city, category: categorizeJob(d.PositionTitle) });
    }

    // Graduate/intern programmes — use full external URL from API
    for (const item of grad.SearchResultItems || []) {
      const d = item.MatchedObjectDescriptor;
      const id = d.PositionID;
      if (seen.has(id)) continue;
      seen.add(id);
      const link = d.PositionURI?.startsWith("http")
        ? d.PositionURI
        : PROF_BASE + id;
      const city = d.PositionLocation?.[0]?.CityName || "";
      jobs.push({ title: d.PositionTitle, link, location: city, category: categorizeJob(d.PositionTitle) });
    }

    return Response.json({ jobs, count: jobs.length });
  } catch (err) {
    console.error("Deutsche Bank API error:", err);
    return Response.json(
      { error: "Failed to fetch Deutsche Bank jobs" },
      { status: 500 }
    );
  }
}
