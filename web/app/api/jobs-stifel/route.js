// GET /api/jobs-stifel — fetches Stifel analyst & intern jobs from iCIMS

export const dynamic = "force-dynamic";

const BASE_URL = "https://careers-stifel.icims.com";
const SEARCH_URL = `${BASE_URL}/jobs/search`;

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

function isUSLocation(loc) {
  if (!loc) return true;
  const l = loc.toLowerCase();
  if (l.includes("united states")) return true;
  if (/[,\-]\s*(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)\b/i.test(l)) return true;
  if (l.includes("new york") || l.includes("chicago") || l.includes("san francisco") || l.includes("los angeles") || l.includes("boston") || l.includes("houston") || l.includes("dallas") || l.includes("miami") || l.includes("atlanta") || l.includes("seattle") || l.includes("charlotte") || l.includes("st. louis") || l.includes("kansas city")) return true;
  if (l.includes("multiple")) return true;
  return false;
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
  const linkRegex = /<a[^>]*class="[^"]*iCIMS_JobsTable_Link[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  const locRegex = /<span[^>]*class="[^"]*iCIMS_JobsTable_Location[^"]*"[^>]*>([\s\S]*?)<\/span>/g;

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
    const t = title.toLowerCase();
    if (!t.includes("analyst") && !t.includes("intern") && !t.includes("summer") && !t.includes("trainee") && !t.includes("placement")) continue;
    const loc = locs[i] ? decodeEntities(locs[i]) : "";
    if (!isUSLocation(loc)) continue;
    jobs.push({
      title,
      link: links[i].href.startsWith("http") ? links[i].href : BASE_URL + links[i].href,
      location: locs[i] ? decodeEntities(locs[i]) : "",
      category: categorizeJob(title),
    });
  }

  return jobs;
}

export async function GET() {
  try {
    const allJobs = [];
    let page = 1;
    let totalPages = 1;

    do {
      const params = new URLSearchParams({
        ics_keywords: "analyst intern",
        ics_location: "",
        iis: "PetesPostings",
        mobile: "false",
        width: "990",
        height: "500",
        bga: "true",
        needsRedirect: "false",
        in_iframe: "1",
        pr: page.toString(),
      });

      const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!res.ok) throw new Error(`Stifel iCIMS returned ${res.status}`);

      const html = await res.text();

      // Extract total pages from pagination
      const pagesMatch = html.match(/iCIMS_PagingControl[^>]*data-total-pages="(\d+)"/);
      if (pagesMatch) totalPages = parseInt(pagesMatch[1]);

      const pageJobs = parseJobs(html);
      allJobs.push(...pageJobs);

      if (pageJobs.length === 0) break;
      page++;
    } while (page <= totalPages && page <= 10);

    // Deduplicate by link
    const seen = new Set();
    const dedupedJobs = allJobs.filter((j) => {
      if (seen.has(j.link)) return false;
      seen.add(j.link);
      return true;
    });

    return Response.json({ jobs: dedupedJobs, count: dedupedJobs.length });
  } catch (err) {
    console.error("Stifel API error:", err);
    return Response.json({ error: "Failed to fetch Stifel jobs" }, { status: 500 });
  }
}
