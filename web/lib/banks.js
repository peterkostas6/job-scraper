// The one list of banks the site scrapes. The browse page, the detection cron, and the
// preferences email all read from here, so a new bank is added in one place.
export const BANKS = {
  jpmc: { name: "JPMorgan Chase", shortName: "JPMC", endpoint: "/api/jobs" },
  gs: { name: "Goldman Sachs", shortName: "Goldman", endpoint: "/api/jobs-gs" },
  ms: { name: "Morgan Stanley", shortName: "Morgan", endpoint: "/api/jobs-ms" },
  bofa: { name: "Bank of America", shortName: "BofA", endpoint: "/api/jobs-bofa" },
  citi: { name: "Citi", shortName: "Citi", endpoint: "/api/jobs-citi" },
  db: { name: "Deutsche Bank", shortName: "Deutsche", endpoint: "/api/jobs-db" },
  barclays: { name: "Barclays", shortName: "Barclays", endpoint: "/api/jobs-barclays" },
  wells: { name: "Wells Fargo", shortName: "Wells Fargo", endpoint: "/api/jobs-wells" },
  mufg: { name: "MUFG", shortName: "MUFG", endpoint: "/api/jobs-mufg" },
  td: { name: "TD Securities", shortName: "TD", endpoint: "/api/jobs-td" },
  mizuho: { name: "Mizuho", shortName: "Mizuho", endpoint: "/api/jobs-mizuho" },
  bmo: { name: "BMO", shortName: "BMO", endpoint: "/api/jobs-bmo" },
  hl: { name: "Houlihan Lokey", shortName: "HL", endpoint: "/api/jobs-hl" },
  guggenheim: { name: "Guggenheim", shortName: "Guggenheim", endpoint: "/api/jobs-guggenheim" },
  macquarie: { name: "Macquarie", shortName: "Macquarie", endpoint: "/api/jobs-macquarie" },
  piper: { name: "Piper Sandler", shortName: "Piper", endpoint: "/api/jobs-piper" },
  stifel: { name: "Stifel", shortName: "Stifel", endpoint: "/api/jobs-stifel" },
  blackstone: { name: "Blackstone", shortName: "Blackstone", endpoint: "/api/jobs-blackstone" },
  blackrock: { name: "BlackRock", shortName: "BlackRock", endpoint: "/api/jobs-blackrock" },
  jefferies: { name: "Jefferies", shortName: "Jefferies", endpoint: "/api/jobs-jefferies" },
};

export const BANK_NAMES = Object.fromEntries(Object.entries(BANKS).map(([k, b]) => [k, b.name]));
