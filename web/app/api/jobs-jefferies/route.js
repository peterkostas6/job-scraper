// GET /api/jobs-jefferies — fetches Jefferies analyst & intern jobs from Oracle HCM

export const dynamic = "force-dynamic";

const API_URL =
  "https://hdid.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions";

const SITE_URL =
  "https://hdid.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job";

const UNITED_STATES_LOCATION_ID = "300000000361862";

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJobsPage(offset = 0) {
  const finder = [
    "siteNumber=CX_1",
    "limit=25",
    `offset=${offset}`,
    "sortBy=POSTING_DATES_DESC",
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

  if (!response.ok) throw new Error(`Jefferies API returned ${response.status}`);
  return response.json();
}

export async function GET() {
  try {
    const allJobs = [];
    let offset = 0;

    while (true) {
      const data = await fetchJobsPage(offset);
      const items = data.items || [{}];
      const requisitions = (items[0] || {}).requisitionList || [];

      if (requisitions.length === 0) break;

      for (const req of requisitions) {
        const title = req.Title || "N/A";
        const t = title.toLowerCase();

        if (!t.includes("analyst") && !t.includes("intern") && !t.includes("summer") && !t.includes("associate") && !t.includes("trainee")) continue;
        if (/graduate\s*program|grad\s*prog|grad\s*programme/.test(t)) continue;

        const locations = req.secondaryLocations || [];
        const locationNames = locations.map((loc) => loc.Name).filter(Boolean);
        const location = locationNames.length > 0 ? locationNames.join("; ") : req.PrimaryLocation || "";

        allJobs.push({
          title,
          link: `${SITE_URL}/${req.Id}`,
          location,
          category: categorizeJob(title),
          postedDate: req.PostedDate || null,
        });
      }

      if (offset + 25 >= (data.items?.[0]?.TotalJobsCount ?? 0)) break;
      offset += 25;
      await sleep(1000);
    }

    return Response.json({ jobs: allJobs, count: allJobs.length });
  } catch (err) {
    console.error("Jefferies API error:", err);
    return Response.json({ error: "Failed to fetch Jefferies jobs" }, { status: 500 });
  }
}
