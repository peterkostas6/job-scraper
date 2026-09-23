// Every customer-facing email, built on the shared layout in lib/email.js.
import { layout, textVersion, escapeHtml, unsubscribeUrl, preferencesUrl, BRAND } from "@/lib/email";
import { isInternship } from "@/lib/notif-helpers";

const C = { navy: "#1e293b", text: "#1f2937", muted: "#4b5563", hairline: "#e2e8f0", blue: "#2563eb", amber: "#b45309" };

// ---------- Job alert (transactional: user opted in to alerts) ----------
const MAX_LISTED = 20;

export function alertEmail({ jobs: allJobs, firstName, userId }) {
  // Cap the list so a backlog never produces a 100-row email; the CTA covers the rest.
  const jobs = allJobs.slice(0, MAX_LISTED);
  const hidden = allJobs.length - jobs.length;
  const grouped = {};
  for (const job of jobs) (grouped[job.bank || "Other"] ||= []).push(job);
  const banks = Object.keys(grouped);
  const n = allJobs.length;

  const subject = n === 1
    ? `New at ${banks[0]}: ${truncate(jobs[0].title, 40)}`
    : `${n} new roles at ${banks.length === 1 ? banks[0] : `${banks[0]} and ${banks.length - 1} more`}`;
  const preheader = n === 1 ? `${jobs[0].location || ""}`.trim() : jobs.slice(0, 2).map((j) => j.title).join(" · ");

  let body = "";
  for (const bank of banks) {
    body += `<h2 style="margin:20px 0 4px;font-size:14px;line-height:20px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${C.muted};">${escapeHtml(bank)}</h2>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">`;
    for (const job of grouped[bank]) {
      const type = isInternship(job.title) ? "Internship" : "Analyst";
      const typeColor = type === "Internship" ? C.amber : C.blue;
      body += `
  <tr>
    <td style="padding:12px 0;border-top:1px solid ${C.hairline};">
      <a href="${escapeHtml(job.link)}" style="font-size:16px;line-height:22px;font-weight:600;color:${C.navy};text-decoration:underline;text-decoration-color:${C.hairline};">${escapeHtml(job.title)}</a>
      <div style="margin-top:4px;font-size:14px;line-height:20px;color:${C.muted};">${escapeHtml(job.location || "Location not listed")} &nbsp;&middot;&nbsp; <span style="font-weight:600;color:${typeColor};">${type}</span></div>
    </td>
  </tr>`;
    }
    body += `</table>`;
  }
  if (hidden > 0) body += `<p style="margin:16px 0 0;font-size:15px;line-height:22px;color:${C.muted};">Plus ${hidden} more on the Recent tab.</p>`;

  const footer = {
    reason: "You get this email because you turned on job alerts in your Pete&rsquo;s Postings dashboard.",
    unsubscribeUrl: unsubscribeUrl(userId),
    preferencesUrl,
  };
  const html = layout({
    title: subject,
    preheader,
    heading: n === 1 ? "A new role matches your alerts" : `${n} new roles match your alerts`,
    intro: `${firstName ? `Hi ${escapeHtml(firstName)}, ` : ""}${n === 1 ? "this posting" : "these postings"} went live in the last few minutes. Early applications get read first.`,
    body,
    cta: { label: "See every recent posting", url: `${BRAND.site}/recent` },
    footer,
  });
  const text = textVersion([
    n === 1 ? "A new role matches your alerts" : `${n} new roles match your alerts`,
    "",
    ...banks.flatMap((bank) => [bank.toUpperCase(), ...grouped[bank].map((j) => `- ${j.title} (${j.location || "location not listed"})\n  ${j.link}`), ""]),
    `See every recent posting: ${BRAND.site}/recent`,
  ], footer);
  return { subject, html, text };
}

// ---------- Welcome (transactional, not promotional) ----------
export function welcomeEmail({ firstName, bankCount = 20 }) {
  const subject = "Welcome to Pete's Postings";
  const html = layout({
    title: subject,
    preheader: `Analyst and intern roles from ${bankCount} banks, checked every 5 minutes.`,
    heading: `Welcome${firstName ? `, ${escapeHtml(firstName)}` : ""}`,
    intro: `Your account is ready. Pete&rsquo;s Postings pulls analyst and intern roles straight from ${bankCount} bank career sites and checks them every 5 minutes, so you see a posting before it reaches the job boards.`,
    body: `
<h2 style="margin:8px 0 8px;font-size:16px;line-height:22px;font-weight:700;color:${C.navy};">Three things to do first</h2>
<ol style="margin:0 0 20px;padding-left:22px;font-size:16px;line-height:26px;color:${C.text};">
  <li><a href="${BRAND.site}/jobs" style="color:${C.blue};">Browse the live feed</a> and filter by bank, location, and role type.</li>
  <li>Bookmark roles you plan to apply to. They stay in <a href="${BRAND.site}/saved" style="color:${C.blue};">Saved jobs</a>.</li>
  <li>Turn on <a href="${BRAND.site}/notifications" style="color:${C.blue};">alerts</a> for the banks you care about to get a text or email within minutes of a posting.</li>
</ol>
<p style="margin:0 0 20px;font-size:16px;line-height:24px;color:${C.text};">What to expect from us by email: a confirmation when you change alert settings, and job alerts only if you turn them on. Nothing else.</p>`,
    cta: { label: "Open the live feed", url: `${BRAND.site}/jobs` },
    outro: `Questions? Reply to this email and it reaches Pete directly.`,
    footer: {},
  });
  const text = textVersion([
    `Welcome${firstName ? `, ${firstName}` : ""}`,
    "",
    `Your account is ready. Pete's Postings pulls analyst and intern roles straight from ${bankCount} bank career sites and checks them every 5 minutes.`,
    "",
    "Three things to do first:",
    `1. Browse the live feed: ${BRAND.site}/jobs`,
    `2. Bookmark roles you plan to apply to: ${BRAND.site}/saved`,
    `3. Turn on alerts for the banks you care about: ${BRAND.site}/notifications`,
    "",
    "What to expect by email: a confirmation when you change alert settings, and job alerts only if you turn them on.",
    "",
    "Questions? Reply to this email and it reaches Pete directly.",
  ]);
  return { subject, html, text };
}

// ---------- Alert preferences confirmation (transactional) ----------
export function prefsEmail({ firstName, isFirstSetup, enabled, smsEnabled, phoneNumber, bankNames, categories, jobTypeLabel, userId }) {
  const subject = isFirstSetup ? "Your job alerts are on" : "Your alert preferences changed";
  const rows = [
    ["Email alerts", enabled ? "On" : "Off"],
    ["Text alerts", smsEnabled ? `On${phoneNumber ? ` · ${maskPhone(phoneNumber)}` : ""}` : "Off"],
    ["Banks", bankNames.length ? bankNames.join(", ") : "All banks"],
    ["Categories", categories.length ? categories.join(", ") : "All categories"],
    ["Role type", jobTypeLabel],
  ];
  const table = `
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 20px;border-collapse:collapse;">
  <caption style="text-align:left;font-size:14px;line-height:20px;font-weight:700;color:${C.muted};padding:0 0 8px;">Your alert settings</caption>
  <tbody>
    ${rows.map(([k, v]) => `<tr><th scope="row" style="text-align:left;padding:10px 12px 10px 0;font-size:15px;line-height:20px;font-weight:500;color:${C.muted};border-top:1px solid ${C.hairline};width:40%;">${escapeHtml(k)}</th><td style="padding:10px 0;font-size:15px;line-height:20px;font-weight:600;color:${C.navy};border-top:1px solid ${C.hairline};">${escapeHtml(v)}</td></tr>`).join("")}
  </tbody>
</table>`;
  const footer = { reason: "You get this email because you changed your alert settings on Pete&rsquo;s Postings.", unsubscribeUrl: unsubscribeUrl(userId), preferencesUrl };
  const html = layout({
    title: subject,
    preheader: enabled || smsEnabled ? "Alerts arrive within minutes of a matching posting." : "Alerts are off. Turn them back on any time.",
    heading: subject,
    intro: `${firstName ? `Hi ${escapeHtml(firstName)}, ` : ""}${isFirstSetup ? "here is what you will be alerted about." : "here is what is active now."}`,
    body: table + `<p style="margin:0 0 4px;font-size:16px;line-height:24px;color:${C.text};">Alerts go out within minutes of a matching posting, any time of day. Change these settings whenever you like.</p>`,
    cta: { label: "Review alert settings", url: preferencesUrl },
    footer,
  });
  const text = textVersion([subject, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", "Alerts go out within minutes of a matching posting.", `Review alert settings: ${preferencesUrl}`], footer);
  return { subject, html, text };
}

// ---------- Club partnership: confirmation to the requester ----------
export function clubConfirmationEmail({ contactName, clubName, schoolName }) {
  const subject = `We got your inquiry for ${clubName}`;
  const html = layout({
    title: subject,
    preheader: "Pete will reply within 24 hours.",
    heading: "Thanks, we have your inquiry",
    intro: `Hi ${escapeHtml(contactName)}, thanks for reaching out about a club partnership for <strong>${escapeHtml(clubName)}</strong> at <strong>${escapeHtml(schoolName)}</strong>. Pete will reply within 24 hours.`,
    body: `
<h2 style="margin:8px 0 8px;font-size:16px;line-height:22px;font-weight:700;color:${C.navy};">What club membership includes</h2>
<ul style="margin:0 0 20px;padding-left:22px;font-size:16px;line-height:26px;color:${C.text};">
  <li>Every Pro feature for every member</li>
  <li>The Recent tab: every posting from the last 48 hours</li>
  <li>Saved jobs across all banks</li>
  <li>Text and email alerts within minutes of a posting</li>
  <li>Member verification through student email</li>
</ul>`,
    cta: { label: "Browse the live feed meanwhile", url: `${BRAND.site}/jobs` },
    outro: "Need to add something? Reply to this email.",
    footer: {},
  });
  const text = textVersion([`Thanks, we have your inquiry for ${clubName} at ${schoolName}.`, "Pete will reply within 24 hours.", "", `Browse the live feed meanwhile: ${BRAND.site}/jobs`]);
  return { subject, html, text };
}

// ---------- Club partnership: internal notice to Pete ----------
export function clubInquiryEmail({ schoolName, clubName, memberCount, contactName, contactEmail }) {
  const subject = `Club inquiry: ${clubName} at ${schoolName}`;
  const rows = [["School", schoolName], ["Club", clubName], ["Members", memberCount || "Not given"], ["Contact", contactName], ["Email", contactEmail]];
  const html = layout({
    title: subject,
    heading: "New club partnership inquiry",
    body: `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 20px;border-collapse:collapse;"><tbody>${rows.map(([k, v]) => `<tr><th scope="row" style="text-align:left;padding:10px 12px 10px 0;font-size:15px;font-weight:500;color:${C.muted};border-top:1px solid ${C.hairline};width:35%;">${escapeHtml(k)}</th><td style="padding:10px 0;font-size:15px;font-weight:600;color:${C.navy};border-top:1px solid ${C.hairline};">${escapeHtml(v)}</td></tr>`).join("")}</tbody></table>`,
    cta: { label: `Reply to ${contactName}`, url: `mailto:${contactEmail}` },
    footer: {},
  });
  const text = textVersion([subject, "", ...rows.map(([k, v]) => `${k}: ${v}`)]);
  return { subject, html, text };
}

export function companyRequestEmail({ company, name, email }) {
  const subject = `Company request: ${company}`;
  const rows = [["Company", company], ["From", name || "Not given"], ["Email", email]];
  const html = layout({
    title: subject,
    heading: "A Pro member asked for a new company",
    body: `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 20px;border-collapse:collapse;"><tbody>${rows.map(([k, v]) => `<tr><th scope="row" style="text-align:left;padding:10px 12px 10px 0;font-size:15px;font-weight:500;color:${C.muted};border-top:1px solid ${C.hairline};width:35%;">${escapeHtml(k)}</th><td style="padding:10px 0;font-size:15px;font-weight:600;color:${C.navy};border-top:1px solid ${C.hairline};">${escapeHtml(v)}</td></tr>`).join("")}</tbody></table>`,
    cta: { label: `Reply to ${name || email}`, url: `mailto:${email}` },
    footer: {},
  });
  const text = textVersion([subject, "", ...rows.map(([k, v]) => `${k}: ${v}`)]);
  return { subject, html, text };
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function maskPhone(p) { const d = String(p).replace(/\D/g, ""); return d.length >= 4 ? `***-***-${d.slice(-4)}` : p; }
