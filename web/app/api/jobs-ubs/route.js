// GET /api/jobs-ubs — fetches UBS US analyst & intern jobs from BrassRing API
// Two sites: Experienced professionals (5012) + Graduate/Intern programs (5131)
const BASE = "https://jobs.ubs.com";
const PARTNER_ID = "25008";

async function getSession(siteId) {
  const res = await fetch(
    `${BASE}/TGnewUI/Search/Home/Home?partnerid=${PARTNER_ID}&siteid=${siteId}`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  const html = await res.text();
  const rft = html.match(/__RequestVerificationToken"[^>]*value="([^"]*)"/)?.[1];
  const cookie = html.match(/CookieValue"[^>]*value="([^"]*)"/)?.[1];
  const cookies = res.headers
    .getSetCookie?.()
    ?.map((c) => c.split(";")[0])
    .join("; ");
  return { rft, cookie, cookies };
}

async function searchJobs(siteId, session, keyword) {
  const headers = {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    RFT: session.rft,
    "User-Agent": "Mozilla/5.0",
    ...(session.cookies ? { Cookie: session.cookies } : {}),
  };

  // Initial search
  const searchRes = await fetch(`${BASE}/TgNewUI/Search/Ajax/PowerSearchJobs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      partnerId: PARTNER_ID,
      siteId: String(siteId),
      keyword: keyword || "",
      location: "",
      Latitude: 0,
      Longitude: 0,
      FacetFilterFields: { Facet: [] },
      PowerSearchOptions: { PowerSearchOption: [] },
      SortType: "LastUpdated",
      EncryptedSessionValue: session.cookie,
    }),
  });

  const data = await searchRes.json();
  const allJobs = data.Jobs?.Job || [];
  const total = data.JobsCount || 0;
  const totalPages = Math.ceil(total / 50);

  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    await new Promise((r) => setTimeout(r, 500));
    const pageRes = await fetch(
      `${BASE}/TgNewUI/Search/Ajax/ProcessSortAndShowMoreJobs`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          partnerId: PARTNER_ID,
          siteId: String(siteId),
          keyword: keyword || "",
          location: "",
          keywordCustomSolrFields: "",
          locationCustomSolrFields: "",
          linkId: "",
          Latitude: 0,
          Longitude: 0,
          facetfilterfields: { Facet: [] },
          powersearchoptions: { PowerSearchOption: [] },
          SortType: "LastUpdated",
          pageNumber: page,
          encryptedSessionValue: session.cookie,
        }),
      }
    );
    const pageData = await pageRes.json();
    allJobs.push(...(pageData.Jobs?.Job || []));
  }

  return allJobs;
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

function getField(job, name) {
  return job.Questions?.find((q) => q.QuestionName === name)?.Value || "";
}

function parseJob(job) {
  const title = getField(job, "jobtitle");
  const location = getField(job, "formtext23");
  const link = job.Link || "";
  return { title, link, location, category: categorizeJob(title) };
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Get sessions for both sites in parallel
    const [profSession, gradSession] = await Promise.all([
      getSession("5012"),
      getSession("5131"),
    ]);

    // Search both sites — professionals with no keyword, grads with no keyword
    const [profJobs, gradJobs] = await Promise.all([
      searchJobs("5012", profSession, ""),
      searchJobs("5131", gradSession, ""),
    ]);

    // Filter to US jobs and parse
    const seen = new Set();
    const jobs = [];

    for (const raw of [...profJobs, ...gradJobs]) {
      const loc = getField(raw, "formtext23");
      if (!loc.includes("United States")) continue;

      const job = parseJob(raw);
      if (seen.has(job.link)) continue;
      seen.add(job.link);

      // Clean location: "United States - New York" → "New York"
      job.location = loc.replace("United States - ", "").replace("United States", "").trim();
      jobs.push(job);
    }

    return Response.json({ jobs, count: jobs.length });
  } catch (err) {
    console.error("UBS API error:", err);
    return Response.json(
      { error: "Failed to fetch UBS jobs" },
      { status: 500 }
    );
  }
}
