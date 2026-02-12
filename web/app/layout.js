import "./globals.css";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "Pete's Postings",
  description: "Analyst internships and jobs from top banks",
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
