import { BANKS } from "@/lib/banks";
import { ALL_FIRMS } from "@/lib/firms";
import { FIRM_LOGOS } from "@/lib/firm-logos";

// Bank logo tile (TrustMRR-style), used everywhere a bank or job shows up. Icons live in
// public/banks/<key>.png (registry firms: lib/firm-logos.js). Firms without a sharp icon
// (BlackRock, some registry firms) get their first letter on a dark tile instead.
const HAS_LOGO = new Set(["jpmc", "gs", "ms", "bofa", "citi", "db", "barclays", "wells", "mufg", "td", "mizuho", "bmo", "hl", "guggenheim", "macquarie", "piper", "stifel", "blackstone", "jefferies", "ubs", "evercore", "lazard", "moelis", "pjt", "pwp", "williamblair", "lincoln", "leerink", "raine", "ardea", "raymondjames", "truist", "pnc", "santander", "cibc", "rbc", "scotiabank", "rothschild", "schwab"]);

export function bankKeyOf(bankKey, bankName) {
  if (bankKey && ALL_FIRMS[bankKey]) return bankKey;
  return Object.keys(BANKS).find((k) => BANKS[k].name === bankName) || null;
}

export default function BankLogo({ bankKey, bank, size = 20, className = "" }) {
  const key = bankKeyOf(bankKey, bank);
  const style = { "--s": `${size}px` };
  if (HAS_LOGO.has(key) || FIRM_LOGOS.has(key)) {
    return <img className={`bank-logo ${className}`} style={style} src={`/banks/${key}.png`} alt="" width={size} height={size} loading="lazy" />;
  }
  return <span className={`bank-logo bank-logo-letter ${className}`} style={style} aria-hidden="true">{(bank || ALL_FIRMS[key]?.name || "?").slice(0, 1)}</span>;
}
