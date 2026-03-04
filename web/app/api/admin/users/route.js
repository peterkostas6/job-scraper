// GET /api/admin/users?secret=YOUR_CRON_SECRET
// Returns all Clerk users with subscription status and notification preferences
import { clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await clerkClient();
  let allUsers = [];
  let offset = 0;

  while (true) {
    const { data } = await client.users.getUserList({ limit: 100, offset });
    if (!data || data.length === 0) break;
    allUsers.push(...data);
    if (data.length < 100) break;
    offset += 100;
  }

  const users = allUsers.map((u) => {
    const prefs = u.unsafeMetadata?.notifications || {};
    return {
      id: u.id,
      name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || "(no name)",
      email: u.emailAddresses?.[0]?.emailAddress || "(no email)",
      subscribed: u.publicMetadata?.subscribed === true,
      notifications: {
        enabled: prefs.enabled || false,
        banks: prefs.banks?.length ? prefs.banks.join(", ") : "all",
        jobType: prefs.jobType || "all",
        location: prefs.location || "any",
        smsEnabled: prefs.smsEnabled || false,
        phone: prefs.phoneNumber || null,
      },
    };
  });

  const paid = users.filter((u) => u.subscribed);
  const free = users.filter((u) => !u.subscribed);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Pete's Postings — Users</title>
  <style>
    body { font-family: -apple-system, sans-serif; padding: 32px; background: #f8fafc; color: #1e293b; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { font-size: 13px; color: #64748b; margin-bottom: 32px; }
    h2 { font-size: 15px; font-weight: 700; margin: 32px 0 12px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); font-size: 13px; }
    th { background: #f1f5f9; text-align: left; padding: 10px 14px; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; }
    td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .badge-paid { background: #dcfce7; color: #15803d; }
    .badge-free { background: #f1f5f9; color: #64748b; }
    .badge-on { background: #dbeafe; color: #1d4ed8; }
    .badge-off { background: #f1f5f9; color: #94a3b8; }
  </style>
</head>
<body>
  <h1>Pete's Postings — User Admin</h1>
  <div class="meta">${allUsers.length} total users &nbsp;·&nbsp; ${paid.length} paid &nbsp;·&nbsp; ${free.length} free</div>

  <h2>Paid Users (${paid.length})</h2>
  <table>
    <tr>
      <th>Name</th><th>Email</th><th>Notifications</th><th>Banks</th><th>Job Type</th><th>Location</th><th>SMS</th>
    </tr>
    ${paid.map((u) => `
    <tr>
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td><span class="badge ${u.notifications.enabled ? "badge-on" : "badge-off"}">${u.notifications.enabled ? "On" : "Off"}</span></td>
      <td>${u.notifications.banks}</td>
      <td>${u.notifications.jobType}</td>
      <td>${u.notifications.location}</td>
      <td>${u.notifications.smsEnabled ? `<span class="badge badge-on">${u.notifications.phone || "On"}</span>` : "—"}</td>
    </tr>`).join("")}
  </table>

  <h2>Free Users (${free.length})</h2>
  <table>
    <tr><th>Name</th><th>Email</th></tr>
    ${free.map((u) => `
    <tr><td>${u.name}</td><td>${u.email}</td></tr>`).join("")}
  </table>
</body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
