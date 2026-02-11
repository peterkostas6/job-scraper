// This API route calls the Morgan Stanley careers API (Workday) from the server.
// Morgan Stanley uses Workday for their job listings at ms.wd5.myworkdayjobs.com.

const MS_API_URL =
  "https://ms.wd5.myworkdayjobs.com/wday/cxs/ms/External/jobs";

const MS_SITE_URL =
  "https://ms.wd5.myworkdayjobs.com/en-US/External";

// Helper: pause for a given number of milliseconds
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch one page of 20 jobs from the Workday API
async function fetchJobsPage(offset = 0) {
  const body = {
    appliedFacets: {},
    limit: 20,
    offset,
    searchText: "analyst",
  };

  const response = await fetch(MS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`MS Workday API returned ${response.status}`);
  }

  return response.json();
}

// Parse jobs out of the Workday API response, filtering to US analyst roles only
function parseJobs(data) {
  const postings = data.jobPostings || [];

  return postings
    .filter((job) => {
      const title = (job.title || "").toLowerCase();
      const loc = (job.locationsText || "").toLowerCase();

      // Title must contain "analyst"
      const isAnalyst = title.includes("analyst");

      // Location must be in the United States
      const isUS =
        loc.includes("united states") ||
        loc.includes(", ny") ||
        loc.includes("new york") ||
        loc.includes(", tx") ||
        loc.includes(", ca") ||
        loc.includes(", il") ||
        loc.includes(", ma") ||
        loc.includes(", ga") ||
        loc.includes(", md") ||
        loc.includes(", dc") ||
        loc.includes(", fl") ||
        loc.includes(", ct") ||
        loc.includes("americas");

      return isAnalyst && isUS;
    })
    .map((job) => ({
      title: job.title || "N/A",
      link: `${MS_SITE_URL}${job.externalPath}`,
    }));
}

// GET /api/jobs-ms — returns all MS analyst jobs in the US as JSON
export async function GET() {
  const allJobs = [];
  let offset = 0;

  while (true) {
    const data = await fetchJobsPage(offset);
    const total = data.total || 0;
    const jobs = parseJobs(data);

    allJobs.push(...jobs);

    // Check if we've fetched all pages
    if (offset + 20 >= total) break;

    offset += 20;

    // Pause 1 second between pages
    await sleep(1000);
  }

  return Response.json({ jobs: allJobs, count: allJobs.length });
}
