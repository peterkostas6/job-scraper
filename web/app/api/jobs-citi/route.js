// GET /api/jobs-citi — fetches Citi student & grad program jobs from TalentBrew API
const BASE_URL = "https://jobs.citi.com";
const API_URL = `${BASE_URL}/search-jobs/resultspost`;

const US_FILTER = { ID: "6252001", FacetType: 2, IsApplied: true, FieldName: "" };
const STUDENT_FILTER = {
  ID: "Student and Grad Programs",
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

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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
    jobs.push({
      title: decodeEntities(links[i].title),
      link: BASE_URL + links[i].href,
      location: locs[i] ? decodeEntities(locs[i]) : "",
    });
  }

  return jobs;
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
        body: JSON.stringify(buildBody([STUDENT_FILTER, US_FILTER], page)),
      });

      const data = await res.json();
      const html = data.results || "";

      const pagesMatch = html.match(/data-total-pages="(\d+)"/);
      if (pagesMatch) totalPages = parseInt(pagesMatch[1]);

      allJobs.push(...parseJobs(html));
      page++;
    } while (page <= totalPages);

    return Response.json({ jobs: allJobs, count: allJobs.length });
  } catch (err) {
    console.error("Citi API error:", err);
    return Response.json({ error: "Failed to fetch Citi jobs" }, { status: 500 });
  }
}
