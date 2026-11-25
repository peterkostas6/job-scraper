"use client";

// In the iPhone app only: a Back button at the top of pages opened from Settings (Privacy, Terms),
// which have no tab bar or header of their own.
import { useEffect, useState } from "react";
import { isApp } from "@/lib/app-access";

export default function AppBack() {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(isApp()), []);
  if (!show) return null;
  return (
    <button type="button" className="app-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/jobs"))}>
      <svg width="11" height="18" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2 2 10l8 8"/></svg>
      Back
    </button>
  );
}
