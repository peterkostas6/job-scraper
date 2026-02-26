// This API route calls the Goldman Sachs careers GraphQL API from the server.
// Same idea as the JPMC route — browser can't call GS directly (CORS),
// so our server makes the request on behalf of the browser.

export const dynamic = "force-dynamic";

const GS_API_URL = "https://api-higher.gs.com/gateway/api/v1/graphql";
const GS_SITE_URL = "https://higher.gs.com/roles";

const GS_QUERY = `query GetRoles($searchQueryInput: RoleSearchQueryInput!) {
  roleSearch(searchQueryInput: $searchQueryInput) {
    totalCount
    items {
      roleId
      corporateTitle
      jobTitle
      jobFunction
      locations {
        primary
        state
        country
        city
        __typename
      }
      status
      division
      skills
      jobType {
        code
        description
        __typename
      }
      externalSource {
        sourceId
        __typename
      }
      __typename
    }
    __typename
  }
}`;

function categorizeJob(title, division, jobFunction) {
  // Use GS division/jobFunction fields first if available
  const d = (division || "").toLowerCase();
  const f = (jobFunction || "").toLowerCase();
  if (d.includes("investment banking") || f.includes("investment banking")) return "Investment Banking";
  if (d.includes("global markets") || d.includes("trading") || f.includes("trading") || f.includes("markets")) return "Sales & Trading";
  if (d.includes("risk") || f.includes("risk") || f.includes("compliance") || f.includes("audit")) return "Risk & Compliance";
  if (d.includes("engineering") || d.includes("technology") || f.includes("engineer") || f.includes("technology")) return "Technology";
  if (d.includes("asset management") || d.includes("wealth") || f.includes("asset management") || f.includes("wealth") || f.includes("portfolio")) return "Wealth Management";
  if (d.includes("research") || f.includes("research")) return "Research";
  if (d.includes("operations") || f.includes("operations")) return "Operations";
  if (f.includes("finance") || f.includes("controller") || f.includes("treasury") || f.includes("tax")) return "Finance";
  if (f.includes("legal") || f.includes("counsel")) return "Legal";
  if (f.includes("human") || f.includes("talent") || f.includes("recruiting")) return "Human Resources";
  if (d.includes("quantitative") || f.includes("quant") || f.includes("strats")) return "Quantitative";

  // Fallback to title keywords
  const t = title.toLowerCase();
  if (/investment\s*bank/.test(t) || t.includes("ibd") || t.includes("m&a")) return "Investment Banking";
  if (t.includes("trading") || t.includes("markets") || t.includes("fixed income") || t.includes("equities") || t.includes("securities")) return "Sales & Trading";
  if (t.includes("risk") || t.includes("compliance") || t.includes("audit")) return "Risk & Compliance";
  if (t.includes("technolog") || t.includes("engineer") || t.includes("software") || t.includes("data sci") || t.includes("cyber")) return "Technology";
  if (t.includes("wealth") || t.includes("asset manage") || t.includes("private bank")) return "Wealth Management";
  if (t.includes("research") || t.includes("economist")) return "Research";
  if (t.includes("operations") || /\bops\b/.test(t)) return "Operations";
  if (t.includes("finance") || t.includes("accounting") || t.includes("controller") || t.includes("treasury")) return "Finance";
  if (t.includes("quantitative") || t.includes("quant ") || t.includes("strats")) return "Quantitative";
  return "Other";
}

// Helper: pause for a given number of milliseconds
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch one page of 20 jobs from the GS GraphQL API
async function fetchJobsPage(pageNumber = 0) {
  const body = {
    operationName: "GetRoles",
    variables: {
      searchQueryInput: {
        page: { pageSize: 20, pageNumber },
        sort: { sortStrategy: "RELEVANCE", sortOrder: "DESC" },
        filters: [],
        experiences: ["EARLY_CAREER", "PROFESSIONAL"],
        searchTerm: "analyst",
      },
    },
    query: GS_QUERY,
  };

  const response = await fetch(GS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      Origin: "https://higher.gs.com",
      Referer: "https://higher.gs.com/",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`GS API returned ${response.status}`);
  }

  return response.json();
}

// Parse jobs out of the GraphQL response, filtering to US only
function parseJobs(data) {
  const results = data?.data?.roleSearch;
  if (!results || !results.items) return { jobs: [], totalCount: 0 };

  const usJobs = results.items
    .filter((item) => {
      // Keep jobs where at least one location is in the United States
      return item.locations?.some(
        (loc) => loc.country === "United States" || loc.country === "US"
      );
    })
    .map((item) => {
      // The roleId has a suffix like "_GS_MID_CAREER" — strip it to get just the number
      const numericId = item.roleId?.split("_")[0] || item.roleId;

      const usLocations = (item.locations || [])
        .filter((loc) => loc.country === "United States" || loc.country === "US");
      const location = usLocations
        .map((loc) => [loc.city, loc.state].filter(Boolean).join(", "))
        .join("; ");

      const title = item.jobTitle || item.corporateTitle || "N/A";
      return {
        title,
        link: `${GS_SITE_URL}/${numericId}`,
        location,
        category: categorizeJob(title, item.division, item.jobFunction),
      };
    });

  return { jobs: usJobs, totalCount: results.totalCount };
}

// GET /api/jobs-gs — returns all GS analyst jobs in the US as JSON
export async function GET() {
  const allJobs = [];
  let pageNumber = 0;

  while (true) {
    const data = await fetchJobsPage(pageNumber);
    const { jobs, totalCount } = parseJobs(data);

    allJobs.push(...jobs);

    // Check if we've fetched all pages
    const totalFetched = (pageNumber + 1) * 20;
    if (totalFetched >= totalCount || jobs.length === 0) break;

    pageNumber++;

    // Pause 1 second between pages
    await sleep(1000);
  }

  return Response.json({ jobs: allJobs, count: allJobs.length });
}
