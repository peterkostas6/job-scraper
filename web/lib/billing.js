// Sends a subscriber to Stripe's billing page (cancel, change plan, card, invoices).
export async function openBillingPortal() {
  try {
    const res = await fetch("/api/billing-portal", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (data.url) { window.location.href = data.url; return; }
    alert(data.error || "Couldn't open billing. Email pete@petespostings.com to manage your subscription.");
  } catch {
    alert("Couldn't open billing. Email pete@petespostings.com to manage your subscription.");
  }
}
