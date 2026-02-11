// This API route calls the Goldman Sachs careers GraphQL API from the server.
// Same idea as the JPMC route — browser can't call GS directly (CORS),
// so our server makes the request on behalf of the browser.

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
    .map((item) => ({
      title: item.jobTitle || item.corporateTitle || "N/A",
      link: `${GS_SITE_URL}/${item.roleId}`,
    }));

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
