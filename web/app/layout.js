import "./globals.css";

export const metadata = {
  title: "Pete's Postings",
  description: "JPMorgan Chase analyst-level job listings",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
