// This API route calls the JPMC careers API from the server.
// We can't call JPMC's API directly from the browser (CORS blocks it),
// so the browser calls OUR API, and our API calls JPMC's API.

const API_URL =
  "https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions";

const SITE_URL =
  "https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job";

const ANALYSTS_CATEGORY_ID = "300000086153065";
const UNITED_STATES_LOCATION_ID = "300000000289738";

// Helper: pause for a given number of milliseconds
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch one page of 25 jobs from the JPMC API
async function fetchJobsPage(offset = 0) {
  const finder = [
    "siteNumber=CX_1001",
    "limit=25",
    `offset=${offset}`,
    "sortBy=POSTING_DATES_DESC",
    `selectedCategoriesFacet=${ANALYSTS_CATEGORY_ID}`,
    `selectedLocationsFacet=${UNITED_STATES_LOCATION_ID}`,
  ].join(",");

  const params = new URLSearchParams({
    onlyData: "true",
    expand: "requisitionList.secondaryLocations",
    finder: `findReqs;${finder}`,
  });

  const response = await fetch(`${API_URL}?${params}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    },
  });

  if (!response.ok) {
    throw new Error(`JPMC API returned ${response.status}`);
  }

  return response.json();
}

// Parse jobs out of the raw API response
function parseJobs(data) {
  const items = data.items || [{}];
  if (!items.length) return [];

  const requisitions = items[0].requisitionList || [];

  return requisitions.map((req) => ({
    title: req.Title || "N/A",
    link: `${SITE_URL}/${req.Id}`,
  }));
}

// GET /api/jobs — returns all analyst jobs as JSON
export async function GET() {
  const allJobs = [];
  let offset = 0;

  while (true) {
    const data = await fetchJobsPage(offset);
    const jobs = parseJobs(data);

    if (jobs.length === 0) break;

    allJobs.push(...jobs);
    offset += 25;

    // Pause 1 second between pages so the JPMC API doesn't stall
    if (jobs.length === 25) {
      await sleep(1000);
    }
  }

  return Response.json({ jobs: allJobs, count: allJobs.length });
}
