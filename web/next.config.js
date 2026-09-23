/** @type {import('next').NextConfig} */
const nextConfig = {
  // Twilio attaches the contact card to the welcome text; phones only open it as a contact with this type.
  async headers() {
    return [{ source: "/petes-postings.vcf", headers: [{ key: "Content-Type", value: "text/vcard" }] }];
  },
}

module.exports = nextConfig
