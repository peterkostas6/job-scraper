# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pete's Postings — a job board that scrapes analyst and intern-level job listings from 8 major banks and displays them in a web app. Has two interfaces: a Python CLI scraper that saves to CSV, and a Next.js web app with subscriptions, notifications, and a Recent tab. The user is a first-time coder — explain concepts clearly and avoid assumptions about prior knowledge.

## Project Structure

```
job-scraper/
├── scraper.py              # Python CLI scraper (saves to CSV, JPMC only)
├── requirements.txt        # Python dependencies
├── web/                    # Next.js web app
│   ├── app/
│   │   ├── layout.js           # Root HTML layout
│   │   ├── page.js             # Homepage — job browse table + Recent tab
│   │   ├── globals.css         # Styling
│   │   └── api/
│   │       ├── jobs/           # JPMC jobs
│   │       ├── jobs-gs/        # Goldman Sachs jobs
│   │       ├── jobs-ms/        # Morgan Stanley jobs
│   │       ├── jobs-bofa/      # Bank of America jobs
│   │       ├── jobs-citi/      # Citi jobs
│   │       ├── jobs-db/        # Deutsche Bank jobs
│   │       ├── jobs-barclays/  # Barclays jobs
│   │       ├── jobs-ubs/       # UBS jobs
│   │       ├── jobs-new/       # Recent tab — reads from Postgres jobs table (last 48h)
│   │       ├── jobs-db/        # Deutsche Bank scraper (unrelated to Postgres "db")
│   │       ├── cron/
│   │       │   ├── notify/             # Hourly cron — detects new jobs, queues notifications
│   │       │   └── send-notifications/ # 8-hour cron — sends batched email + SMS
│   │       └── admin/
│   │           ├── init-db/        # One-time: creates Postgres tables
│   │           └── migrate-jobs/   # One-time: copies Redis job-first-seen → Postgres
│   ├── lib/
│   │   └── notif-helpers.js    # Shared: isInternship, isGraduateProgram, buildEmailHtml
│   ├── package.json
│   ├── jsconfig.json           # Enables @/ import alias
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

Node.js is installed locally at `~/local/node/bin` (not via Homebrew). Always run:
```bash
export PATH="$HOME/local/node/bin:$PATH"
```

## Architecture

### Browse dashboard (`page.js` → bank API routes)
Shows **all currently active** analyst and intern job listings across all 8 banks. Each bank API route calls the bank's careers API in real time and returns whatever is live right now — no age filter. Jobs can be live for months.

### Recent tab (`/api/jobs-new` → Postgres `jobs` table)
Shows only jobs detected **within the last 48 hours** (Pro subscribers only). Reads from the Postgres `jobs` table. No "Earlier This Week" section — just the last 48 hours. The `jobs` table is a permanent historical record; jobs never get deleted.

### Hourly cron (`/api/cron/notify`)
Runs every hour. Detects new jobs by comparing current bank API results against Redis `seen-job-links`. For each new job:
1. Writes to Redis `job-first-seen` (legacy, kept for fallback)
2. **Inserts into Postgres `jobs` table** — powers the Recent tab
3. For each subscribed user whose preferences (bank + job type) match: inserts into `notification_queue`

Skips jobs posted more than 7 days ago (stale jobs that somehow appear new after a Redis wipe).

### 8-hour send cron (`/api/cron/send-notifications`)
Runs at midnight, 8am, 4pm UTC. Reads all rows from `notification_queue`, groups by user, sends **one email + one SMS per user** with all accumulated matching jobs since the last send, then deletes those rows.

### Notification preferences
Users set preferences in their dashboard: banks (multi-select), job type (analyst / internship / all), SMS enabled + phone number. The hourly cron filters new jobs against these preferences before queuing. Only jobs matching a user's preferences trigger a notification.

## Postgres Database (Vercel / Neon)

Two tables:

**`jobs`** — every job ever detected, permanent record
- `link TEXT PRIMARY KEY`
- `title TEXT`
- `bank TEXT`, `bank_key TEXT`
- `location TEXT`, `category TEXT`
- `posted_date TIMESTAMPTZ` (from bank API if available)
- `detected_at TIMESTAMPTZ` (when our cron first saw it)

**`notification_queue`** — jobs waiting to be sent to subscribers
- `id SERIAL PRIMARY KEY`
- `user_id TEXT` (Clerk user ID)
- `job_link`, `job_title`, `job_bank`, `job_location`, `job_category`
- `queued_at TIMESTAMPTZ`

### DB setup (one-time, already done)
1. Create Postgres database in Vercel dashboard → Storage → Connect to project
2. `vercel env pull .env.local` — pulls `POSTGRES_URL` etc.
3. `POST /api/admin/init-db` — creates both tables
4. `POST /api/admin/migrate-jobs` — copies existing Redis data into `jobs` table

## Key Technical Details

### Bank APIs
- **JPMC**: Oracle HCM REST API. Pagination via `offset`, max 25/page, 1s delay required. Category ID `300000086153065`, US location ID `300000000289738`.
- **Goldman Sachs**: GraphQL API at `api-higher.gs.com`.
- **Morgan Stanley**, **BofA**, **UBS**, **Barclays**: Workday APIs (`wday/cxs/.../jobs`).
- **Citi**: iCIMS API.
- **Deutsche Bank**: Beesite API (two endpoints: professional + graduate).
- All bank routes must have `export const dynamic = "force-dynamic"` to prevent Next.js build-time prerender errors.

### Redis (Upstash)
- `seen-job-links` — set of all job links currently live (for dedup in hourly cron)
- `job-first-seen` — hash of link → job metadata with `detectedAt` (legacy, kept alongside Postgres)

### Cron schedules (vercel.json)
- `notify`: `0 * * * *` — top of every hour
- `send-notifications`: `0 */8 * * *` — every 8 hours

### Graduate program filter
Jobs with "graduate" / "grad program" / "grad programme" in the title are filtered out of both the browse dashboard and notifications (not analyst/intern level).

## Deployment

- **Live site:** petespostings.com
- **GitHub repo:** github.com/peterkostas6/job-scraper
- **Vercel project name:** thisisforbenseyesonly
- **Vercel root directory:** `web`
- **Framework preset:** Next.js
- Pushing to `main` automatically deploys to Vercel.

### Workflow for making changes

1. Pete asks for a change
2. Claude makes the change locally
3. Pete previews at http://localhost:3000 (dev server must be running)
4. Pete approves and asks Claude to push
5. Claude commits and pushes to GitHub — Vercel auto-deploys

### Running the dev server

```bash
export PATH="$HOME/local/node/bin:$PATH"
cd web && npm run dev    # starts at http://localhost:3000
```

### Pushing changes live

```bash
git add <files> && git commit -m "message" && git push
```

## Branding

- The site is called **Pete's Postings**
- Nav logo says "Pete's Postings"
- Browser tab title says "Pete's Postings"
- Live URL: petespostings.com
