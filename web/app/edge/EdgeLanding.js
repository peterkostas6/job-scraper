"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { capture } from "@/lib/analytics";
import { BANKS } from "@/lib/banks";
import BankLogo from "@/lib/bank-logo";

const BANK_COUNT = Object.keys(BANKS).length;
const LOGO_BANKS = ["gs", "jpmc", "ms", "bofa", "citi"];

export default function EdgeLanding() {
  // Live role count for the "See all live postings" button. The CDN caches this route.
  const [liveCount, setLiveCount] = useState(null);
  useEffect(() => {
    fetch("/api/jobs-live")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.count) setLiveCount(data.count); })
      .catch(() => {});
  }, []);

  // Both alert answers go to the /start quiz, which sets up alerts and ends on the job list.
  const choices = [
    { key: "texts", href: "/start", title: "Get a text when roles go live", sub: "Apply in the first hours, not days" },
    { key: "browse", href: "/jobs", title: "See all live postings", sub: liveCount ? `${liveCount} live right now` : "Live right now" },
    { key: "both", href: "/start", title: "Get texts + see all live postings", sub: "Every role now, a text for every new one", primary: true },
  ];

  return (
    <div className="edge">
      <header className="edge-header">
        <Link href="/" className="edge-logo" aria-label="Pete's Postings home">
          <img src="/logo-mark.svg" alt="" width="22" height="22" />
          <span>Pete&rsquo;s Postings</span>
        </Link>
      </header>

      <main className="edge-main">
        <h1 className="edge-title">Your recruiting edge.</h1>
        <p className="edge-sub">
          We check {BANK_COUNT} banks&rsquo; career sites for you, put every analyst and intern role in one place, and text you the second a new one comes out.
        </p>

        <div className="edge-banks">
          <span className="edge-logos">
            {LOGO_BANKS.map((key) => <BankLogo key={key} bankKey={key} size={30} />)}
          </span>
          <span>Goldman, JPM, Morgan Stanley <span className="edge-nowrap">+ {BANK_COUNT - 3} more</span></span>
        </div>

        <p className="edge-ask">What would you like to do?</p>
        <nav className="edge-choices">
          {choices.map((c) => (
            <Link
              key={c.key}
              href={c.href}
              className={`edge-choice${c.primary ? " edge-choice-primary" : ""}`}
              onClick={() => capture("edge_choice_clicked", { choice: c.key })}
            >
              <span className="edge-choice-text">
                <strong>{c.title}</strong>
                <span>{c.sub}</span>
              </span>
              <span className="edge-chevron" aria-hidden="true">&rsaquo;</span>
            </Link>
          ))}
        </nav>
      </main>

      <footer className="edge-footer">
        Built by Pete, after refreshing career pages<br />became a full-time job while recruiting.
      </footer>
    </div>
  );
}
