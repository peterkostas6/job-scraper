// Shared email layer: brand constants, an accessible HTML layout, plain-text pairing,
// signed unsubscribe links, and a send wrapper with idempotency, retry, and timeout.
// Follows the Resend email-best-practices skill (accessibility, compliance, reliability).
import crypto from "crypto";

export const BRAND = {
  name: "Pete's Postings",
  site: "https://petespostings.com",
  fromHello: "Pete's Postings <hello@petespostings.com>",
  fromAlerts: "Pete's Postings <notifications@petespostings.com>",
  replyTo: process.env.EMAIL_REPLY_TO || "pete@petespostings.com",
  // CAN-SPAM asks for a postal address on commercial mail. Set EMAIL_POSTAL_ADDRESS in Vercel.
  postalAddress: process.env.EMAIL_POSTAL_ADDRESS || "",
};

const C = {
  cream: "#faf8f5",
  white: "#ffffff",
  navy: "#1e293b",
  blue: "#2563eb",
  text: "#1f2937",     // 12.6:1 on white
  muted: "#4b5563",    // 7.5:1 on white, 6.9:1 on cream
  hairline: "#e2e8f0",
  amber: "#b45309",    // 5.2:1 on white (badge text)
};

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** A button rendered as a table so it is tappable (44px+) everywhere, including Outlook. */
export function button(label, url) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
  <tr>
    <td style="border-radius:8px;background:${C.blue};">
      <a href="${escapeHtml(url)}" style="display:inline-block;min-width:200px;padding:14px 28px;font-size:16px;line-height:20px;font-weight:600;color:${C.white};text-decoration:none;border-radius:8px;text-align:center;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

/**
 * Accessible shell shared by every email.
 * - lang/dir on <html> and on the body's first child
 * - <title> that names this email, not the brand
 * - hidden preheader
 * - layout tables marked presentational
 * - one <h1>, 16px body text, 4.5:1 contrast on light and cream
 * - footer with sender identity, optional postal address, and unsubscribe / preferences links
 */
export function layout({ title, preheader = "", heading, intro = "", body = "", cta = null, outro = "", footer = {}, lang = "en" }) {
  const { reason = "", unsubscribeUrl = "", preferencesUrl = "" } = footer;
  const footerLinks = [
    preferencesUrl ? `<a href="${escapeHtml(preferencesUrl)}" style="color:${C.muted};text-decoration:underline;">Manage your alert preferences</a>` : "",
    unsubscribeUrl ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:${C.muted};text-decoration:underline;">Unsubscribe from alerts</a>` : "",
  ].filter(Boolean).join(` &nbsp;&middot;&nbsp; `);

  return `<!DOCTYPE html>
<html lang="${lang}" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.cream};">
  <div lang="${lang}" dir="ltr" style="background:${C.cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${C.text};">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}${"&#8203;&nbsp;".repeat(40)}</div>` : ""}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.cream};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">
            <tr>
              <td style="padding:0 8px 20px;">
                <a href="${BRAND.site}" style="font-size:16px;font-weight:800;color:${C.navy};text-decoration:none;">Pete&rsquo;s Postings</a>
              </td>
            </tr>
            <tr>
              <td style="background:${C.white};border:1px solid ${C.hairline};border-radius:12px;padding:32px 28px;">
                <h1 style="margin:0 0 12px;font-size:24px;line-height:30px;font-weight:800;letter-spacing:-0.01em;color:${C.navy};">${escapeHtml(heading)}</h1>
                ${intro ? `<p style="margin:0 0 20px;font-size:16px;line-height:24px;color:${C.text};">${intro}</p>` : ""}
                ${body}
                ${cta ? `<div style="padding:8px 0 4px;">${button(cta.label, cta.url)}</div>` : ""}
                ${outro ? `<p style="margin:20px 0 0;font-size:16px;line-height:24px;color:${C.text};">${outro}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 8px 0;font-size:13px;line-height:20px;color:${C.muted};">
                ${reason ? `<p style="margin:0 0 8px;">${reason}</p>` : ""}
                ${footerLinks ? `<p style="margin:0 0 8px;">${footerLinks}</p>` : ""}
                <p style="margin:0;">Pete&rsquo;s Postings${BRAND.postalAddress ? ` &middot; ${escapeHtml(BRAND.postalAddress)}` : ""} &middot; Not affiliated with any listed bank.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

function decodeEntities(s) {
  return String(s).replace(/&rsquo;/g, "\u2019").replace(/&lsquo;/g, "\u2018").replace(/&middot;/g, "\u00b7").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
}

/** Plain-text pairing for the HTML version. `lines` is an array of strings; blank strings become paragraph breaks. */
export function textVersion(lines, footer = {}) {
  const out = [...lines, ""];
  if (footer.reason) out.push(decodeEntities(footer.reason.replace(/<[^>]+>/g, "")));
  if (footer.preferencesUrl) out.push(`Manage your alert preferences: ${footer.preferencesUrl}`);
  if (footer.unsubscribeUrl) out.push(`Unsubscribe from alerts: ${footer.unsubscribeUrl}`);
  out.push(`Pete's Postings${BRAND.postalAddress ? ` · ${BRAND.postalAddress}` : ""} · Not affiliated with any listed bank.`);
  return out.join("\n");
}

// ---- Unsubscribe links (signed, no login needed, honoured immediately) ----
function unsubSecret() {
  return process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";
}
export function unsubscribeToken(userId) {
  return crypto.createHmac("sha256", unsubSecret()).update(`unsub:${userId}`).digest("base64url");
}
export function verifyUnsubscribeToken(userId, token) {
  if (!userId || !token) return false;
  const expected = unsubscribeToken(userId);
  const a = Buffer.from(expected), b = Buffer.from(String(token));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function unsubscribeUrl(userId) {
  return `${BRAND.site}/api/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;
}
export const preferencesUrl = `${BRAND.site}/notifications`;

// ---- Send wrapper: idempotency key, retry with backoff on 5xx/429/timeouts, 15s timeout ----
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function isRetryable(err) {
  const code = err?.statusCode || err?.status || err?.response?.status;
  return code === 429 || (code >= 500 && code < 600) || err?.name === "AbortError" || err?.code === "ETIMEDOUT";
}

export async function sendEmail(resend, { to, subject, html, text, from = BRAND.fromHello, replyTo = BRAND.replyTo, headers = {}, idempotencyKey, tags }, { maxRetries = 3 } = {}) {
  const payload = { from, to, subject, html, text, reply_to: replyTo, headers, tags };
  const options = idempotencyKey ? { idempotencyKey } : {};
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data, error } = await resend.emails.send(payload, options);
      if (error) {
        const err = Object.assign(new Error(error.message || "Resend error"), { statusCode: error.statusCode });
        throw err;
      }
      return data;
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxRetries - 1) throw err;
      await sleep(Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 500);
    }
  }
  throw lastErr;
}
