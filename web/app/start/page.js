// /start — guided sign-up for ad traffic. Four quick questions, then the live jobs that
// match the answers, then a free account with alerts already set to those answers.
// Kept out of search results; the homepage and /alerts stay as they are.
import StartFlow from "./StartFlow";

export const metadata = {
  title: "Find Your Bank Jobs in 30 Seconds | Pete’s Postings",
  description:
    "Answer four questions and see every open analyst and internship role at 20 banks that fits you, then get a text when the next one posts.",
  alternates: { canonical: "https://petespostings.com/start" },
  robots: { index: false, follow: true },
};

export default function StartPage() {
  return <StartFlow />;
}
