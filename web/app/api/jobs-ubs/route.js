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

function getField(job, name) {
  return job.Questions?.find((q) => q.QuestionName === name)?.Value || "";
}

function parseJob(job) {
  const title = getField(job, "jobtitle");
  const location = getField(job, "formtext23");
  const link = job.Link || "";
  return { title, link, location };
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
