const BASE = "https://petespostings.com";

export default function sitemap() {
  const now = new Date();
  return [
    { url: `${BASE}`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/jobs`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}/recent`, lastModified: now, changeFrequency: "hourly", priority: 0.7 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
