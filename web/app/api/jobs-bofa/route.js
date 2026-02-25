// This API route fetches Bank of America analyst jobs from two sources:
// 1. Campus portal (TAL.net) — internships and summer analyst programs
// 2. Workday (lateral-us) — full-time analyst roles
// Both are combined and filtered to US-only positions.

const CAMPUS_URL =
  "https://bankcampuscareers.tal.net/vx/lang-en-GB/mobile-0/brand-4/xf-3d2c04c04723/candidate/jobboard/vacancy/1/adv/?ftq=analyst&fc=2&fl=6&offset=0&num_items=100&f_Item_Coverage=2";

const WORKDAY_URL =
  "https://ghr.wd1.myworkdayjobs.com/wday/cxs/ghr/lateral-us/jobs";

const WORKDAY_SITE =
  "https://ghr.wd1.myworkdayjobs.com/en-US/lateral-us";

// US state abbreviations and city names for filtering campus portal results
const US_MARKERS = [
  " ny", " ca", " il", " tx", " fl", " ma", " nj", " nc", " dc",
  "new york", "chicago", "houston", "los angeles", "san francisco",
  "charlotte", "miami", "boston", "dallas", "jersey city",
  "pennington", "palo alto", "washington", "jacksonville",
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

// --- CAMPUS PORTAL (internships) ---

async function fetchCampusJobs() {
  const response = await fetch(CAMPUS_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    },
  });

  if (!response.ok) {
    throw new Error(`BofA TAL.net returned ${response.status}`);
  }

  const html = await response.text();
  const jobs = [];

  const rowRegex = /<a\s+href="(https:\/\/bankcampuscareers\.tal\.net\/[^"]*\/opp\/\d+-[^"]*)"[^>]*>\s*([^<]+)\s*<\/a>\s*<\/td>\s*<td[^>]*>\s*([^<]*)\s*<\/td>\s*<\/tr>/gi;

  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const link = match[1];
    const title = match[2].trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    const location = match[3].trim();

    jobs.push({ title, link, location, category: categorizeJob(title) });
  }

  // Filter to US only
  return jobs.filter((job) => {
    const loc = (job.location || "").toLowerCase();
    return US_MARKERS.some((marker) => loc.includes(marker));
  });
}

// --- WORKDAY (full-time) ---

async function fetchWorkdayPage(offset = 0) {
  const response = await fetch(WORKDAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    },
    body: JSON.stringify({
      appliedFacets: {},
      limit: 20,
      offset,
      searchText: "analyst",
    }),
  });

  if (!response.ok) {
    throw new Error(`BofA Workday API returned ${response.status}`);
  }

  return response.json();
}

function parseWorkdayJobs(data) {
  const postings = data.jobPostings || [];

  return postings
    .filter((job) => {
      const title = (job.title || "").toLowerCase();
      return title.includes("analyst");
    })
    .map((job) => {
      const title = job.title || "N/A";
      return {
        title,
        link: `${WORKDAY_SITE}${job.externalPath}`,
        location: job.locationsText || "",
        category: categorizeJob(title),
        postedDate: parseWorkdayDate(job.postedOn),
      };
    });
}

async function fetchFullTimeJobs() {
  const allJobs = [];
  let offset = 0;

  while (true) {
    const data = await fetchWorkdayPage(offset);
    const total = data.total || 0;
    const jobs = parseWorkdayJobs(data);

    allJobs.push(...jobs);

    if (offset + 20 >= total) break;

    offset += 20;
    await sleep(1000);
  }

  return allJobs;
}

// --- COMBINED ---

// GET /api/jobs-bofa — returns all BofA analyst jobs in the US as JSON
export async function GET() {
  // Fetch both sources in parallel
  const [campusJobs, fullTimeJobs] = await Promise.all([
    fetchCampusJobs(),
    fetchFullTimeJobs(),
  ]);

  const allJobs = [...campusJobs, ...fullTimeJobs];

  return Response.json({ jobs: allJobs, count: allJobs.length });
}
