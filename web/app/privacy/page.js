export const metadata = {
  title: "Privacy Policy — Pete's Postings",
  description: "Privacy policy for Pete's Postings.",
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#1e293b" }}>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>Last updated: September 24, 2026</p>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ fontSize: 15, color: "#475569", marginBottom: 40 }}>Pete's Postings · petespostings.com</p>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>1. What We Collect</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7, marginBottom: 12 }}>When you create an account, we collect your email address and name. If you enable SMS notifications, we also collect your phone number. We use Clerk for authentication, which may collect additional sign-in data.</p>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7, marginBottom: 12 }}>If you subscribe, Stripe collects your payment details; we never see or store your full card number. We keep your subscription status and plan. We also keep your alert preferences, jobs you save, companies you request, and a record of which job links you open (on the site and from alert texts), so we can see which postings are useful.</p>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7 }}>We use PostHog and Google Analytics to understand how the site is used, such as which pages are visited and which features are used. Both set cookies or similar browser storage so they can recognize repeat visits. You can block these cookies in your browser settings, or opt out of Google Analytics with Google&rsquo;s <a href="https://tools.google.com/dlpage/gaoptout" style={{ color: "#2563eb" }}>opt-out browser add-on</a>. </p>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7, marginTop: 12 }}>We use the Meta Pixel and the Reddit Pixel to measure our Facebook, Instagram and Reddit ads. It uses cookies to record page visits and actions such as creating an account or starting a subscription, so Meta and Reddit can report how our ads perform and show them to people likely to find the site useful. Each may combine this with information it already has about you under its own privacy policy (<a href="https://www.facebook.com/privacy/policy" style={{ color: "#2563eb" }}>Meta</a>, <a href="https://www.reddit.com/policies/privacy-policy" style={{ color: "#2563eb" }}>Reddit</a>). You can control ad personalization in your <a href="https://accountscenter.facebook.com/ad_preferences" style={{ color: "#2563eb" }}>Meta ad preferences</a> and <a href="https://www.reddit.com/settings/privacy" style={{ color: "#2563eb" }}>Reddit privacy settings</a>.</p>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7, marginTop: 12 }}>Because browsers and ad blockers often block these pixels, our servers also report the same key actions (creating an account, starting a trial, and subscription payments, including renewals) directly to Meta and Reddit. With each report we send your email address and account ID in hashed form (scrambled so the original can't be read), along with your IP address and browser type, so Meta and Reddit can match it to an ad you saw. We never send your phone number. We do not sell your personal information.</p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>2. How We Use Your Information</h2>
        <ul style={{ fontSize: 15, color: "#334155", lineHeight: 2, paddingLeft: 20 }}>
          <li><strong>Email address</strong> — to send transactional job alert emails and account-related messages you have opted into.</li>
          <li><strong>Phone number</strong> — to send SMS job alert notifications you have explicitly opted into. You can opt out at any time by replying STOP.</li>
          <li><strong>Usage data</strong> — to improve the site and understand which features are used.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>3. SMS Notifications</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7, marginBottom: 12 }}>By enabling SMS notifications, you consent to receive transactional text messages from Pete's Postings about new job postings matching your preferences.</p>
        <ul style={{ fontSize: 15, color: "#334155", lineHeight: 2, paddingLeft: 20 }}>
          <li>Reply <strong>STOP</strong> to unsubscribe from SMS at any time.</li>
          <li>Reply <strong>HELP</strong> for assistance.</li>
          <li>Message and data rates may apply.</li>
          <li>Message frequency varies based on new job postings.</li>
          <li>No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. Your phone number and text-message opt-in consent are excluded from every other sharing described in this policy and are not shared with anyone except Twilio, which delivers the messages.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>4. Data Storage & Security</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7 }}>Account data is stored securely via Clerk. Job preference data is stored in Vercel Postgres and Upstash Redis. We use industry-standard security practices and do not store payment information directly (handled by Stripe).</p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>5. Third-Party Services</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7, marginBottom: 8 }}>We use the following third-party services:</p>
        <ul style={{ fontSize: 15, color: "#334155", lineHeight: 2, paddingLeft: 20 }}>
          <li><strong>Clerk</strong> — authentication and user management</li>
          <li><strong>Resend</strong> — transactional email delivery</li>
          <li><strong>Twilio</strong> — SMS message delivery</li>
          <li><strong>Stripe</strong> — payment processing and subscription management</li>
          <li><strong>Vercel</strong> — hosting and infrastructure</li>
          <li><strong>PostHog</strong> — product usage analytics</li>
          <li><strong>Google Analytics</strong> — website traffic analytics</li>
          <li><strong>Meta Pixel</strong> — measuring the Facebook and Instagram ads we run</li>
          <li><strong>Reddit Pixel</strong> — measuring the Reddit ads we run</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>6. Your Rights</h2>
        <ul style={{ fontSize: 15, color: "#334155", lineHeight: 2, paddingLeft: 20 }}>
          <li><strong>Delete your account</strong> from your profile settings. To also delete records we keep separately (such as link clicks, company requests and message logs), email us and we will remove them.</li>
          <li><strong>Stop texts</strong> by replying STOP, and <strong>stop emails</strong> with the unsubscribe link in any email.</li>
          <li><strong>Limit ad measurement</strong> by blocking cookies in your browser and using your Meta and Reddit ad settings linked above.</li>
          <li><strong>Ask a question or request your data</strong> at <a href="mailto:pete@petespostings.com" style={{ color: "#2563eb" }}>pete@petespostings.com</a>.</li>
        </ul>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7, marginTop: 12 }}>Pete&rsquo;s Postings is not intended for children under 13, and we do not knowingly collect their information.</p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>7. Changes to This Policy</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7 }}>We may update this policy from time to time. The date at the top of this page reflects the most recent update. Continued use of the site after changes constitutes acceptance of the updated policy.</p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>8. Contact</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7 }}>
          Pete's Postings<br />
          <a href="mailto:pete@petespostings.com" style={{ color: "#2563eb" }}>pete@petespostings.com</a><br />
          petespostings.com
        </p>
      </section>
    </div>
  );
}
