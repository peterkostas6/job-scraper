// GET /api/admin/users — Pete only, must be logged in via Clerk
import { clerkClient, auth } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";

const ADMIN_USER_ID = "user_39bPOyYQAsr7t2Cki8GNEql1mY1";

// Every message on the Twilio account with the price Twilio charged. Outbound texts are
// keyed by the number they went to, inbound replies by the number they came from.
// price is null until Twilio finalizes it (usually within a few minutes of sending).
async function twilioMessages() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  const headers = { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}` };
  const messages = [];
  let uri = `/2010-04-01/Accounts/${accountSid}/Messages.json?PageSize=1000`;
  for (let page = 0; uri && page < 50; page++) {
    const resp = await fetch(`https://api.twilio.com${uri}`, { headers, cache: "no-store" });
    if (!resp.ok) throw new Error(`Twilio ${resp.status}`);
    const body = await resp.json();
    for (const m of body.messages || []) {
      messages.push({
        sid: m.sid,
        phone: m.direction === "inbound" ? m.from : m.to,
        price: m.price == null ? null : Math.abs(Number(m.price)),
      });
    }
    uri = body.next_page_uri;
  }
  return messages;
}

// Per-user text cost. A message is matched to a user by its SID in notification_log first,
// then by phone number (from the log or the user's current saved number).
async function smsCosts(allUsers) {
  const messages = await twilioMessages();
  if (!messages) return null;
  const sidToUser = new Map();
  const phoneToUser = new Map();
  for (const u of allUsers) {
    const phone = u.unsafeMetadata?.notifications?.phoneNumber;
    if (phone) phoneToUser.set(phone, u.id);
  }
  const { rows } = await sql`
    SELECT user_id, recipient, provider_id FROM notification_log
    WHERE user_id IS NOT NULL AND channel IN ('sms', 'sms-optout-notice')
    ORDER BY created_at
  `;
  for (const r of rows) {
    if (r.provider_id) sidToUser.set(r.provider_id, r.user_id);
    if (r.recipient && !phoneToUser.has(r.recipient)) phoneToUser.set(r.recipient, r.user_id);
  }
  const byUser = new Map();
  const unmatched = { cost: 0, count: 0 };
  for (const m of messages) {
    const userId = sidToUser.get(m.sid) || phoneToUser.get(m.phone);
    const bucket = userId ? byUser.get(userId) || { cost: 0, count: 0, pending: 0 } : unmatched;
    bucket.count++;
    if (m.price == null) bucket.pending = (bucket.pending || 0) + 1;
    else bucket.cost += m.price;
    if (userId) byUser.set(userId, bucket);
  }
  const total = messages.reduce((sum, m) => sum + (m.price || 0), 0);
  return { byUser, unmatched, total, count: messages.length };
}

const money = (n) => `$${n.toFixed(n > 0 && n < 1 ? 4 : 2)}`;

export async function GET() {
  const { userId } = await auth();

  if (userId !== ADMIN_USER_ID) {
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

  let costs = null;
  let costError = null;
  try {
    costs = await smsCosts(allUsers);
    if (!costs) costError = "Twilio credentials not set";
  } catch (err) {
    costError = err?.message || String(err);
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
      sms: costs?.byUser.get(u.id) || { cost: 0, count: 0, pending: 0 },
    };
  });

  const smsCell = (u) => u.notifications.smsEnabled
    ? `<span class="badge badge-on">${u.notifications.phone || "On"}</span>`
    : u.notifications.phone ? `<span class="badge badge-off">${u.notifications.phone} (off)</span>` : "—";
  const costCell = (u) => costError ? "?" : u.sms.count === 0 ? "—"
    : `${money(u.sms.cost)} <span class="sub">${u.sms.count} msg${u.sms.count === 1 ? "" : "s"}${u.sms.pending ? `, ${u.sms.pending} pending` : ""}</span>`;
  const byCost = (a, b) => b.sms.cost - a.sms.cost;

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
    .sub { color: #94a3b8; font-size: 11px; }
  </style>
</head>
<body>
  <h1>Pete's Postings — User Admin</h1>
  <div class="meta">${allUsers.length} total users &nbsp;·&nbsp; ${paid.length} paid &nbsp;·&nbsp; ${free.length} free</div>
  <div class="meta">Text messages: ${costError ? `cost unavailable (${costError})` : `${money(costs.total)} across ${costs.count} messages${costs.unmatched.count ? ` &nbsp;·&nbsp; ${money(costs.unmatched.cost)} on ${costs.unmatched.count} not matched to a user` : ""}`}</div>

  <h2>Paid Users (${paid.length})</h2>
  <table>
    <tr>
      <th>Name</th><th>Email</th><th>Notifications</th><th>Banks</th><th>Job Type</th><th>Location</th><th>SMS</th><th>Text cost</th>
    </tr>
    ${paid.sort(byCost).map((u) => `
    <tr>
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td><span class="badge ${u.notifications.enabled ? "badge-on" : "badge-off"}">${u.notifications.enabled ? "On" : "Off"}</span></td>
      <td>${u.notifications.banks}</td>
      <td>${u.notifications.jobType}</td>
      <td>${u.notifications.location}</td>
      <td>${smsCell(u)}</td>
      <td>${costCell(u)}</td>
    </tr>`).join("")}
  </table>

  <h2>Free Users (${free.length})</h2>
  <table>
    <tr><th>Name</th><th>Email</th><th>SMS</th><th>Text cost</th></tr>
    ${free.sort(byCost).map((u) => `
    <tr><td>${u.name}</td><td>${u.email}</td><td>${smsCell(u)}</td><td>${costCell(u)}</td></tr>`).join("")}
  </table>
</body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
