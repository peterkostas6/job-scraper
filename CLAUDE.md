# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A beginner project that scrapes JPMorgan Chase analyst-level job listings from their Oracle HCM careers API. Has two interfaces: a Python CLI scraper that saves to CSV, and a Next.js web app that displays jobs in a table. The user is a first-time coder — explain concepts clearly and avoid assumptions about prior knowledge.

## Project Structure

```
job-scraper/
├── scraper.py          # Python CLI scraper (saves to CSV)
├── requirements.txt    # Python dependencies
├── web/                # Next.js web app
│   ├── app/
│   │   ├── layout.js       # Root HTML layout
│   │   ├── page.js         # Homepage — displays job table
│   │   ├── globals.css     # Styling
│   │   └── api/jobs/
│   │       └── route.js    # API route — calls JPMC API server-side
│   ├── package.json
│   └── next.config.js
```

## Setup & Running

```bash
# Python scraper
pip3 install -r requirements.txt
python3 scraper.py              # Saves CSV to jpmc_analyst_jobs_YYYY-MM-DD.csv

# Next.js web app
cd web
npm install
npm run dev                     # Starts at http://localhost:3000
```

## Architecture

### Python scraper (`scraper.py`)
Three stages: **Fetch** (paginate JPMC API 25 at a time) → **Parse** (extract title + link) → **Save** (write CSV).

### Next.js web app (`web/`)
- `app/api/jobs/route.js` — Server-side API route that calls the JPMC API (needed because browsers can't call JPMC directly due to CORS). Handles pagination with 1-second delays between pages.
- `app/page.js` — Client component that fetches from `/api/jobs` and renders a table.

Both the Python scraper and the Next.js API route implement the same logic: paginate through the JPMC API, extract title + link, return results.

## Key Technical Details

- The JPMC career site is a JavaScript SPA — the HTML contains no job data. All job data comes from their REST API at `hcmRestApi/resources/latest/recruitingCEJobRequisitions`.
- The API returns max 25 results per request. Pagination uses the `offset` parameter. A 1-second delay between pages is required or the API stalls.
- Category filtering uses `selectedCategoriesFacet` and location filtering uses `selectedLocationsFacet` (not `categoryId`/`locationId`).
- The Analysts category ID is `300000086153065`. The US location ID is `300000000289738`.
- The `siteNumber=CX_1001` parameter identifies the JPMC public career site.
- Job links are constructed by appending the job `Id` to the career site URL.
- Node.js is installed locally at `~/local/node/bin` (not via Homebrew). May need `export PATH="$HOME/local/node/bin:$PATH"` before running npm/node commands.

## Deployment

The web app is deployed on Vercel and connected to GitHub for automatic deploys.

- **Live site:** thisisforbenseyesonly.vercel.app
- **GitHub repo:** github.com/peterkostas6/job-scraper
- **Vercel project name:** thisisforbenseyesonly
- **Vercel root directory:** `web` (set in Settings > Build and Deployment)
- **Framework preset:** Next.js
- Pushing to the `main` branch on GitHub automatically triggers a Vercel deploy.

### Workflow for making changes

1. Pete asks for a change
2. Claude makes the change locally
3. Pete previews at http://localhost:3000 (dev server must be running)
4. Pete approves and asks Claude to push
5. Claude commits and pushes to GitHub — Vercel auto-deploys

### Running the dev server

The dev server needs to be started each session:
```bash
export PATH="$HOME/local/node/bin:$PATH"
cd web && npm run dev    # starts at http://localhost:3000
```

### Pushing changes live

```bash
git add <files> && git commit -m "message" && git push
```
Vercel picks up the push and deploys automatically. No manual redeploy needed.

## Branding

- The site is called **Pete's Postings**
- Nav logo says "Pete's Postings"
- Browser tab title says "Pete's Postings"
