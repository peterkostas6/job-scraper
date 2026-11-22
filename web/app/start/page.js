// /start — sign-up for text alerts (every "Set up alerts" / "Get SMS alerts" button lands here).
// One screen that sells being first in the pile, then phone number, then the free trial;
// after checkout, texts are on and they land on Alerts to fine-tune.
// Kept out of search results; the homepage and /alerts stay as they are.
import StartFlow from "./StartFlow";
import { BANK_COUNT } from "@/lib/banks";

export const metadata = {
  title: "Be First in the Pile | Pete’s Postings",
  description:
    `Get a text the moment a bank posts an analyst or internship role, so your resume is one of the first they read. ${BANK_COUNT} banks, checked every 5 minutes.`,
  alternates: { canonical: "https://petespostings.com/start" },
  robots: { index: false, follow: true },
};

export default function StartPage({ searchParams }) {
  // ?setup=1 (fresh sign-up): open right on step 1, no intro and no scroll.
  return <StartFlow setup={searchParams?.setup === "1"} />;
}
