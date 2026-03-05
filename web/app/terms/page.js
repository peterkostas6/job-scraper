export const metadata = {
  title: "Terms of Service — Pete's Postings",
  description: "Terms of service for Pete's Postings.",
};

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#1e293b" }}>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>Last updated: March 4, 2026</p>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ fontSize: 15, color: "#475569", marginBottom: 40 }}>Pete's Postings · petespostings.com</p>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>1. Acceptance of Terms</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7 }}>By accessing or using Pete's Postings ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.</p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>2. Description of Service</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7 }}>Pete's Postings aggregates publicly available job listings from financial institutions and displays them in a single interface. We offer free and paid (Pro) subscription tiers with different levels of access to features including job alerts and recent postings.</p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>3. Subscriptions & Billing</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7, marginBottom: 12 }}>Pro subscriptions are billed monthly or annually via Stripe. Subscriptions automatically renew until cancelled. You may cancel at any time from your account settings. Refunds are handled on a case-by-case basis — contact <a href="mailto:pete@petespostings.com" style={{ color: "#2563eb" }}>pete@petespostings.com</a>.</p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>4. SMS Notifications</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7, marginBottom: 12 }}>By enabling SMS notifications in your account dashboard, you consent to receive recurring automated text messages from Pete's Postings about new job postings matching your preferences.</p>
        <ul style={{ fontSize: 15, color: "#334155", lineHeight: 2, paddingLeft: 20 }}>
          <li>Reply <strong>STOP</strong> to unsubscribe at any time. You will receive a confirmation message.</li>
          <li>Reply <strong>HELP</strong> for help or contact <a href="mailto:pete@petespostings.com" style={{ color: "#2563eb" }}>pete@petespostings.com</a>.</li>
          <li>Message and data rates may apply.</li>
          <li>Message frequency varies based on new job postings, up to a few times per day.</li>
          <li>SMS opt-in data is never shared with third parties for marketing purposes.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>5. Acceptable Use</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7 }}>You agree not to scrape, reverse engineer, or misuse the Service. Job listings displayed on Pete's Postings are sourced from public career pages and are the property of their respective employers.</p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>6. Disclaimer</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7 }}>Pete's Postings aggregates job listings for convenience and does not guarantee their accuracy, availability, or completeness. We are not affiliated with any of the employers listed. Always apply directly through the employer's official website.</p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>7. Limitation of Liability</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7 }}>Pete's Postings is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the Service, including missed job opportunities or inaccurate listings.</p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>8. Changes to Terms</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7 }}>We may update these terms at any time. The date at the top of this page reflects the most recent update. Continued use of the Service after changes constitutes acceptance of the updated terms.</p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>9. Contact</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7 }}>
          Pete's Postings<br />
          <a href="mailto:pete@petespostings.com" style={{ color: "#2563eb" }}>pete@petespostings.com</a><br />
          petespostings.com
        </p>
      </section>
    </div>
  );
}
