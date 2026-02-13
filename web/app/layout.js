import "./globals.css";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "Petes Postings - Analyst and Intern Jobs at Top Banks",
  description:
    "Browse live analyst and internship postings from JPMorgan Chase, Goldman Sachs, Morgan Stanley, Bank of America, Citi, Deutsche Bank, and Barclays. Updated directly from bank career sites.",
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
    title: "Petes Postings - Every BB Analyst and Intern Application in One Place",
    description:
      "Live analyst and internship postings from 8 bulge bracket banks. Pulled directly from career sites, never outdated.",
    url: "https://petespostings.com",
    siteName: "Petes Postings",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Petes Postings - BB Analyst and Intern Jobs",
    description:
      "Live analyst and internship postings from JPMorgan, Goldman Sachs, Morgan Stanley, BofA, Citi, Deutsche Bank, Barclays, and UBS.",
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
      <html lang="en">
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
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
