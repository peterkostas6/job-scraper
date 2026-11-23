// Per-page titles, descriptions and canonical URLs for the views served by page.js
// (a client component, so it can't export metadata itself). Private views are noindex.
import { FIRM_LABEL } from "@/lib/firms";

const SITE = "https://petespostings.com";

const PAGES = {
  "": {
    title: "Pete’s Postings — Investment Banking Internship & Analyst Job Alerts",
    description: `Every finance job, from internships to VP, at ${FIRM_LABEL} firms in one place, plus a text the instant a role you want goes live. JPMorgan, Goldman Sachs, Jane Street and more.`,
  },
  jobs: {
    title: `Finance Jobs at ${FIRM_LABEL} Firms | Pete’s Postings`,
    description: `Browse every open finance role, from summer internships to VP, at JPMorgan, Goldman Sachs, Morgan Stanley, Jane Street, Fidelity and ${FIRM_LABEL} firms in all, pulled straight from their career sites.`,
  },
  recent: {
    title: "New Banking Jobs From the Last 48 Hours | Pete’s Postings",
    description: `Every finance role posted in the last 48 hours across ${FIRM_LABEL} firms. Apply while applications are still being read.`,
  },
  about: {
    title: "About Pete’s Postings — Instant Banking Internship & Analyst Job Alerts",
    description: `What Pete’s Postings does: tracks every finance job posting at ${FIRM_LABEL} firms and texts you the moment a matching role goes live. Features, firms covered and FAQ.`,
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
