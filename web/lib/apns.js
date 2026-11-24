// Sends push notifications to the iPhone app through Apple (APNs), with no extra packages:
// HTTP/2 from node:http2 and an ES256 token signed with node:crypto.
//   APNS_KEY     the .p8 key file's text (Apple Developer > Keys, "Apple Push Notifications service")
//   APNS_KEY_ID  that key's 10-character ID
//   APNS_TEAM_ID the Apple Developer team ID
import http2 from "node:http2";
import crypto from "node:crypto";

const TOPIC = "com.petespostings.app";
const HOSTS = { production: "https://api.push.apple.com", sandbox: "https://api.sandbox.push.apple.com" };

export const apnsConfigured = () => Boolean(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);

// Apple accepts one token for up to an hour and rejects re-signing more than every 20 minutes.
let cached = { jwt: "", at: 0 };
function providerToken() {
  if (cached.jwt && Date.now() - cached.at < 40 * 60 * 1000) return cached.jwt;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "ES256", kid: process.env.APNS_KEY_ID })}.${b64({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) })}`;
  const key = process.env.APNS_KEY.replace(/\\n/g, "\n");
  const sig = crypto.sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  cached = { jwt: `${unsigned}.${sig}`, at: Date.now() };
  return cached.jwt;
}

function post(host, token, body) {
  return new Promise((resolve) => {
    const client = http2.connect(host);
    client.on("error", (err) => resolve({ status: 0, reason: err.message }));
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${providerToken()}`,
      "apns-topic": TOPIC,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    let status = 0, data = "";
    req.on("response", (h) => { status = h[":status"]; });
    req.on("data", (c) => { data += c; });
    req.on("end", () => { client.close(); let reason = ""; try { reason = JSON.parse(data).reason; } catch {} resolve({ status, reason }); });
    req.on("error", (err) => { client.close(); resolve({ status: 0, reason: err.message }); });
    req.end(JSON.stringify(body));
  });
}

// Sends one notification to each token. Builds installed from Xcode use Apple's test servers,
// App Store builds the real ones; a token from the wrong one gets BadDeviceToken, so try both.
// Returns { sent, dead } — dead tokens (app deleted, notifications turned off) should be dropped.
export async function sendPush(tokens, { title, body, url }) {
  const payload = { aps: { alert: { title, body }, sound: "default" }, url };
  const out = { sent: 0, dead: [], errors: [] };
  for (const token of tokens) {
    let r = await post(HOSTS.production, token, payload);
    if (r.status === 400 && r.reason === "BadDeviceToken") r = await post(HOSTS.sandbox, token, payload);
    if (r.status === 200) out.sent++;
    else if (r.status === 410 || r.reason === "BadDeviceToken" || r.reason === "Unregistered") out.dead.push(token);
    else out.errors.push(`${r.status} ${r.reason}`);
  }
  return out;
}
