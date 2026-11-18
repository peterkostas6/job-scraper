// TEMP: checks whether Workday answers from Vercel region pdx1. Delete after testing.
export const dynamic = "force-dynamic";
export const preferredRegion = "pdx1";
export async function GET() {
  const out = {};
  for (const [k, u] of [["mizuho", "https://mizuho.wd1.myworkdayjobs.com/wday/cxs/mizuho/mizuhoamericas/jobs"], ["td", "https://td.wd3.myworkdayjobs.com/wday/cxs/td/TD_Bank_Careers/jobs"], ["pnc", "https://pnc.wd5.myworkdayjobs.com/wday/cxs/pnc/External/jobs"]]) {
    const res = await fetch(u, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" }, body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: "analyst" }) });
    out[k] = res.status;
  }
  return Response.json({ region: process.env.VERCEL_REGION, out });
}
