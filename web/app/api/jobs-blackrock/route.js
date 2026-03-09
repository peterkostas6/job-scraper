// GET /api/jobs-blackrock — fetches BlackRock US analyst & intern jobs from TalentBrew API
// BlackRock uses TalentBrew (Radancy) at careers.blackrock.com — same platform as Barclays

export const dynamic = "force-dynamic";

const BASE_URL = "https://careers.blackrock.com";
const API_URL = `${BASE_URL}/search-jobs/results`;

const US_FILTER = { ID: "6252001", FacetType: 2, IsApplied: true, FieldName: "" };
const STUDENTS_GRADS_FILTER = { ID: "9022304", FacetType: 1, IsApplied: true, FieldName: "" };

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
  if (/investment\s*bank/.test(t) || t.includes("ibd") || t.includes("m&a") || t.includes("leveraged finance")) return "Investment Banking";
  if (t.includes("sales & trading") || t.includes("sales and trading") || t.includes("trading") || t.includes("markets") || t.includes("fixed income") || t.includes("equities") || t.includes("securities") || t.includes("commodit")) return "Sales & Trading";
  if (t.includes("risk") || t.includes("compliance") || t.includes("audit") || t.includes("regulatory")) return "Risk & Compliance";
  if (t.includes("technolog") || t.includes("engineer") || t.includes("developer") || t.includes("software") || t.includes("data sci") || t.includes("cyber") || t.includes("cloud")) return "Technology";
  if (t.includes("wealth") || t.includes("asset manage") || t.includes("private bank") || t.includes("private client") || t.includes("portfolio") || t.includes("aladdin") || t.includes("etf") || t.includes("index")) return "Wealth Management";
  if (t.includes("research") || t.includes("economist")) return "Research";
  if (t.includes("operations") || /\bops\b/.test(t) || t.includes("middle office") || t.includes("back office")) return "Operations";
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

// Parse MM/DD/YYYY date format used by BlackRock
function parseDate(dateStr) {
  if (!dateStr) return null;
  const s = dateStr.trim();
  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return new Date(parseInt(mdy[3]), parseInt(mdy[1]) - 1, parseInt(mdy[2])).toISOString().split("T")[0];
  }
  // "23 Feb" style fallback
  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const dm = s.match(/^(\d{1,2})\s+([A-Za-z]+)$/);
  if (dm) {
    const month = months[dm[2].toLowerCase().slice(0, 3)];
    if (month !== undefined) {
      const now = new Date();
      const d = new Date(now.getFullYear(), month, parseInt(dm[1]));
      if (d > now) d.setFullYear(now.getFullYear() - 1);
      return d.toISOString().split("T")[0];
    }
  }
  return null;
}

function parseJobs(html) {
  const jobs = [];

  // BlackRock TalentBrew structure:
  // <a href="/job/..." data-job-id="...">
  //   <h2>Title</h2>
  //   <span class="job-location">Location</span>
  //   <span class="job-date-posted">MM/DD/YYYY</span>
  // </a>
  const regex =
    /<a\s+href="(\/job\/[^"]+)"\s+data-job-id="[^"]*"[^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>\s*<span[^>]*class="job-location"[^>]*>([\s\S]*?)<\/span>\s*(?:<span[^>]*class="job-date-posted"[^>]*>([\s\S]*?)<\/span>)?/g;

  let m;
  while ((m = regex.exec(html)) !== null) {
    const title = decodeEntities(m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim());

    // Exclude Associate/VP/Director level roles
    const tl = title.toLowerCase();
    if (/\bassociate\b/.test(tl) && !tl.includes("analyst")) continue;
    if (tl.includes("vice president") || /\bvp\b/.test(tl)) continue;
    if (/\bdirector\b/.test(tl)) continue;
    if (/\bprincipal\b/.test(tl) || /\bpartner\b/.test(tl)) continue;

    const location = decodeEntities(m[3].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim());
    const dateStr = m[4] ? m[4].trim() : null;
    jobs.push({
      title,
      link: BASE_URL + m[1].trim(),
      location,
      category: categorizeJob(title),
      postedDate: parseDate(dateStr) || null,
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
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "Referer": `${BASE_URL}/search-jobs`,
      },
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

export async function GET() {
  try {
    // Fetch analyst keyword results + students/grads category in parallel, deduplicate
    const [analystJobs, earlyCareerJobs] = await Promise.all([
      fetchAllPages([US_FILTER], "analyst"),
      fetchAllPages([US_FILTER, STUDENTS_GRADS_FILTER], ""),
    ]);

    const seen = new Set();
    const allJobs = [];
    for (const job of [...analystJobs, ...earlyCareerJobs]) {
      if (!seen.has(job.link)) {
        seen.add(job.link);
        allJobs.push(job);
      }
    }

    return Response.json({ jobs: allJobs, count: allJobs.length });
  } catch (err) {
    console.error("BlackRock API error:", err);
    return Response.json({ error: "Failed to fetch BlackRock jobs" }, { status: 500 });
  }
}
