// The picture shown when a petespostings.com link is shared (iMessage, Instagram, Slack,
// LinkedIn, X). Rendered once at build time from the homepage headline.
import { ImageResponse } from "next/og";
import { BANKS } from "@/lib/banks";

export const alt = "Pete's Postings: Get a text the instant a bank posts a job";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Google Fonts serves a TTF (which the image renderer needs) when no browser user agent is sent.
async function loadInter(weight) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Inter:wght@${weight}`)).text();
    const url = css.match(/src: url\((.+?)\) format/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image() {
  const [bold, medium] = await Promise.all([loadInter(800), loadInter(500)]);
  const fonts = [
    bold && { name: "Inter", data: bold, weight: 800, style: "normal" },
    medium && { name: "Inter", data: medium, weight: 500, style: "normal" },
  ].filter(Boolean);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0b1220",
          color: "#faf8f5",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 800 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "#faf8f5",
              color: "#1e293b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
            }}
          >
            P
          </div>
          Pete&rsquo;s Postings
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", fontSize: 84, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.03em" }}>
          {/* One span per word so lines break between words, not after a long phrase. */}
          <span style={{ marginRight: 22 }}>Get</span>
          <span style={{ background: "#2563eb", borderRadius: 14, padding: "0 16px", marginRight: 22 }}>a text</span>
          {"the instant a bank posts a job.".split(" ").map((word, i) => (
            <span key={i} style={{ marginRight: 22 }}>{word}</span>
          ))}
        </div>

        <div style={{ display: "flex", fontSize: 28, fontWeight: 500, color: "rgba(250,248,245,0.7)" }}>
          Analyst &amp; intern roles from {Object.keys(BANKS).length} banks &middot; petespostings.com
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
