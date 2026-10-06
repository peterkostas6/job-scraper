/** @type {import('next').NextConfig} */
const nextConfig = {
  // Twilio attaches the contact card to the welcome text; phones only open it as a contact with this type.
  async headers() {
    return [{ source: "/petes-postings.vcf", headers: [{ key: "Content-Type", value: "text/vcard" }] }];
  },
  async rewrites() {
    // PostHog through our own domain, so ad blockers that block posthog.com don't drop events.
    const posthog = [
      { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
    // Local preview without database credentials: read the public job and member counts from the live site.
    const localData = process.env.NODE_ENV === "development" && !process.env.POSTGRES_URL
      ? ["jobs-live", "jobs-new", "member-count"].map((route) => ({
          source: `/api/${route}`,
          destination: `https://petespostings.com/api/${route}`,
        }))
      : [];
    return { beforeFiles: localData, afterFiles: posthog };
  },
  // PostHog's API paths end in a slash; don't redirect them away.
  skipTrailingSlashRedirect: true,
}

module.exports = nextConfig
