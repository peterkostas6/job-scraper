import "./globals.css";
import Script from "next/script";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});
import { ClerkProvider } from "@clerk/nextjs";
import { PostHogProvider } from "./providers";
import { BANKS } from "@/lib/banks";

// Every page inherits this, so link previews (iMessage, Instagram, Slack, LinkedIn)
// show the current pitch. The preview image lives in opengraph-image.js.
const BANK_COUNT = Object.keys(BANKS).length;
const TITLE = "Pete\u2019s Postings \u2014 Get a text the instant a bank posts a job";
const DESCRIPTION = `Live analyst and internship postings from ${BANK_COUNT} banks, including JPMorgan, Goldman Sachs, Morgan Stanley, Bank of America, and Citi. Get a text the instant a role matching your filters goes live.`;

export const metadata = {
  title: "Pete\u2019s Postings \u2014 Analyst and Intern Jobs at Top Banks",
  description: DESCRIPTION,
  keywords: [
    "analyst jobs",
    "investment banking internship",
    "JPMorgan analyst",
    "Goldman Sachs internship",
    "Morgan Stanley analyst",
    "Bank of America analyst",
    "Citi internship",
    "Deutsche Bank analyst",
    "Barclays internship",
    "summer analyst 2026",
    "summer analyst 2027",
    "bulge bracket jobs",
    "IB analyst",
    "finance internship",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://petespostings.com",
    siteName: "Pete\u2019s Postings",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  metadataBase: new URL("https://petespostings.com"),
  alternates: {
    canonical: "https://petespostings.com",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <head>
          <Script
            src="https://www.googletagmanager.com/gtag/js?id=G-4RWTGXJJQP"
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-4RWTGXJJQP');
            `}
          </Script>
        </head>
        <body>
          <PostHogProvider>{children}</PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
