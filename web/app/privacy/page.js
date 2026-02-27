export const metadata = {
  title: "Privacy Policy — Pete's Postings",
  description: "Privacy policy for Pete's Postings.",
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#1e293b" }}>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>Last updated: February 27, 2026</p>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ fontSize: 15, color: "#475569", marginBottom: 40 }}>Pete's Postings · petespostings.com</p>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>1. What We Collect</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7, marginBottom: 12 }}>When you create an account, we collect your email address and name. If you enable SMS notifications, we also collect your phone number. We use Clerk for authentication, which may collect additional sign-in data.</p>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7 }}>We use PostHog for anonymous usage analytics (page views, feature usage). We do not sell your data to third parties.</p>
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
          <li><strong>Telnyx</strong> — SMS message delivery</li>
          <li><strong>Stripe</strong> — payment processing</li>
          <li><strong>Vercel</strong> — hosting and infrastructure</li>
          <li><strong>PostHog</strong> — anonymous usage analytics</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>6. Your Rights</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7 }}>You can delete your account at any time from your profile settings, which removes your personal data. To request data deletion or ask any privacy-related questions, contact us at <a href="mailto:pete@petespostings.com" style={{ color: "#2563eb" }}>pete@petespostings.com</a>.</p>
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
