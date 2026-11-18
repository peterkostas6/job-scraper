// TEMP: checks whether Workday answers from Vercel region iad1. Delete after testing.
export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";
export async function GET() {
  const out = {};
  for (const [k, u] of [["mizuho", "https://wd1.myworkdaysite.com/wday/cxs/mizuho/mizuhoamericas/jobs"], ["td", "https://wd3.myworkdaysite.com/wday/cxs/td/TD_Bank_Careers/jobs"], ["pnc", "https://wd5.myworkdaysite.com/wday/cxs/pnc/External/jobs"]]) {
    const res = await fetch(u, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" }, body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: "analyst" }) });
    out[k] = res.status;
  }
  return Response.json({ region: process.env.VERCEL_REGION, out });
}
