// /alerts — landing page for paid ad traffic. It repeats the ad's promise (a text the
// instant a bank posts), shows the product video, and has one action: the /start quiz, which
// ends in the 7-day free trial. Kept out of search results so it
// doesn't compete with the homepage.
import AlertsLanding from "./AlertsLanding";
import { FIRM_LABEL } from "@/lib/firms";

export const metadata = {
  title: "Get a Text the Instant a Bank Posts a Job | Pete’s Postings",
  description:
    `Instant text alerts for new finance roles at ${FIRM_LABEL} firms, straight from their career sites.`,
  alternates: { canonical: "https://petespostings.com/alerts" },
  robots: { index: false, follow: true },
};

export default function AlertsPage() {
  return <AlertsLanding />;
}
