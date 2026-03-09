// GET /api/jobs-blackstone — fetches Blackstone US analyst & intern jobs from Workday API
// Blackstone uses Workday at blackstone.wd1.myworkdayjobs.com (same platform as MS, BofA, Barclays, UBS)

export const dynamic = "force-dynamic";

const API_URL = "https://blackstone.wd1.myworkdayjobs.com/wday/cxs/blackstone/Blackstone_Careers/jobs";
const SITE_URL = "https://blackstone.wd1.myworkdayjobs.com/en-US/Blackstone_Careers";

function categorizeJob(title) {
  const t = title.toLowerCase();
  if (/investment\s*bank/.test(t) || t.includes("ibd") || t.includes("m&a") || t.includes("leveraged finance") || t.includes("ecm") || t.includes("dcm")) return "Investment Banking";
  if (t.includes("sales & trading") || t.includes("sales and trading") || t.includes("trading") || t.includes("markets") || t.includes("fixed income") || t.includes("equities") || t.includes("securities") || t.includes("commodit")) return "Sales & Trading";
  if (t.includes("risk") || t.includes("compliance") || t.includes("audit") || t.includes("regulatory")) return "Risk & Compliance";
  if (t.includes("technolog") || t.includes("engineer") || t.includes("developer") || t.includes("software") || t.includes("data sci") || t.includes("cyber") || t.includes("cloud")) return "Technology";
  if (t.includes("wealth") || t.includes("asset manage") || t.includes("private bank") || t.includes("private client") || t.includes("portfolio")) return "Wealth Management";
  if (t.includes("private equity") || t.includes("private credit") || t.includes("real estate") || t.includes("infrastructure") || t.includes("hedge fund") || t.includes("baam") || t.includes("bx")) return "Alternative Investments";
  if (t.includes("research") || t.includes("economist")) return "Research";
  if (t.includes("operations") || /\bops\b/.test(t) || t.includes("middle office") || t.includes("back office")) return "Operations";
  if (t.includes("finance") || t.includes("accounting") || t.includes("controller") || t.includes("treasury") || t.includes("tax")) return "Finance";
  if (t.includes("legal") || t.includes("counsel")) return "Legal";
  if (t.includes("quantitative") || t.includes("quant ") || t.includes("strats")) return "Quantitative";
  return "Other";
}

function parseWorkdayDate(postedOn) {
  if (!postedOn) return null;
  const s = postedOn.toLowerCase().trim();
  const now = new Date();
  if (s === "posted today") return now.toISOString().split("T")[0];
  if (s === "posted yesterday") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }
  const m = s.match(/posted (\d+)\+? days? ago/);
  if (m) {
    const d = new Date(now);
    d.setDate(d.getDate() - parseInt(m[1]));
    return d.toISOString().split("T")[0];
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(searchText, offset = 0) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    },
    body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText }),
  });
  if (!res.ok) throw new Error(`Blackstone Workday API returned ${res.status}`);
  return res.json();
}

function parseJobs(data) {
  const postings = data.jobPostings || [];
  return postings
    .filter((job) => {
      const t = (job.title || "").toLowerCase();
      // Only entry-level: must contain analyst, intern, or summer
      if (!t.includes("analyst") && !/\bintern\b/.test(t) && !t.includes("summer")) return false;
      // Exclude VP/Associate/Director/Principal seniority levels
      if (t.includes("vice president") || /\bvp\b/.test(t) || /\bsvp\b/.test(t) || /\bevp\b/.test(t)) return false;
      if (/\bassociate\b/.test(t) && !t.includes("analyst")) return false;
      if (/\bdirector\b/.test(t)) return false;
      if (/\bprincipal\b/.test(t)) return false;
      if (/\bpartner\b/.test(t)) return false;
      return true;
    })
    .filter((job) => {
      const loc = (job.locationsText || "").toLowerCase();
      // Keep US locations only
      return (
        loc.includes("united states") ||
        loc.includes("new york") ||
        loc.includes("miami") ||
        loc.includes("san francisco") ||
        loc.includes("houston") ||
        loc.includes("atlanta") ||
        loc.includes("chicago") ||
        loc.includes("boston") ||
        loc.includes("dallas") ||
        /[,\-]\s*(ny|tx|ca|il|ma|ga|fl|ct|nj|dc)\b/i.test(loc) ||
        loc.includes("americas") ||
        // Blackstone is US-headquartered so include if no country hint
        (!loc.includes("london") && !loc.includes("uk") && !loc.includes("dublin") && !loc.includes("hong kong") && !loc.includes("singapore") && !loc.includes("tokyo") && !loc.includes("sydney") && !loc.includes("luxembourg") && !loc.includes("germany") && !loc.includes("france"))
      );
    })
    .map((job) => ({
      title: job.title || "N/A",
      link: `${SITE_URL}${job.externalPath}`,
      location: job.locationsText || "",
      category: categorizeJob(job.title || ""),
      postedDate: parseWorkdayDate(job.postedOn),
    }));
}

export async function GET() {
  try {
    // Search for analyst and intern roles, deduplicate by link
    const seen = new Set();
    const allJobs = [];

    for (const searchText of ["analyst", "intern"]) {
      let offset = 0;
      while (true) {
        const data = await fetchPage(searchText, offset);
        const total = data.total || 0;
        const jobs = parseJobs(data);

        for (const job of jobs) {
          if (!seen.has(job.link)) {
            seen.add(job.link);
            allJobs.push(job);
          }
        }

        if (offset + 20 >= total) break;
        offset += 20;
        await sleep(500);
      }
    }

    return Response.json({ jobs: allJobs, count: allJobs.length });
  } catch (err) {
    console.error("Blackstone API error:", err);
    return Response.json({ error: "Failed to fetch Blackstone jobs" }, { status: 500 });
  }
}
