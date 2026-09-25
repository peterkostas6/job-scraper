// Per-page titles, descriptions and canonical URLs for the views served by page.js
// (a client component, so it can't export metadata itself). Private views are noindex.
import { BANKS } from "@/lib/banks";

const BANK_COUNT = Object.keys(BANKS).length;
const SITE = "https://petespostings.com";

const PAGES = {
  "": {
    title: "Pete’s Postings — Investment Banking Internship & Analyst Job Alerts",
    description: `Every analyst and internship posting from ${BANK_COUNT} banks in one place, plus a text the instant a role you want goes live. JPMorgan, Goldman Sachs, Morgan Stanley and more.`,
  },
  jobs: {
    title: `Analyst & Internship Jobs at ${BANK_COUNT} Banks | Pete’s Postings`,
    description: `Browse every open analyst, summer analyst and internship role at JPMorgan, Goldman Sachs, Morgan Stanley, Bank of America, Citi and ${BANK_COUNT - 5} more banks, pulled straight from their career sites.`,
  },
  recent: {
    title: "New Banking Jobs From the Last 48 Hours | Pete’s Postings",
    description: `Every analyst and internship role posted in the last 48 hours across ${BANK_COUNT} banks. Apply while applications are still being read.`,
  },
  about: {
    title: "About Pete’s Postings — Instant Banking Internship & Analyst Job Alerts",
    description: `What Pete’s Postings does: tracks every analyst and internship posting at ${BANK_COUNT} banks and texts you the moment a matching role goes live. Features, banks covered and FAQ.`,
  },
  saved: { title: "Saved Jobs | Pete’s Postings", private: true },
  notifications: { title: "Job Alerts | Pete’s Postings", private: true },
};

export function generateMetadata({ params }) {
  const slug = params?.view?.[0] || "";
  const page = PAGES[slug];
  if (!page) return {};
  const url = slug ? `${SITE}/${slug}` : SITE;
  return {
    title: page.title,
    ...(page.description && { description: page.description }),
    alternates: { canonical: url },
    ...(page.private
      ? { robots: { index: false, follow: true } }
      : { openGraph: { title: page.title, description: page.description, url } }),
  };
}

export default function ViewLayout({ children }) {
  return children;
}
