"use client";

// Nav pill for accounts on their free Premium days: "Premium · 2d 14h left", ticking down.
// Links to Pricing. Renders nothing once the free days are over.
import { useEffect, useState } from "react";
import Link from "next/link";
import { capture } from "@/lib/analytics";

function left(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
}

export default function PremiumTimer({ endsAt }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  if (!endsAt || now >= endsAt) return null;
  return (
    <Link href="/pricing" className="premium-timer" onClick={() => capture("premium_timer_clicked")} title="Your free Premium days">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>
      <span className="premium-timer-label">Premium</span>
      <span className="tnum">{left(endsAt - now)} left</span>
    </Link>
  );
}
