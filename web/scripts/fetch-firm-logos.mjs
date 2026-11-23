// Logos for the registry firms (lib/firm-registry.js), saved to public/banks/<key>.png like the
// original banks' icons. Each firm's website comes from its public Simplify company page
// (schema.org Organization "url"); the icon comes from Google's favicon service and is stored
// in the repo, so visitors' browsers never call Google. Firms whose site has no real icon
// (Google answers 404 with its generic globe) keep the letter tile.
//   node scripts/fetch-firm-logos.mjs internships.json new-grad.json
import fs from "fs";
import { FIRM_REGISTRY } from "../lib/firm-registry.js";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
const companyPage = new Map(); // firm name -> simplify.jobs/c/... page
for (const f of process.argv.slice(2)) {
  for (const x of JSON.parse(fs.readFileSync(f, "utf8"))) {
    if (x.company_name && x.company_url && !companyPage.has(x.company_name.trim())) companyPage.set(x.company_name.trim(), x.company_url);
  }
}

const results = {};
// Google's generic globe (what it returns for a domain with no icon), to recognise and skip.
const GLOBE = Buffer.from(await (await fetch("https://www.google.com/s2/favicons?domain=no-such-site-petespostings.invalid&sz=128")).arrayBuffer()).toString("base64");
const keys = Object.keys(FIRM_REGISTRY);
let i = 0;
async function worker() {
  while (i < keys.length) {
    const key = keys[i++];
    const firm = FIRM_REGISTRY[key];
    const out = `public/banks/${key}.png`;
    if (fs.existsSync(out)) { results[key] = "had"; continue; }
    const page = companyPage.get(firm.name) || [...companyPage].find(([n]) => n.startsWith(firm.name))?.[1];
    if (!page) { results[key] = "no simplify page"; continue; }
    try {
      const html = await (await fetch(page, { headers: { "User-Agent": UA } })).text();
      // The firm's "Website" button links out with ?utm_source=Simplify (Simplify's own
      // Organization block also has a "url", so don't read that one).
      const site = html.match(/href="(https?:\/\/[^"?]+)\/?\?utm_source=Simplify"/)?.[1];
      if (!site) { results[key] = "no website on page"; continue; }
      const domain = new URL(site).hostname.replace(/^www\./, "");
      const res = await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`, { headers: { "User-Agent": UA } });
      if (!res.ok) { results[key] = `no icon (${domain})`; continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 300) { results[key] = `tiny icon (${domain})`; continue; }
      const sig = buf.toString("base64");
      if (sig === GLOBE) { results[key] = `generic globe (${domain})`; continue; }
      fs.writeFileSync(out, buf);
      results[key] = `saved (${domain}, ${buf.length}b)`;
    } catch (e) {
      results[key] = "error " + String(e.message || e).slice(0, 60);
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

const saved = Object.entries(results).filter(([, v]) => v.startsWith("saved") || v === "had").map(([k]) => k).sort();
fs.writeFileSync("lib/firm-logos.js", `// Registry firms with an icon in public/banks/<key>.png (written by scripts/fetch-firm-logos.mjs).
export const FIRM_LOGOS = new Set(${JSON.stringify(saved)});
`);
const tally = {};
for (const v of Object.values(results)) { const k = v.split(" (")[0]; tally[k] = (tally[k] || 0) + 1; }
console.log(`${keys.length} firms:`, tally);
fs.writeFileSync(process.argv[2].replace(/[^/]+$/, "logo-results.json"), JSON.stringify(results, null, 1));
