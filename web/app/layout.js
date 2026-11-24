import "./globals.css";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import { PostHogProvider } from "./providers";
import { META_PIXEL_ID } from "@/lib/meta-pixel";
import { REDDIT_PIXEL_ID } from "@/lib/reddit-pixel";
import { FIRM_LABEL } from "@/lib/firms";

// Every page inherits this, so link previews (iMessage, Instagram, Slack, LinkedIn)
// show the current pitch. The preview image lives in opengraph-image.js.
const TITLE = "Pete\u2019s Postings \u2014 Get a text the instant a bank posts a job";
const DESCRIPTION = `Live finance jobs, from internships to VP, at ${FIRM_LABEL} firms including JPMorgan, Goldman Sachs, Morgan Stanley, Jane Street and Citadel Securities. Get a text the instant a role matching your filters goes live.`;

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
  robots: {
    index: true,
    follow: true,
  },
  // Proves to Meta (Business Settings → Domains) that we own petespostings.com.
  verification: {
    other: { "facebook-domain-verification": "pvzc5cu4hbtidvhwugpzo6ofrmqebj" },
  },
};

// Clerk's sign-in / sign-up / account pop-ups, styled to match the site (tokens from
// globals.css and the design-system modal spec: white card, 16px radius, deep shadow).
const clerkAppearance = {
  // Navy / cream / coral theme: cream card, navy text, coral primary button with navy text.
  variables: {
    colorPrimary: "#14213D",
    colorPrimaryForeground: "#F4EDE0",
    colorForeground: "#14213D",
    colorMutedForeground: "rgba(20, 33, 61, 0.7)",
    colorBackground: "#F4EDE0",
    colorInput: "#FBF7EF",
    colorInputForeground: "#14213D",
    colorRing: "rgba(20, 33, 61, 0.25)",
    colorDanger: "#dc3535",
    colorModalBackdrop: "rgba(10, 18, 38, 0.6)",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    borderRadius: "8px",
  },
  elements: {
    cardBox: { borderRadius: "16px", boxShadow: "0 24px 80px rgba(0, 0, 0, 0.18)" },
    headerTitle: { color: "#14213D", fontWeight: 700, letterSpacing: "-0.2px" },
    headerSubtitle: { color: "rgba(20, 33, 61, 0.7)" },
    formButtonPrimary: {
      backgroundColor: "#FF6B5B",
      backgroundImage: "none",
      color: "#14213D",
      border: "none",
      boxShadow: "none",
      borderRadius: "999px",
      "&::after": { boxShadow: "none" },
      fontWeight: 700,
      textTransform: "none",
      "&:hover": { backgroundColor: "#FF8273" },
    },
    // Clerk draws these outlines with box-shadow (border-width is 0), so the hairline and the
    // focus ring are set there.
    formFieldInput: {
      boxShadow: "0 0 0 1px rgba(20, 33, 61, 0.16)",
      "&:focus": { boxShadow: "0 0 0 1px #14213D, 0 0 0 4px rgba(20, 33, 61, 0.12)" },
    },
    socialButtonsBlockButton: { backgroundColor: "#FBF7EF", boxShadow: "0 0 0 1px rgba(20, 33, 61, 0.16)" },
    footer: { background: "#EADFCB" },
    footerActionLink: { color: "#14213D", fontWeight: 700, textDecoration: "underline" },
  },
};

export default function RootLayout({ children }) {
  return (
    // Any sign-up without its own redirect (the nav's Sign in -> Sign up, Google, etc.)
    // lands on the preferences questions.
    <ClerkProvider appearance={clerkAppearance} signUpForceRedirectUrl="/start?setup=1">
      <html lang="en">
        <head>
          {/* Inside the iPhone app (ios-app/): mark <html> and let the page reach under the
              status bar, before first paint, so the nav can pad itself below the clock. */}
          <script
            dangerouslySetInnerHTML={{
              __html: `if(/PetesPostingsApp/.test(navigator.userAgent)){document.documentElement.classList.add('in-app');var v=document.querySelector('meta[name=viewport]');if(v&&!/viewport-fit/.test(v.content))v.content+=', viewport-fit=cover';}`,
            }}
          />
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
              // Skipped on Pete's own browsers (lib/internal.js).
              if (!(function(){try{return /[?&]internal=on\\b/.test(location.search)||localStorage.getItem('pp-internal')==='1'}catch(e){return false}})()) fbq('track', 'PageView');
            `}
          </Script>
          {/* Reddit Pixel base code (first page visit; later ones come from providers.js). */}
          <Script id="reddit-pixel" strategy="afterInteractive">
            {`
              !function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js?pixel_id=${REDDIT_PIXEL_ID}",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);
              rdt('init','${REDDIT_PIXEL_ID}');
              if (!(function(){try{return /[?&]internal=on\\b/.test(location.search)||localStorage.getItem('pp-internal')==='1'}catch(e){return false}})()) rdt('track', 'PageVisit');
            `}
          </Script>
        </head>
        <body>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify([
                {
                  "@context": "https://schema.org",
                  "@type": "Organization",
                  name: "Pete\u2019s Postings",
                  url: "https://petespostings.com",
                  logo: "https://petespostings.com/logo-square.png",
                  email: "pete@petespostings.com",
                },
                {
                  "@context": "https://schema.org",
                  "@type": "WebSite",
                  name: "Pete\u2019s Postings",
                  url: "https://petespostings.com",
                },
              ]),
            }}
          />
          <PostHogProvider>{children}</PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
