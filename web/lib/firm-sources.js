// Scrapers for the firms added in Nov 2026. Each firm is one config line in FIRM_SOURCES;
// the adapters below speak the job-board APIs those firms use (Workday, Greenhouse, Lever,
// Ashby, Oracle Recruiting Cloud, Oleeo/tal.net, SAP SuccessFactors). /api/firm/[key] runs them.
// Every adapter returns [{ title, link, location, category, postedDate }] like the older
// per-bank routes, filtered to analyst/intern-type titles in the US.

export const FIRM_SOURCES = {
  evercore: { type: "talnet", host: "evercore.tal.net", brand: 5, boards: [1, 2, 3] },
  lazard: { type: "oracle", host: "icbpjb.fa.ocs.oraclecloud.com", site: "LazardStudentCareers" },
  moelis: { type: "workday", host: "moelis.wd1.myworkdayjobs.com", tenant: "moelis", site: "Experienced-Hires" },
  pjt: { type: "workday", host: "pjtpartners.wd1.myworkdayjobs.com", tenant: "pjtpartners", site: "Careers" },
  pwp: { type: "workday", host: "wd1.myworkdaysite.com", tenant: "pwp", site: "PWP_Experienced_Opportunities", linkBase: "https://wd1.myworkdaysite.com/en-US/recruiting/pwp/PWP_Experienced_Opportunities" },
  williamblair: { type: "greenhouse", slug: "williamblair" },
  harriswilliams: { type: "workday", host: "pnc.wd5.myworkdayjobs.com", tenant: "pnc", site: "HarrisWilliams" },
  lincoln: { type: "greenhouse", slug: "lincolninternational" },
  raymondjames: { type: "workday", host: "raymondjames.wd1.myworkdayjobs.com", tenant: "raymondjames", site: "raymondjamescareers", search: true },
  truist: { type: "workday", host: "truist.wd1.myworkdayjobs.com", tenant: "truist", site: "Careers", search: true },
  santander: { type: "workday", host: "santander.wd3.myworkdayjobs.com", tenant: "santander", site: "santandercareers", search: true },
  leerink: { type: "workday", host: "leerink.wd5.myworkdayjobs.com", tenant: "leerink", site: "leerinkpartners" },
  raine: { type: "lever", slug: "raine" },
  citizens: { type: "oracle", host: "hcgn.fa.us2.oraclecloud.com", site: "CX_1" },
  pnc: { type: "workday", host: "pnc.wd5.myworkdayjobs.com", tenant: "pnc", site: "External", search: true },
  cibc: [
    { type: "workday", host: "cibc.wd3.myworkdayjobs.com", tenant: "cibc", site: "Campus" },
    { type: "workday", host: "cibc.wd3.myworkdayjobs.com", tenant: "cibc", site: "Search", search: true },
  ],
  dadavidson: { type: "lever", slug: "dadavidson" },
  ardea: { type: "ashby", slug: "ardea-partners" },
  rbc: { type: "workday", host: "rbc.wd3.myworkdayjobs.com", tenant: "rbc", site: "RBCGLOBAL1", search: true },
  rothschild: { type: "workday", host: "rothschildandco.wd3.myworkdayjobs.com", tenant: "rothschildandco", site: "Rothschildandco_Lateral" },
  scotiabank: { type: "rmk", base: "https://jobs.scotiabank.com" },
  schwab: { type: "radancy", base: "https://www.schwabjobs.com" },
  manulife: { type: "workday", host: "manulife.wd3.myworkdayjobs.com", tenant: "manulife", site: "MFCJH_Jobs", facets: { Location_Country: ["bc33aa3152ec42d4995f4791a106ed09", "a30a87ed25634629aa6c3958aa2b91ea"] }, keepNonUS: true }, // US + Canada (Workday country filter), so the US-only check is skipped
};

// Same short UA as the older Workday routes; Workday refuses a full Chrome UA from Vercel.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
// Big retail/commercial banks: search these terms instead of paging through 1,000+ jobs.
const SEARCH_TERMS = ["analyst", "intern", "summer"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const US_STATES = "al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc";
const US_STATE_NAMES = ["alabama", "arizona", "california", "colorado", "connecticut", "delaware", "florida", "georgia", "illinois", "indiana", "massachusetts", "maryland", "michigan", "minnesota", "missouri", "new jersey", "north carolina", "ohio", "oregon", "pennsylvania", "rhode island", "south carolina", "tennessee", "texas", "utah", "virginia", "washington", "wisconsin", "kentucky", "montana", "idaho", "nevada", "iowa", "kansas", "oklahoma", "arkansas", "louisiana", "mississippi", "nebraska", "new hampshire", "vermont", "maine", "new mexico", "wyoming"];
const US_CITIES = ["new york", "nyc", "chicago", "san francisco", "los angeles", "boston", "houston", "dallas", "miami", "atlanta", "seattle", "charlotte", "minneapolis", "milwaukee", "denver", "pittsburgh", "philadelphia", "cleveland", "richmond", "baltimore", "nashville", "st. louis", "menlo park", "palo alto", "washington", "jersey city", "stamford", "greenwich", "tampa", "st. petersburg", "memphis", "salt lake", "portland", "phoenix", "austin", "san diego", "detroit", "columbus", "providence", "great falls", "west palm"];
// Cities in titles/locations that mean the role is outside the US.
const NON_US = /\b(london|paris|frankfurt|madrid|milan|stockholm|zurich|geneva|amsterdam|dubai|abu dhabi|riyadh|doha|hong kong|singapore|tokyo|sydney|melbourne|mumbai|bangalore|bengaluru|toronto|montreal|calgary|vancouver|mexico|s[aã]o paulo|luxembourg|brussels|dublin|munich|tel aviv|seoul|beijing|shanghai|emea|apac|canada|united kingdom|\buk\b|germany|france|spain|italy|india|japan|australia|brazil|ireland|switzerland|poland|warsaw|krakow|lisbon|portugal|chile|santiago|buenos aires|argentina|peru|colombia|bogot[aá]|puerto rico)\b/i;

export function isUSLocation(loc) {
  if (!loc) return true;
  const l = loc.toLowerCase();
  if (l.includes("united states") || /\busa?\b/.test(l)) return true;
  if (NON_US.test(l)) return false;
  // State codes only where a location format puts them: "Boston, MA", "PA - Pittsburgh", "USA CA San Francisco".
  if (new RegExp(`(^|,\\s*|usa\\s+)(${US_STATES})(\\s*-|\\s|,|$)`, "i").test(l)) return true;
  if (US_STATE_NAMES.some((s) => l.includes(s))) return true;
  if (US_CITIES.some((c) => l.includes(c))) return true;
  if (/\d+\s+locations/.test(l) || l.includes("multiple") || l.includes("remote") || l.includes("various")) return true;
  return false;
}

export function isEntryTitle(title) {
  const t = title.toLowerCase();
  return t.includes("analyst") || /\bintern(ship)?s?\b/.test(t) || t.includes("summer") || t.includes("trainee") || t.includes("placement") || t.includes("co-op") || t.includes("off-cycle") || t.includes("graduate");
}

export function categorizeJob(title) {
  const t = title.toLowerCase();
  if (/investment\s*bank/.test(t) || t.includes("ibd") || t.includes("m&a") || t.includes("advisory") || t.includes("leveraged finance") || t.includes("ecm") || t.includes("dcm") || t.includes("restructuring") || t.includes("capital markets") || t.includes("mergers")) return "Investment Banking";
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

const isoDay = (d) => {
  const t = d ? new Date(d) : null;
  return t && !isNaN(t) ? t.toISOString().split("T")[0] : null;
};

function workdayDate(postedOn) {
  if (!postedOn) return null;
  const s = postedOn.toLowerCase().trim();
  const d = new Date();
  if (s === "posted today") return isoDay(d);
  if (s === "posted yesterday") { d.setDate(d.getDate() - 1); return isoDay(d); }
  const m = s.match(/posted (\d+)\+? days? ago/);
  if (m) { d.setDate(d.getDate() - parseInt(m[1], 10)); return isoDay(d); }
  return null;
}

async function getJSON(url, init = {}, tries = 3) {
  const res = await fetch(url, { ...init, cache: "no-store", headers: { "User-Agent": UA, Accept: "application/json", "Accept-Language": "en-US", ...(init.headers || {}) } });
  if (res.status >= 500 && tries > 1) {
    await sleep(1000);
    return getJSON(url, init, tries - 1);
  }
  if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}`);
  return res.json();
}

// ---- Adapters ----

async function workday(src) {
  // Workday answers Vercel with 429 on <tenant>.wdN.myworkdayjobs.com (since Nov 15 2026) but
  // serves the same API on wdN.myworkdaysite.com. Job links keep the normal host.
  const api = `https://${src.host.match(/wd\d+/)[0]}.myworkdaysite.com/wday/cxs/${src.tenant}/${src.site}/jobs`;
  const linkBase = src.linkBase || `https://${src.host}/en-US/${src.site}`;
  const out = [];
  for (const searchText of src.search ? SEARCH_TERMS : [""]) {
    let total = 0;
    for (let offset = 0; offset < 1000; offset += 20) {
      const data = await getJSON(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appliedFacets: src.facets || {}, limit: 20, offset, searchText }),
      });
      for (const j of data.jobPostings || []) {
        out.push({ title: j.title || "", link: `${linkBase}${j.externalPath}`, location: j.locationsText || j.bulletFields?.[0] || "", postedDate: workdayDate(j.postedOn) });
      }
      // Workday only reports the total on the first page; later pages say 0.
      if (offset === 0) total = data.total || 0;
      if (offset + 20 >= total || !data.jobPostings?.length) break;
      await sleep(300);
    }
  }
  return out;
}

async function greenhouse(src) {
  const data = await getJSON(`https://boards-api.greenhouse.io/v1/boards/${src.slug}/jobs`);
  return (data.jobs || []).map((j) => ({
    title: j.title || "",
    link: j.absolute_url,
    location: j.location?.name || "",
    postedDate: isoDay(j.first_published || j.updated_at),
  }));
}

async function lever(src) {
  const data = await getJSON(`https://api.lever.co/v0/postings/${src.slug}?mode=json`);
  return (data || []).map((j) => ({
    title: j.text || "",
    link: j.hostedUrl,
    location: j.categories?.allLocations?.join("; ") || j.categories?.location || "",
    postedDate: isoDay(j.createdAt),
  }));
}

async function ashby(src) {
  const data = await getJSON(`https://api.ashbyhq.com/posting-api/job-board/${src.slug}`);
  return (data.jobs || []).map((j) => ({
    title: j.title || "",
    link: j.jobUrl,
    location: [j.location, ...(j.secondaryLocations || []).map((s) => s.location)].filter(Boolean).join("; "),
    postedDate: isoDay(j.publishedAt),
  }));
}

async function oracle(src) {
  const out = [];
  for (const keyword of SEARCH_TERMS) {
    for (let offset = 0; offset < 500; offset += 24) {
      const url = `https://${src.host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${src.site},limit=24,offset=${offset},keyword=${keyword},sortBy=POSTING_DATES_DESC`;
      const data = await getJSON(url);
      const item = data.items?.[0] || {};
      const reqs = item.requisitionList || [];
      for (const r of reqs) {
        const locs = [r.PrimaryLocation, ...(r.secondaryLocations || []).map((s) => s.Name)].filter(Boolean);
        out.push({
          title: r.Title || "",
          link: `https://${src.host}/hcmUI/CandidateExperience/en/sites/${src.site}/job/${r.Id}`,
          location: locs.join("; "),
          postedDate: isoDay(r.PostedDate),
        });
      }
      if (reqs.length < 24 || offset + 24 >= (item.TotalJobsCount || 0)) break;
      await sleep(300);
    }
  }
  return out;
}

// Oleeo (tal.net) boards publish an Atom feed per board. No location field, so non-US
// roles are dropped by the city named in the title.
async function talnet(src) {
  const out = [];
  for (const board of src.boards) {
    const res = await fetch(`https://${src.host}/vx/mobile-0/appcentre-1/brand-${src.brand}/candidate/jobboard/vacancy/${board}/feed`, { cache: "no-store", headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`${src.host} board ${board} returned ${res.status}`);
    const xml = await res.text();
    for (const [, entry] of xml.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/g)) {
      const title = decode(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").trim();
      const link = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim();
      if (!title || !link) continue;
      out.push({ title, link: link.replace("/appcentre-ext/brand-4/", `/appcentre-1/brand-${src.brand}/`), location: NON_US.test(title) ? "Non-US" : "", postedDate: isoDay(entry.match(/<published>([^<]+)<\/published>/)?.[1]) });
    }
  }
  return out;
}

// SAP SuccessFactors career sites (jobs.<bank>.com/search/) render results as plain HTML,
// 25 rows a page. Locations end in a country code ("Dallas, TX, US, 75219"); keep US only.
async function rmk(src) {
  const out = [];
  for (const q of SEARCH_TERMS) {
    for (let startrow = 0; startrow < 500; startrow += 25) {
      const res = await fetch(`${src.base}/search/?q=${q}&startrow=${startrow}`, { cache: "no-store", headers: { "User-Agent": UA, "Accept-Language": "en-US" } });
      if (!res.ok) throw new Error(`${new URL(src.base).host} returned ${res.status}`);
      const rows = [...(await res.text()).matchAll(/<tr class="data-row">([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
      for (const row of rows) {
        const t = row.match(/class="jobTitle-link"[^>]*href="([^"]+)"[^>]*>([^<]+)/);
        const location = row.match(/class="jobLocation"[^>]*>\s*([^<]+)/)?.[1].trim() || "";
        if (!t || !/,\s*US\b/.test(location)) continue;
        out.push({ title: decode(t[2]), link: `${src.base}${t[1]}`, location: location.replace(/,\s*US\b.*$/, ""), postedDate: isoDay(row.match(/class="jobDate"[^>]*>\s*([^<]+)/)?.[1].trim()) });
      }
      if (rows.length < 25) break;
      await sleep(300);
    }
  }
  return out;
}

// Radancy (TalentBrew) career sites, e.g. schwabjobs.com: the search page's results endpoint
// returns the job list as HTML, 100 a page. Schwab has a few hundred jobs, so read them all.
async function radancy(src) {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const data = await getJSON(`${src.base}/search-jobs/results?ActiveFacetID=0&CurrentPage=${page}&RecordsPerPage=100&SearchResultsModuleName=Search+Results&SearchFiltersModuleName=Search+Filters&SortCriteria=0&SortDirection=0&SearchType=5&ResultsType=0`, { headers: { "X-Requested-With": "XMLHttpRequest" } });
    const html = data.results || "";
    for (const [, path, body] of html.matchAll(/<a href="(\/job\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const title = body.match(/<h2>([\s\S]*?)<\/h2>/)?.[1].trim();
      if (!title) continue;
      out.push({ title, link: `${src.base}${path}`, location: decode(body.match(/class="job-location">([^<]*)/)?.[1].trim() || ""), postedDate: null });
    }
    if (page >= parseInt(html.match(/data-total-pages="(\d+)"/)?.[1] || "1", 10)) break;
    await sleep(300);
  }
  return out;
}

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#039;|&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

const ADAPTERS = { workday, greenhouse, lever, ashby, oracle, talnet, rmk, radancy };

export async function fetchFirmJobs(key) {
  const cfg = FIRM_SOURCES[key];
  if (!cfg) throw new Error(`Unknown firm ${key}`);
  const raw = (await Promise.all([].concat(cfg).map((src) => ADAPTERS[src.type](src)))).flat();
  const seen = new Set();
  const jobs = [];
  for (const j of raw) {
    const title = decode(j.title).replace(/\s+/g, " ").trim();
    if (!title || !j.link || seen.has(j.link)) continue;
    seen.add(j.link);
    if (!isEntryTitle(title)) continue;
    if (!cfg.keepNonUS && (!isUSLocation(j.location) || NON_US.test(title))) continue;
    jobs.push({ title, link: j.link, location: j.location === "Non-US" ? "" : j.location, category: categorizeJob(title), postedDate: j.postedDate });
  }
  return jobs;
}
