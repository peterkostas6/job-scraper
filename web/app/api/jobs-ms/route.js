// This API route calls the Morgan Stanley careers API (Workday) from the server.
// Morgan Stanley uses Workday for their job listings at ms.wd5.myworkdayjobs.com.

const MS_API_URL =
  "https://ms.wd5.myworkdayjobs.com/wday/cxs/ms/External/jobs";

const MS_SITE_URL =
  "https://ms.wd5.myworkdayjobs.com/en-US/External";

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

// Convert Workday relative date strings ("Posted Today", "Posted 7 Days Ago") to ISO date
function parseWorkdayDate(postedOn) {
  if (!postedOn) return null;
  const s = postedOn.toLowerCase().trim();
  const now = new Date();
  if (s === "posted today") return now.toISOString().split("T")[0];
  if (s === "posted yesterday") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }
  const m = s.match(/posted (\d+)\+? days? ago/);
  if (m) {
    const d = new Date(now);
    d.setDate(d.getDate() - parseInt(m[1]));
    return d.toISOString().split("T")[0];
  }
  return null;
}

// Helper: pause for a given number of milliseconds
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch one page of 20 jobs from the Workday API
async function fetchJobsPage(offset = 0) {
  const body = {
    appliedFacets: {},
    limit: 20,
    offset,
    searchText: "analyst",
  };

  const response = await fetch(MS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`MS Workday API returned ${response.status}`);
  }

  return response.json();
}

// Parse jobs out of the Workday API response, filtering to US analyst roles only
function parseJobs(data) {
  const postings = data.jobPostings || [];

  return postings
    .filter((job) => {
      const title = (job.title || "").toLowerCase();
      const loc = (job.locationsText || "").toLowerCase();

      // Title must contain "analyst"
      const isAnalyst = title.includes("analyst");

      // Location must be in the United States
      const isUS =
        loc.includes("united states") ||
        loc.includes(", ny") ||
        loc.includes("new york") ||
        loc.includes(", tx") ||
        loc.includes(", ca") ||
        loc.includes(", il") ||
        loc.includes(", ma") ||
        loc.includes(", ga") ||
        loc.includes(", md") ||
        loc.includes(", dc") ||
        loc.includes(", fl") ||
        loc.includes(", ct") ||
        loc.includes("americas");

      return isAnalyst && isUS;
    })
    .map((job) => {
      const title = job.title || "N/A";
      return {
        title,
        link: `${MS_SITE_URL}${job.externalPath}`,
        location: job.locationsText || "",
        category: categorizeJob(title),
        postedDate: parseWorkdayDate(job.postedOn),
      };
    });
}

// GET /api/jobs-ms — returns all MS analyst jobs in the US as JSON
export async function GET() {
  const allJobs = [];
  let offset = 0;

  while (true) {
    const data = await fetchJobsPage(offset);
    const total = data.total || 0;
    const jobs = parseJobs(data);

    allJobs.push(...jobs);

    // Check if we've fetched all pages
    if (offset + 20 >= total) break;

    offset += 20;

    // Pause 1 second between pages
    await sleep(1000);
  }

  return Response.json({ jobs: allJobs, count: allJobs.length });
}
