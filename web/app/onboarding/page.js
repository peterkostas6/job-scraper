import OnboardingFlow from "./OnboardingFlow";

// First-launch setup for the iPhone app: welcome, three questions, matches, paywall, account,
// alerts. The website never links here.
export const metadata = {
  title: "Get set up | Pete's Postings",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
