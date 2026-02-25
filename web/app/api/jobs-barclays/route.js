// GET /api/jobs-barclays — fetches Barclays US analyst & intern jobs from TalentBrew API
// Two sources: Early Careers category + keyword "analyst" (for analyst-titled non-intern roles)
const BASE_URL = "https://search.jobs.barclays";
const API_URL = `${BASE_URL}/search-jobs/results`;

const US_FILTER = { ID: "6252001", FacetType: 2, IsApplied: true, FieldName: "" };
const EARLY_CAREERS_FILTER = { ID: "8736272", FacetType: 1, IsApplied: true, FieldName: "" };
const INTERN_FILTER = { ID: "Intern", FacetType: 5, IsApplied: true, FieldName: "job_type" };
const GRAD_FILTER = { ID: "Graduate", FacetType: 5, IsApplied: true, FieldName: "job_type" };

function buildQuery(filters, keywords, page) {
  const params = new URLSearchParams();
  params.set("CurrentPage", String(page));
  params.set("RecordsPerPage", "100");
  params.set("SearchType", "5");
  params.set("SearchResultsModuleName", "Search Results");
  params.set("SearchFiltersModuleName", "Search Filters");
  if (keywords) params.set("Keywords", keywords);
  filters.forEach((f, i) => {
    params.set(`FacetFilters[${i}].ID`, String(f.ID));
    params.set(`FacetFilters[${i}].FacetType`, String(f.FacetType));
    params.set(`FacetFilters[${i}].IsApplied`, "true");
    if (f.FieldName) params.set(`FacetFilters[${i}].FieldName`, f.FieldName);
  });
  return params.toString();
}

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

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// Convert "23 Feb" or "5 Jan" style dates (no year) to ISO date string
function parseBarclaysDate(dateStr) {
  if (!dateStr) return null;
  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const m = dateStr.trim().match(/^(\d{1,2})\s+([A-Za-z]+)$/);
  if (!m) return null;
  const day = parseInt(m[1]);
  const month = months[m[2].toLowerCase().slice(0, 3)];
  if (month === undefined) return null;
  const now = new Date();
  const d = new Date(now.getFullYear(), month, day);
  if (d > now) d.setFullYear(now.getFullYear() - 1);
  return d.toISOString().split("T")[0];
}

function parseJobs(html) {
  const jobs = [];
  const regex =
    /<a[^>]*href="([^"]*)"[^>]*class="[^"]*job-title[^"]*"[^>]*>[\s\S]*?<strong>([\s\S]*?)<\/strong>[\s\S]*?<\/a>[\s\S]*?<div[^>]*class="job-location"[^>]*>\s*([\s\S]*?)\s*<\/div>/g;

  // Extract posting dates in order from job-date divs
  const dateRegex = /class="[^"]*job-date[^"]*"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/g;
  const dates = [];
  let dm;
  while ((dm = dateRegex.exec(html)) !== null) {
    dates.push(dm[1].trim());
  }

  let m;
  let i = 0;
  while ((m = regex.exec(html)) !== null) {
    const title = decodeEntities(m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim());
    jobs.push({
      title,
      link: BASE_URL + m[1].trim(),
      location: decodeEntities(m[3].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()),
      category: categorizeJob(title),
      postedDate: parseBarclaysDate(dates[i]) || null,
    });
    i++;
  }
  return jobs;
}

async function fetchAllPages(filters, keywords) {
  const allJobs = [];
  let page = 1;
  let totalPages = 1;

  do {
    const qs = buildQuery(filters, keywords, page);
    const res = await fetch(`${API_URL}?${qs}`, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });

    const data = await res.json();
    const html = data.results || "";

    const pagesMatch = html.match(/data-total-pages="(\d+)"/);
    if (pagesMatch) totalPages = parseInt(pagesMatch[1]);

    allJobs.push(...parseJobs(html));
    page++;
  } while (page <= totalPages);

  return allJobs;
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Fetch intern/grad and analyst keyword results in parallel
    const [earlyCareerJobs, analystJobs] = await Promise.all([
      fetchAllPages([US_FILTER, INTERN_FILTER, GRAD_FILTER], ""),
      fetchAllPages([US_FILTER], "analyst"),
    ]);

    // Deduplicate by link
    const seen = new Set();
    const allJobs = [];
    for (const job of [...earlyCareerJobs, ...analystJobs]) {
      if (!seen.has(job.link)) {
        seen.add(job.link);
        allJobs.push(job);
      }
    }

    return Response.json({ jobs: allJobs, count: allJobs.length });
  } catch (err) {
    console.error("Barclays API error:", err);
    return Response.json(
      { error: "Failed to fetch Barclays jobs" },
      { status: 500 }
    );
  }
}
