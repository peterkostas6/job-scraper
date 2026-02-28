// GET /api/jobs-wells — fetches Wells Fargo analyst & intern jobs from Workday

export const dynamic = "force-dynamic";

const WORKDAY_URL = "https://wd1.myworkdaysite.com/wday/cxs/wf/WellsFargoJobs/jobs";
const WORKDAY_SITE = "https://wd1.myworkdaysite.com/en-US/WellsFargoJobs";

function isUSLocation(loc) {
  if (!loc) return true;
  const l = loc.toLowerCase();
  if (l.includes("united states")) return true;
  if (/[,\-]\s*(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)\b/i.test(l)) return true;
  if (l.includes("new york") || l.includes("chicago") || l.includes("san francisco") || l.includes("los angeles") || l.includes("boston") || l.includes("houston") || l.includes("dallas") || l.includes("miami") || l.includes("atlanta") || l.includes("seattle") || l.includes("charlotte") || l.includes("whippany") || l.includes("wilmington")) return true;
  if (l.includes("multiple")) return true;
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function fetchPage(offset = 0) {
  const res = await fetch(WORKDAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    },
    body: JSON.stringify({
      appliedFacets: {},
      limit: 20,
      offset,
      searchText: "analyst",
    }),
  });
  if (!res.ok) throw new Error(`Wells Fargo Workday returned ${res.status}`);
  return res.json();
}

export async function GET() {
  try {
    const allJobs = [];
    let offset = 0;

    while (true) {
      const data = await fetchPage(offset);
      const total = data.total || 0;
      const postings = data.jobPostings || [];

      for (const job of postings) {
        const title = job.title || "N/A";
        const t = title.toLowerCase();
        if (!t.includes("analyst") && !t.includes("intern") && !t.includes("summer") && !t.includes("trainee") && !t.includes("placement")) continue;
        if (!isUSLocation(job.locationsText || "")) continue;
        allJobs.push({
          title,
          link: `${WORKDAY_SITE}${job.externalPath}`,
          location: job.locationsText || "",
          category: categorizeJob(title),
          postedDate: parseWorkdayDate(job.postedOn),
        });
      }

      if (offset + 20 >= total) break;
      offset += 20;
      await sleep(1000);
    }

    return Response.json({ jobs: allJobs, count: allJobs.length });
  } catch (err) {
    console.error("Wells Fargo API error:", err);
    return Response.json({ error: "Failed to fetch Wells Fargo jobs" }, { status: 500 });
  }
}
