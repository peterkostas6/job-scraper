import AppBack from "@/app/AppBack";

export const metadata = {
  title: "Terms of Service — Pete's Postings",
  description: "Terms of service for Pete's Postings.",
  alternates: { canonical: "https://petespostings.com/terms" },
};

export default function TermsPage() {
  return (
    <>
    <AppBack />
    <div style={{ maxWidth: 720, width: "calc(100% - 32px)", margin: "32px auto 64px", padding: "40px 24px 56px", background: "var(--pp-cream)", borderRadius: 16, boxSizing: "border-box", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#1e293b" }}>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>Last updated: November 24, 2026</p>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ fontSize: 15, color: "#475569", marginBottom: 40 }}>Pete's Postings · petespostings.com</p>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>1. Acceptance of Terms</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7 }}>By accessing or using Pete's Postings ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.</p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>2. Description of Service</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7 }}>Pete's Postings aggregates publicly available job listings from financial institutions and displays them in a single interface. Browsing current listings is free. A free account adds text and email job alerts; links in those alerts open for free for 3 days after your first alert. A paid Premium subscription keeps alert links opening and adds the recent postings feed and company requests. Links to job postings pass through petespostings.com before sending you to the employer's site.</p>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7, marginTop: 12 }}>The Pete&rsquo;s Postings iPhone app requires a Premium subscription, bought in the app through Apple or on this website. Your use of the app is also subject to Apple&rsquo;s <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" style={{ color: "#2563eb" }}>Licensed Application End User License Agreement</a>.</p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>3. Subscriptions & Billing</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7, marginBottom: 12 }}>Premium is available at the price shown on our <a href="/pricing" style={{ color: "#2563eb" }}>pricing page</a> when you subscribe. Payments on this website are processed by Stripe; subscriptions bought in the iPhone app are processed by Apple (see below).</p>
        <ul style={{ fontSize: 15, color: "#334155", lineHeight: 2, paddingLeft: 20, marginBottom: 12 }}>
          <li><strong>Billing:</strong> your card is charged the plan&rsquo;s price when you subscribe, then again at the start of each billing period (every week, month or year, depending on your plan).</li>
          <li><strong>Free alert period:</strong> alerts are free. For 3 days after your first alert, their links open without a subscription; after that, opening them requires Premium. No payment method is needed for the free period, and Premium is charged when you subscribe, then every month until you cancel.</li>
          <li><strong>Automatic renewal:</strong> subscriptions renew automatically at the end of each billing period until you cancel.</li>
          <li><strong>How to cancel:</strong> open the menu under your profile picture and choose <strong>Manage subscription</strong>, or use <strong>Manage subscription</strong> in the Premium section of the sidebar. You can also email <a href="mailto:pete@petespostings.com" style={{ color: "#2563eb" }}>pete@petespostings.com</a>. Cancelling stops future charges; you keep Premium until the end of the period you already paid for.</li>
          <li><strong>Refunds:</strong> handled case by case. Contact <a href="mailto:pete@petespostings.com" style={{ color: "#2563eb" }}>pete@petespostings.com</a>.</li>
          <li><strong>Price changes:</strong> we will tell you before a price change affects your subscription, and you can cancel before it takes effect.</li>
        </ul>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7, marginBottom: 12 }}><strong>Subscriptions bought in the iPhone app</strong> are sold and billed by Apple:</p>
        <ul style={{ fontSize: 15, color: "#334155", lineHeight: 2, paddingLeft: 20, marginBottom: 12 }}>
          <li>Premium is a monthly subscription at the price shown in the app before you buy. Payment is charged to your Apple ID when you confirm the purchase.</li>
          <li>It renews automatically each month unless you cancel at least 24 hours before the end of the current period; your Apple ID is charged for the renewal within 24 hours before the period ends.</li>
          <li>Manage or cancel it in your iPhone&rsquo;s Settings (tap your name, then Subscriptions), or with <strong>Manage subscription</strong> in the app&rsquo;s account menu. Cancelling stops future charges; you keep Premium until the end of the period you paid for.</li>
          <li>Refunds for App Store purchases are handled by Apple at <a href="https://reportaproblem.apple.com" style={{ color: "#2563eb" }}>reportaproblem.apple.com</a>.</li>
          <li>Deleting your Pete&rsquo;s Postings account does not cancel an App Store subscription; cancel it in your iPhone&rsquo;s Settings.</li>
        </ul>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7 }}>Students at partner schools may receive Premium access at no charge; that access can end if the partnership ends.</p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>4. Notifications</h2>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7, marginBottom: 12 }}>If you allow notifications in the iPhone app, we send push notifications about new job postings matching your preferences. Turn them off at any time in your iPhone&rsquo;s Settings, under Notifications.</p>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7, marginBottom: 12 }}>By enabling SMS notifications in your account dashboard, you consent to receive recurring automated text messages from Pete's Postings about new job postings matching your preferences. Consent is not a condition of any purchase.</p>
        <ul style={{ fontSize: 15, color: "#334155", lineHeight: 2, paddingLeft: 20 }}>
          <li>Reply <strong>STOP</strong> to unsubscribe at any time. You will receive a confirmation message.</li>
          <li>Reply <strong>HELP</strong> for help or contact <a href="mailto:pete@petespostings.com" style={{ color: "#2563eb" }}>pete@petespostings.com</a>.</li>
          <li>Message and data rates may apply.</li>
          <li>Message frequency varies based on new job postings, up to a few times per day.</li>
          <li>Alert texts contain short links to each job; we record when a link is tapped.</li>
          <li>Carriers are not liable for delayed or undelivered messages.</li>
          <li>Your phone number and SMS opt-in consent are never shared with third parties or affiliates for marketing purposes.</li>
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
    </>
  );
}
