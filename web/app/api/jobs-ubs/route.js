// GET /api/jobs-ubs — fetches UBS US analyst & intern jobs from BrassRing API
const BASE = "https://jobs.ubs.com";
const PARTNER_ID = "25008";
const SITE_ID = "5012"; // Professional roles only

async function getSession() {
  const res = await fetch(
    `${BASE}/TGnewUI/Search/Home/Home?partnerid=${PARTNER_ID}&siteid=${SITE_ID}`,
    { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } }
  );
  if (!res.ok) throw new Error(`Session page returned ${res.status}`);

  const html = await res.text();
  const rft = html.match(/__RequestVerificationToken"[^>]*value="([^"]*)"/)?.[1];
  const cookie = html.match(/CookieValue"[^>]*value="([^"]*)"/)?.[1];

  if (!rft || !cookie) throw new Error("Failed to extract session tokens");

  // Extract cookies — try getSetCookie first, fall back to raw header
  let cookies = "";
  if (typeof res.headers.getSetCookie === "function") {
    cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  } else {
    const raw = res.headers.get("set-cookie") || "";
    cookies = raw.split(",").map((c) => c.trim().split(";")[0]).filter(Boolean).join("; ");
  }

  return { rft, cookie, cookies };
}

async function searchJobs(session) {
  const headers = {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    RFT: session.rft,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    ...(session.cookies ? { Cookie: session.cookies } : {}),
  };

  const searchRes = await fetch(`${BASE}/TgNewUI/Search/Ajax/PowerSearchJobs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      partnerId: PARTNER_ID,
      siteId: SITE_ID,
      keyword: "",
      location: "",
      Latitude: 0,
      Longitude: 0,
      FacetFilterFields: { Facet: [] },
      PowerSearchOptions: { PowerSearchOption: [] },
      SortType: "LastUpdated",
      EncryptedSessionValue: session.cookie,
    }),
  });

  if (!searchRes.ok) throw new Error(`Search returned ${searchRes.status}`);
  const data = await searchRes.json();
  const allJobs = data.Jobs?.Job || [];
  const total = data.JobsCount || 0;
  const totalPages = Math.ceil(total / 50);

  // Fetch remaining pages (cap at 5 to avoid timeouts)
  for (let page = 2; page <= Math.min(totalPages, 5); page++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const pageRes = await fetch(
        `${BASE}/TgNewUI/Search/Ajax/ProcessSortAndShowMoreJobs`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            partnerId: PARTNER_ID,
            siteId: SITE_ID,
            keyword: "",
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
      if (pageRes.ok) {
        const pageData = await pageRes.json();
        allJobs.push(...(pageData.Jobs?.Job || []));
      }
    } catch {
      break; // Stop paginating on error
    }
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

// Filter out senior roles by title
function isJuniorRole(title) {
  const t = title.toLowerCase();
  if (t.includes("vice president")) return false;
  if (/\bavp\b/.test(t)) return false;
  if (/\bvp\b/.test(t)) return false;
  if (/\bdirector\b/.test(t)) return false;
  if (/\bmanaging director\b/.test(t)) return false;
  if (/\bsenior\b/.test(t)) return false;
  if (/\bprincipal\b/.test(t)) return false;
  if (/\bassociate\b/.test(t) && !/\banalyst\b/.test(t) && !/\bintern\b/.test(t)) return false;
  if (/\bmanager\b/.test(t) && !/\bintern\b/.test(t)) return false;
  if (/\bassistant\b/.test(t) && !/\banalyst\b/.test(t) && !/\bintern\b/.test(t)) return false;
  return true;
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const session = await getSession();
    const rawJobs = await searchJobs(session);

    const seen = new Set();
    const jobs = [];

    for (const raw of rawJobs) {
      const loc = getField(raw, "formtext23");
      if (!loc.includes("United States")) continue;

      const title = getField(raw, "jobtitle");
      if (!isJuniorRole(title)) continue;

      const link = raw.Link || "";
      if (seen.has(link)) continue;
      seen.add(link);

      const location = loc.replace("United States - ", "").replace("United States", "").trim();
      jobs.push({ title, link, location, category: categorizeJob(title) });
    }

    return Response.json({ jobs, count: jobs.length });
  } catch (err) {
    console.error("UBS API error:", err);
    return Response.json(
      { error: "Failed to fetch UBS jobs", details: err.message },
      { status: 500 }
    );
  }
}
