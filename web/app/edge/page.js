// /edge — mobile landing page for Reddit ads. Repeats the ad's promise (we watch the bank
// career sites so you don't have to), then asks one question with three answers: texts,
// the live list, or both. Kept out of search results so it doesn't compete with the homepage.
import EdgeLanding from "./EdgeLanding";

export const metadata = {
  title: "Your Recruiting Edge | Pete’s Postings",
  description:
    "We check 20 banks’ career sites for you, put every analyst and intern role in one place, and text you when a new one comes out.",
  alternates: { canonical: "https://petespostings.com/edge" },
  robots: { index: false, follow: true },
};

export default function EdgePage() {
  return <EdgeLanding />;
}
