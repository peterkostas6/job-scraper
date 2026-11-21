// /welcome — where Stripe sends people who paid before having an account.
import WelcomeFlow from "./WelcomeFlow";

export const metadata = {
  title: "Welcome to Premium | Pete’s Postings",
  robots: { index: false, follow: false },
};

export default function WelcomePage() {
  return <WelcomeFlow />;
}
