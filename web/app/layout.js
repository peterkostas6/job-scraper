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
import { META_PIXEL_ID } from "@/lib/meta-pixel";
import { REDDIT_PIXEL_ID } from "@/lib/reddit-pixel";

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
  // Proves to Meta (Business Settings → Domains) that we own petespostings.com.
  verification: {
    other: { "facebook-domain-verification": "pvzc5cu4hbtidvhwugpzo6ofrmqebj" },
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
          {/* Meta Pixel base code (records the first page view; later ones come from providers.js). */}
          <Script id="meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${META_PIXEL_ID}');
              fbq('track', 'PageView');
            `}
          </Script>
          {/* Reddit Pixel base code (first page visit; later ones come from providers.js). */}
          <Script id="reddit-pixel" strategy="afterInteractive">
            {`
              !function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);
              rdt('init','${REDDIT_PIXEL_ID}');
              rdt('track', 'PageVisit');
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
