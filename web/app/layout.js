import "./globals.css";

export const metadata = {
  title: "JPMC Analyst Jobs",
  description: "JPMorgan Chase analyst-level job listings",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
