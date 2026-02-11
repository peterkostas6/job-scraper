"""
Job Listings Scraper — JPMorgan Chase Careers
Fetches analyst-level job postings from JPMC's career API and saves to CSV.
"""

import requests
import csv
import time
from datetime import datetime

# The base URL for JPMC's career API (Oracle HCM)
API_URL = (
    "https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/"
    "recruitingCEJobRequisitions"
)

# The career site base URL (for building clickable job links)
SITE_URL = (
    "https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/"
    "sites/CX_1001/job"
)

# Filter ID for the "Analysts" category (from the API's facets data)
ANALYSTS_CATEGORY_ID = "300000086153065"
UNITED_STATES_LOCATION_ID = "300000000289738"


def fetch_jobs_page(category_id, location_id, offset=0):
    """Fetch one page (25 jobs) from the JPMC careers API."""
    finder = (
        f"findReqs;siteNumber=CX_1001"
        f",limit=25"
        f",offset={offset}"
        f",sortBy=POSTING_DATES_DESC"
        f",selectedCategoriesFacet={category_id}"
        f",selectedLocationsFacet={location_id}"
    )

    params = {
        "onlyData": "true",
        "expand": "requisitionList.secondaryLocations",
        "finder": finder,
    }

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
    }

    response = requests.get(API_URL, params=params, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()


def fetch_all_jobs(category_id, location_id):
    """Fetch all analyst jobs, paginating 25 at a time."""
    all_jobs = []
    offset = 0
    page = 1

    while True:
        print(f"  Page {page} (jobs {offset + 1}-{offset + 25})...")
        data = fetch_jobs_page(category_id, location_id, offset=offset)
        jobs = parse_jobs(data)

        if not jobs:
            break

        all_jobs.extend(jobs)
        offset += 25
        page += 1
        time.sleep(1)  # short pause between requests to avoid overloading the API

    return all_jobs


def parse_jobs(data):
    """Pull out job title and link from the API response."""
    jobs = []

    items = data.get("items", [{}])
    if not items:
        return jobs

    requisitions = items[0].get("requisitionList", [])

    for req in requisitions:
        job = {
            "title": req.get("Title", "N/A"),
            "link": f"{SITE_URL}/{req.get('Id', '')}",
        }
        jobs.append(job)

    return jobs


def save_to_csv(jobs, filename=None):
    """Save job listings to a CSV file."""
    if not filename:
        today = datetime.now().strftime("%Y-%m-%d")
        filename = f"jpmc_analyst_jobs_{today}.csv"

    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["title", "link"])
        writer.writeheader()
        writer.writerows(jobs)

    print(f"Saved {len(jobs)} jobs to {filename}")
    return filename


def main():
    print("Fetching all analyst jobs in the US from JPMC...")
    jobs = fetch_all_jobs(ANALYSTS_CATEGORY_ID, UNITED_STATES_LOCATION_ID)
    print(f"\nFound {len(jobs)} analyst job listings in the US")

    if jobs:
        print("\n--- Preview (first 5) ---")
        for job in jobs[:5]:
            print(f"  {job['title']}")
            print(f"    {job['link']}")
            print()

        save_to_csv(jobs)
    else:
        print("No jobs found.")


if __name__ == "__main__":
    main()
