// GET /api/jobs-citi — fetches Citi analyst & intern jobs from TalentBrew API
// Two sources: Student/Grad Programs (internships) + Entry Level filtered to analyst titles
const BASE_URL = "https://jobs.citi.com";
const API_URL = `${BASE_URL}/search-jobs/resultspost`;

const US_FILTER = { ID: "6252001", FacetType: 2, IsApplied: true, FieldName: "" };
const STUDENT_FILTER = {
  ID: "Student and Grad Programs",
  FacetType: 5,
  IsApplied: true,
  FieldName: "custom_fields.CFCareerLevel",
};
const ENTRY_FILTER = {
  ID: "Entry Level",
  FacetType: 5,
  IsApplied: true,
  FieldName: "custom_fields.CFCareerLevel",
};

function buildBody(filters, page = 1) {
  return {
    ActiveFacetID: 0,
    CurrentPage: page,
    RecordsPerPage: 100,
    Distance: 50,
    RadiusUnitType: 0,
    Keywords: "",
    Location: "",
    ShowRadius: false,
    IsPagination: "True",
    CustomFacetName: "",
    FacetTerm: "",
    FacetType: 0,
    SearchResultsModuleName: "Search Results",
    SearchFiltersModuleName: "Search Filters",
    SortCriteria: 0,
    SortDirection: 0,
    SearchType: 6,
    PostalCode: "",
    ResultsType: 0,
    FacetFilters: filters,
  };
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

function parseJobs(html) {
  const jobs = [];
  const linkRegex =
    /<a[^>]*class="sr-job-item__link"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  const locRegex =
    /<span[^>]*sr-job-location[^>]*>([\s\S]*?)<\/span>/g;

  const links = [];
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    links.push({
      href: m[1].trim(),
      title: m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim(),
    });
  }

  const locs = [];
  while ((m = locRegex.exec(html)) !== null) {
    locs.push(m[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim());
  }

  for (let i = 0; i < links.length; i++) {
    const title = decodeEntities(links[i].title);
    jobs.push({
      title,
      link: BASE_URL + links[i].href,
      location: locs[i] ? decodeEntities(locs[i]) : "",
      category: categorizeJob(title),
    });
  }

  return jobs;
}

async function fetchAllPages(filters) {
  const allJobs = [];
  let page = 1;
  let totalPages = 1;

  do {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify(buildBody(filters, page)),
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
    // Fetch both sources in parallel
    const [studentJobs, entryJobs] = await Promise.all([
      fetchAllPages([STUDENT_FILTER, US_FILTER]),
      fetchAllPages([ENTRY_FILTER, US_FILTER]),
    ]);

    // Entry Level is broad — only keep jobs with "analyst" in the title
    const filteredEntry = entryJobs.filter((job) =>
      /analyst/i.test(job.title)
    );

    // Deduplicate by link
    const seen = new Set();
    const allJobs = [];
    for (const job of [...studentJobs, ...filteredEntry]) {
      if (!seen.has(job.link)) {
        seen.add(job.link);
        allJobs.push(job);
      }
    }

    return Response.json({ jobs: allJobs, count: allJobs.length });
  } catch (err) {
    console.error("Citi API error:", err);
    return Response.json({ error: "Failed to fetch Citi jobs" }, { status: 500 });
  }
}
