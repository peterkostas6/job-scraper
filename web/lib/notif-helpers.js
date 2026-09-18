// Shared helpers used by both cron routes

// Phrases ATS pages commonly show (with a 200 status) once a posting is closed/filled.
// Checked case-insensitively against the fetched page body.
const CLOSED_POSTING_PHRASES = [
  "no longer accepting applications",
  "no longer available",
  "position has been filled",
  "posting has closed",
  "posting is closed",
  "job is no longer",
  "requisition is no longer",
  "this position is closed",
  "no longer active",
];

// Workday and Oracle Fusion (JPMC, Jefferies) candidate-facing pages are JS-rendered
// SPAs: the HTML shell (and its SEO og:meta tags) return HTTP 200 with the original job
// title even after a posting closes — the "no longer available" message only appears
// after client-side JS calls the real status API. A plain HTML fetch can never see that,
// so for these platforms we query the same JSON API the page itself uses.

const WORKDAY_RE = /^https:\/\/([a-z0-9-]+\.wd\d+\.myworkdayjobs\.com)\/[^/]+\/([^/]+)\/job\/(.+)$/i;
const ORACLE_FUSION_RE = /^https:\/\/([a-z0-9.-]+\.oraclecloud\.com)\/hcmUI\/CandidateExperience\/[^/]+\/sites\/([^/]+)\/job\/(\d+)\/?$/i;

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", Accept: "application/json" },
    });
    return { res, json: await res.json().catch(() => null) };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Workday's own frontend calls this "cxs" API to render the job — returns 404 once closed.
async function isWorkdayJobDead(match, timeoutMs) {
  const [, host, site, jobPath] = match;
  const tenant = host.split(".")[0];
  const apiUrl = `https://${host}/wday/cxs/${tenant}/${site}/job/${jobPath}`;
  try {
    const { res } = await fetchJson(apiUrl, timeoutMs);
    if (res.status === 404) return true;
    return false;
  } catch {
    return false;
  }
}

// Oracle Fusion Recruiting Cloud (JPMC, Jefferies) — the requisition search API only
// returns a match while the posting is live; closed postings come back with 0 items.
async function isOracleFusionJobDead(match, timeoutMs) {
  const [, host, site, id] = match;
  const apiUrl = `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?finder=ById;Id=${id},siteNumber=${site}`;
  try {
    const { res, json } = await fetchJson(apiUrl, timeoutMs);
    if (!res.ok || !json) return false;
    return Array.isArray(json.items) && json.items.length === 0;
  } catch {
    return false;
  }
}

// Checks whether a job link is dead. Routes Workday/Oracle Fusion links to their real
// status API (see above); everything else falls back to a definitive 404/410, or a 200
// whose body says the posting closed. Network errors/timeouts return false (benefit of
// the doubt) — only a confirmed signal should ever mark a job dead.
export async function isJobLinkDead(link, timeoutMs = 8000) {
  const workdayMatch = link.match(WORKDAY_RE);
  if (workdayMatch) return isWorkdayJobDead(workdayMatch, timeoutMs);

  const oracleMatch = link.match(ORACLE_FUSION_RE);
  if (oracleMatch) return isOracleFusionJobDead(oracleMatch, timeoutMs);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(link, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    if (res.status === 404 || res.status === 410) return true;
    if (!res.ok) return false;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return false;

    const body = (await res.text()).toLowerCase();
    return CLOSED_POSTING_PHRASES.some((phrase) => body.includes(phrase));
  } catch {
    return false;
  }
}

// Same dead-link check as isJobLinkDead, but also recovers a posted date from the job
// page's embedded JSON-LD (schema.org JobPosting "datePosted") when the bank's list API
// didn't supply one (e.g. Citi/TalentBrew). Only used for jobs missing postedDate, so
// banks that already supply it from their list API never take on this extra parsing —
// and for the ones that don't, this reuses the same fetch isJobLinkDead would otherwise
// make alone, so no additional request is added.
export async function checkJobLinkAndDate(link, timeoutMs = 8000) {
  const workdayMatch = link.match(WORKDAY_RE);
  if (workdayMatch) return { dead: await isWorkdayJobDead(workdayMatch, timeoutMs), postedDate: null };

  const oracleMatch = link.match(ORACLE_FUSION_RE);
  if (oracleMatch) return { dead: await isOracleFusionJobDead(oracleMatch, timeoutMs), postedDate: null };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(link, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    if (res.status === 404 || res.status === 410) return { dead: true, postedDate: null };
    if (!res.ok) return { dead: false, postedDate: null };

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return { dead: false, postedDate: null };

    const body = await res.text();
    const dead = CLOSED_POSTING_PHRASES.some((phrase) => body.toLowerCase().includes(phrase));

    let postedDate = null;
    if (!dead) {
      const m = body.match(/"datePosted"\s*:\s*"([^"]+)"/);
      if (m) {
        const d = new Date(m[1]);
        if (!isNaN(d.getTime())) postedDate = d.toISOString();
      }
    }
    return { dead, postedDate };
  } catch {
    return { dead: false, postedDate: null };
  }
}

// Returns false for clearly non-finance roles (software engineering, IT, cybersecurity, etc.)
// All jobs on the site should be finance/banking oriented.
export function isFinanceRole(title) {
  const t = title.toLowerCase();
  if (t.includes("software engineer") || t.includes("software developer")) return false;
  if (t.includes("application developer") || t.includes("web developer") || t.includes("full stack") || t.includes("fullstack")) return false;
  if (/\btechnology analyst\b/.test(t) || /\btech analyst\b/.test(t)) return false;
  if (t.includes("cybersecurity") || t.includes("cyber security") || t.includes("information security") || t.includes("infosec")) return false;
  if (t.includes("cloud engineer") || t.includes("cloud architect") || t.includes("devops") || t.includes("site reliability")) return false;
  if (t.includes("infrastructure engineer") || t.includes("network engineer") || t.includes("network administrator")) return false;
  if (t.includes("data engineer") || t.includes("machine learning engineer") || t.includes("ai engineer")) return false;
  if (/\bit\s+(analyst|support|intern|associate)\b/.test(t) || t.includes("it helpdesk") || t.includes("help desk")) return false;
  return true;
}

export function isInternship(title) {
  const t = title.toLowerCase();
  return /\bintern\b/.test(t) || t.includes("internship") || t.includes("summer") || t.includes("co-op") || t.includes("coop");
}

export function isGraduateProgram(title) {
  const t = title.toLowerCase();
  return /\bgraduate\b/.test(t) || /\bgrad\s+program/.test(t) || /\bgrad\s+programme/.test(t);
}

// Returns true for entry-level banking roles worth showing.
// Catches analyst/intern titles as well as common variations that don't use those exact words.
export function isBankingEntryLevel(title) {
  const t = title.toLowerCase();
  return (
    t.includes("analyst") ||
    /\bintern\b/.test(t) ||
    t.includes("internship") ||
    t.includes("summer") ||       // Summer Program, Summer Associate, etc.
    t.includes("co-op") ||
    t.includes("coop") ||
    t.includes("trainee") ||      // Graduate Trainee, Trading Trainee
    t.includes("placement") ||    // Industrial Placement, Placement Year
    /\bjunior\b/.test(t) ||       // Junior Trader, Junior Associate
    t.includes("early career") ||
    t.includes("campus") ||       // Campus Hire, Campus Recruit
    t.includes("new grad") ||
    t.includes("entry level") ||
    t.includes("entry-level")
  );
}

