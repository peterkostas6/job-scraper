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
    for (const item of prof.SearchResultItems || []) {
      const d = item.MatchedObjectDescriptor;
      const id = d.PositionID;
      const link = PROF_BASE + id;
      if (seen.has(id)) continue;
      seen.add(id);
      const city = d.PositionLocation?.[0]?.CityName || "";
      jobs.push({ title: d.PositionTitle, link, location: city });
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
      jobs.push({ title: d.PositionTitle, link, location: city });
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
