/** @type {import('next').NextConfig} */
const nextConfig = {
  // Twilio attaches the contact card to the welcome text; phones only open it as a contact with this type.
  async headers() {
    return [{ source: "/petes-postings.vcf", headers: [{ key: "Content-Type", value: "text/vcard" }] }];
  },
  // Local preview without database credentials: read the public job and member counts from the live site.
  async rewrites() {
    if (process.env.NODE_ENV !== "development" || process.env.POSTGRES_URL) return [];
    return {
      beforeFiles: ["jobs-live", "jobs-new", "member-count"].map((route) => ({
        source: `/api/${route}`,
        destination: `https://petespostings.com/api/${route}`,
      })),
    };
  },
}

module.exports = nextConfig
