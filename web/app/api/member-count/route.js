// GET /api/member-count — how many accounts exist, for the homepage member meter.
// The CDN caches it for 5 minutes so a busy homepage doesn't call Clerk on every visit.
import { clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = await clerkClient();
    const count = await client.users.getCount();
    return Response.json({ count }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (err) {
    console.error("member-count failed:", err?.message || err);
    return Response.json({ count: null }, { status: 500 });
  }
}
