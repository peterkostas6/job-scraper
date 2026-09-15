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

export function buildEmailHtml(newJobs, userName) {
  const grouped = {};
  for (const job of newJobs) {
    const bank = job.bank || "Other";
    if (!grouped[bank]) grouped[bank] = [];
    grouped[bank].push(job);
  }

  let jobRows = "";
  for (const [bank, jobs] of Object.entries(grouped)) {
    jobRows += `<tr><td colspan="3" style="padding:16px 0 8px;font-size:16px;font-weight:700;color:#1e293b;border-bottom:1px solid #e2e8f0;">${bank}</td></tr>`;
    for (const job of jobs) {
      const type = isInternship(job.title) ? "Internship" : "Analyst";
      const typeColor = type === "Internship" ? "#d97706" : "#2563eb";
      jobRows += `
        <tr>
          <td style="padding:10px 0;font-size:14px;">
            <a href="${job.link}" style="color:#1e293b;text-decoration:none;font-weight:500;">${job.title}</a>
          </td>
          <td style="padding:10px 8px;font-size:12px;color:#64748b;">${job.location || ""}</td>
          <td style="padding:10px 0;font-size:11px;font-weight:600;color:${typeColor};text-transform:uppercase;">${type}</td>
        </tr>`;
    }
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="margin-bottom:24px;">
      <span style="font-size:18px;font-weight:800;color:#1e293b;">Pete's Postings</span>
    </div>
    <p style="font-size:15px;color:#334155;margin:0 0 8px;">Hey${userName ? " " + userName : ""},</p>
    <p style="font-size:15px;color:#334155;margin:0 0 24px;">${newJobs.length} new ${newJobs.length === 1 ? "posting" : "postings"} matching your preferences just went live:</p>
    <table style="width:100%;border-collapse:collapse;">
      ${jobRows}
    </table>
    <div style="margin-top:32px;text-align:center;">
      <a href="https://petespostings.com" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Browse All Jobs</a>
    </div>
    <p style="margin-top:32px;font-size:12px;color:#94a3b8;text-align:center;">
      You're receiving this because you enabled job notifications on Pete's Postings.<br>
      To unsubscribe, turn off notifications in your dashboard settings.
    </p>
  </div>
</body>
</html>`;
}
