// This API route calls the JPMC careers API from the server.
// We can't call JPMC's API directly from the browser (CORS blocks it),
// so the browser calls OUR API, and our API calls JPMC's API.

const API_URL =
  "https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions";

const SITE_URL =
  "https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job";

const ANALYSTS_CATEGORY_ID = "300000086153065";
const UNITED_STATES_LOCATION_ID = "300000000289738";

function categorizeJob(title) {
  const t = title.toLowerCase();
  if (/investment\s*bank/.test(t) || t.includes("ibd") || t.includes("m&a") || t.includes("leveraged finance") || t.includes("equity capital market") || t.includes("debt capital market") || t.includes("dcm") || t.includes("ecm")) return "Investment Banking";
  if (t.includes("sales & trading") || t.includes("sales and trading") || t.includes("trading") || t.includes("markets") || t.includes("fixed income") || t.includes("equities") || t.includes("securities") || t.includes("commodit")) return "Sales & Trading";
  if (t.includes("risk") || t.includes("compliance") || t.includes("audit") || t.includes("regulatory")) return "Risk & Compliance";
  if (t.includes("technolog") || t.includes("engineer") || t.includes("developer") || t.includes("software") || t.includes("data sci") || t.includes("cyber") || t.includes("cloud") || t.includes("devops") || t.includes("machine learning") || t.includes("artificial intelligence")) return "Technology";
  if (t.includes("wealth") || t.includes("asset manage") || t.includes("private bank") || t.includes("private client") || t.includes("portfolio")) return "Wealth Management";
  if (t.includes("research") || t.includes("economist") || t.includes("equity research")) return "Research";
  if (t.includes("operations") || /\bops\b/.test(t) || t.includes("middle office") || t.includes("back office")) return "Operations";
  if (t.includes("corporate bank") || t.includes("commercial bank") || t.includes("lending") || t.includes("loan") || t.includes("credit")) return "Corporate Banking";
  if (t.includes("finance") || t.includes("accounting") || t.includes("controller") || t.includes("treasury") || t.includes("tax")) return "Finance";
  if (t.includes("human resources") || t.includes("talent") || t.includes("recruiting")) return "Human Resources";
  if (t.includes("legal") || t.includes("counsel")) return "Legal";
  if (t.includes("quantitative") || t.includes("quant ") || t.includes("strats")) return "Quantitative";
  return "Other";
}

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

  return requisitions.map((req) => {
    const locations = req.secondaryLocations || [];
    const locationNames = locations.map((loc) => loc.Name).filter(Boolean);
    const location = locationNames.length > 0
      ? locationNames.join("; ")
      : req.PrimaryLocation || "";

    const title = req.Title || "N/A";
    return {
      title,
      link: `${SITE_URL}/${req.Id}`,
      location,
      category: categorizeJob(title),
    };
  });
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
