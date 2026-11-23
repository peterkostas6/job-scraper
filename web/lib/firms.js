// Every firm the site lists: the original banks (lib/banks.js, checked every cron run) plus the
// firms in lib/firm-registry.js (checked in rotating batches). Pages and APIs that need a firm's
// name or type for a job's bank_key read it here.
import { BANKS } from "./banks";
import { FIRM_REGISTRY } from "./firm-registry";

export const FIRM_TYPES = [
  { key: "bank", label: "Banks" },
  { key: "trading", label: "Trading firms" },
  { key: "hedge", label: "Hedge funds" },
  { key: "asset", label: "Asset managers" },
  { key: "pe", label: "Private equity & credit" },
  { key: "exchange", label: "Exchanges & market data" },
  { key: "insurance", label: "Insurance" },
  { key: "fintech", label: "Fintech & payments" },
];

export const ALL_FIRMS = {
  ...Object.fromEntries(Object.entries(FIRM_REGISTRY).map(([k, f]) => [k, { name: f.name, shortName: f.name, type: f.type }])),
  ...Object.fromEntries(Object.entries(BANKS).map(([k, b]) => [k, { ...b, type: "bank", core: true }])),
};
export const FIRM_COUNT = Object.keys(ALL_FIRMS).length;

// The registry firms this cron run checks: the list split into batches, one batch per run in
// turn, so each firm is checked about every BATCHES x 5 minutes without any run growing slow.
export const REGISTRY_BATCH_SIZE = 25;
export function registryBatch(now = Date.now()) {
  const keys = Object.keys(FIRM_REGISTRY).sort();
  const batches = Math.max(1, Math.ceil(keys.length / REGISTRY_BATCH_SIZE));
  const i = Math.floor(now / (5 * 60 * 1000)) % batches;
  return keys.slice(i * REGISTRY_BATCH_SIZE, (i + 1) * REGISTRY_BATCH_SIZE);
}

// For copy: "350+ firms". Rounds down to the nearest 50 so the claim stays true as firms come and go.
export const FIRM_LABEL = `${Math.floor(FIRM_COUNT / 50) * 50}+`;
