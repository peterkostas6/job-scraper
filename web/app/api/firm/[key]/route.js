// GET /api/firm/<key> — US jobs for one firm in lib/firm-sources.js or lib/firm-registry.js.
import { fetchFirmJobs, FIRM_SOURCES } from "@/lib/firm-sources";
import { FIRM_REGISTRY } from "@/lib/firm-registry";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

export async function GET(_request, { params }) {
  const { key } = await params;
  if (!FIRM_SOURCES[key] && !FIRM_REGISTRY[key]) return Response.json({ error: "Unknown firm" }, { status: 404 });
  try {
    const jobs = await fetchFirmJobs(key);
    return Response.json({ jobs, count: jobs.length });
  } catch (err) {
    console.error(`Firm ${key} scrape error:`, err);
    return Response.json({ error: `Failed to fetch ${key} jobs`, detail: err.message }, { status: 500 });
  }
}
