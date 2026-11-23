// Tests each candidate firm's job board and writes lib/firm-registry.js with the ones that
// return US finance roles. Run after scripts/gen-firm-candidates.py:
//   node scripts/check-firms.mjs candidates.json
// Big organisations (banks, insurers, asset managers) are searched by keyword on Workday so a
// check stays inside the 60-second route limit; small firms list every job.
import fs from "fs";
import { fetchSourceJobs } from "../lib/firm-sources.js";
import { isListedRole } from "../lib/notif-helpers.js";

const BIG = new Set(["bank", "insurance", "asset", "exchange", "fintech"]);
const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const only = process.argv[3] ? new Set(process.argv[3].split(",")) : null; // e.g. greenhouse,lever

// One registry entry per firm name; its boards are checked together.
const byName = new Map();
for (const r of rows) {
  if (only && !only.has(r.src.type)) continue;
  const src = r.src.type === "workday" && BIG.has(r.type) ? { ...r.src, search: true } : r.src;
  const f = byName.get(r.name) || { key: r.key, name: r.name, type: r.type, src: [] };
  f.src.push(src);
  byName.set(r.name, f);
}
const firms = [...byName.values()];
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

const results = [];
let i = 0;
async function worker() {
  while (i < firms.length) {
    const f = firms[i++];
    const t0 = Date.now();
    try {
      const jobs = (await withTimeout(fetchSourceJobs(f.src), 55000)).filter((j) => isListedRole(j.title));
      results.push({ ...f, jobs: jobs.length, sample: jobs.map((j) => j.link).sort().slice(0, 5), ms: Date.now() - t0 });
    } catch (e) {
      results.push({ ...f, jobs: 0, error: String(e.message || e).slice(0, 80), ms: Date.now() - t0 });
    }
    process.stdout.write(".");
  }
}
await Promise.all(Array.from({ length: 10 }, worker));
console.log();

// Two names for one board (e.g. "Marsh" and "Marsh & McLennan") return the same jobs: keep one.
const seenBoards = new Set();
const ok = results.filter((r) => r.jobs > 0).sort((a, b) => b.jobs - a.jobs || a.key.localeCompare(b.key)).filter((r) => {
  const sig = r.sample.join("|");
  if (seenBoards.has(sig)) return false;
  seenBoards.add(sig);
  return true;
});
const prev = fs.existsSync("lib/firm-registry.js") ? fs.readFileSync("lib/firm-registry.js", "utf8") : "";
const keep = {};
// Re-runs for one board type keep the firms already written for the others.
for (const m of prev.matchAll(/^  "?([a-z0-9]+)"?: (\{.*\}),$/gm)) keep[m[1]] = m[2];
for (const r of ok) keep[r.key] = JSON.stringify({ name: r.name, type: r.type, src: r.src.length === 1 ? r.src[0] : r.src });
const out = `// Firms added from public job-board ids (see scripts/gen-firm-candidates.py and
// scripts/check-firms.mjs). Each entry: display name, firm type (for grouping on the site)
// and its job board(s), read by the adapters in lib/firm-sources.js. The cron checks these
// in rotating batches; lib/banks.js keeps the original banks on every 5-minute run.
export const FIRM_REGISTRY = {
${Object.keys(keep).sort().map((k) => `  ${/^[a-z_]/.test(k) ? k : JSON.stringify(k)}: ${keep[k]},`).join("\n")}
};
`;
fs.writeFileSync("lib/firm-registry.js", out);
fs.writeFileSync(process.argv[2].replace(/\.json$/, "") + ".results.json", JSON.stringify(results, null, 1));
const errs = results.filter((r) => r.error);
console.log(`${firms.length} firms checked: ${ok.length} with US finance roles (${ok.reduce((s, r) => s + r.jobs, 0)} roles), ${results.length - ok.length - errs.length} empty, ${errs.length} errors`);
const slow = results.filter((r) => r.ms > 30000).map((r) => `${r.name} ${Math.round(r.ms / 1000)}s`);
if (slow.length) console.log("slow:", slow.join(", "));
