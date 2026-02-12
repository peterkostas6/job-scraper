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
  const regex =
    /<a[^>]*href="([^"]*)"[^>]*class="[^"]*job-title[^"]*"[^>]*>[\s\S]*?<strong>([\s\S]*?)<\/strong>[\s\S]*?<\/a>[\s\S]*?<div[^>]*class="job-location"[^>]*>\s*([\s\S]*?)\s*<\/div>/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    jobs.push({
      title: decodeEntities(m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()),
      link: BASE_URL + m[1].trim(),
      location: decodeEntities(m[3].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()),
    });
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
