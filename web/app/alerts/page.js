// /alerts — landing page for paid ad traffic. It repeats the ad's promise (a text the
// instant a bank posts), shows the product video, and has one action: a free account that
// comes with 5 free alerts. No plans or prices here. Kept out of search results so it
// doesn't compete with the homepage.
import AlertsLanding from "./AlertsLanding";

export const metadata = {
  title: "Get a Text the Instant a Bank Posts a Job | Pete’s Postings",
  description:
    "Instant text alerts for new analyst and internship roles at 20 banks, straight from their career sites.",
  alternates: { canonical: "https://petespostings.com/alerts" },
  robots: { index: false, follow: true },
};

export default function AlertsPage() {
  return <AlertsLanding />;
}
