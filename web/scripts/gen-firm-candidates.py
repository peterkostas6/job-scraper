#!/usr/bin/env python3
"""Build the candidate firm list for lib/firm-registry.js from Simplify's public job data.

Simplify publishes its internship and new-grad listings as JSON on GitHub. Each listing's
apply link names the firm's job-board system and board id (a Workday tenant/site, a
Greenhouse/Lever/Ashby slug, an Oracle site). We only take those ids from Simplify; the site
fetches jobs straight from each firm's own board, like the rest of the scrapers.

Usage:  python3 scripts/gen-firm-candidates.py OUT.json [internships.json new-grad.json]
        (pass the two listings.json files if Python can't download them itself)
Then:   node scripts/check-firms.mjs OUT.json   (tests each board, writes lib/firm-registry.js)
"""
import json, re, sys, urllib.request
from urllib.parse import urlparse, parse_qs

LISTS = [
    "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json",
    "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/.github/scripts/listings.json",
]

# Firms already on the site (lib/banks.js) under Simplify's spelling, so they aren't added twice.
ALREADY = re.compile(r"^(jp ?morgan|chase|goldman|morgan stanley|bank of america|bofa|citi(group|bank)?$|citi\b|deutsche bank|barclays|wells fargo|mufg|mitsubishi ufg|td (bank|securities)|mizuho|bmo|bank of montreal|houlihan|guggenheim|macquarie|piper sandler|stifel|blackstone|blackrock|jefferies|ubs|evercore|lazard|moelis|pjt|perella|william blair|harris williams|lincoln international|leerink|raine|ardea|d\.a\. davidson|raymond james|truist|citizens|pnc|santander|cibc|rbc|royal bank of canada|scotiabank|bank of nova scotia|rothschild|charles schwab|schwab)", re.I)

# Simplify files some non-finance companies under Quant (grocers, oil majors, sportsbooks…).
NOT_FINANCE = re.compile(r"sainsbury|^bp$|exxon|chevron|shell|thyssen|aramark|starbucks|four seasons|caesars|duluth|fanduel|flutter|bet365|nucor|procter|equinor|conoco|university|college|detroit|major league|hilton|^gap$|tjx|dollar general|waste|^kla$|applied materials|wpp|omnicom|publicis|trade desk|asda|repsol|ovo|centrica|glencore|gunvor|amazon|telus|wolverine world|penn interactive|^miq$|underdog|fanatics|light & wonder|hard rock|superbet|council|county|health|kirin|ferrovial|nextera|constellation energy|nrg|edf|ercot|iso$|power pool|clearway|cenovus|aramco|energy|whitewater|first quantum|^ge |cigna|hcsc|greystar|cushman|deloitte|pwc|pricewaterhouse|ernst|kpmg|andersen|boston consulting|capco|brookings|strategic and international|rescue|stand together|swoon|^moo$|arena club|targray|base power|aircapture|voltus|expedia|bosch|stanley black|kion|altice|blackhawk|meridian partners|systems$|labs$|ventures$|media|entertainment|airlines|motors|automotive|pharma|semiconductor|hospital|children|village|montenson|school|city of|state of|department of", re.I)

TYPES = [  # first match wins
    ("trading", r"susquehanna|citadel securities|jane street|jump trading|imc trading|akuna|hudson river|optiver|\bdrw\b|tower research|five rings|virtu|old mission|chicago trading|dv trading|belvedere|flow traders|transmarket|peak6|geneva trading|wolverine trading|xr trading|radix|headlands|valkyrie|quantlab|vatic|eagle seven|gelber|maven securities|all options|da vinci|edgehog|keyrock|wintermute|\bgts\b|xantium|seven research|mustard|trading"),
    ("hedge", r"^citadel$|two sigma|point72|millennium|bridgewater|\baqr\b|man group|marshall wace|brevan howard|squarepoint|g-research|qube|jain global|schonfeld|balyasny|exodus|verition|capula|capstone|walleye|voloridge|d\. ?e\. shaw|renaissance|voleon|graham capital|winton|aspect capital|garda|viking global|soros|elliott|pdt partners|trexquant|quantbot|worldquant|engineers gate|cubist|sculptor|tudor|hap capital|qms|anthelion|fasanara|teza|pharo|aquatic|gsa capital|axq|jain"),
    ("pe", r"\bkkr\b|apollo|ares management|carlyle|brookfield|general atlantic|stepstone|hps investment|blue owl|\btpg\b|warburg|bain capital|silver lake|thoma bravo|vista equity|hellman|advent international|\beqt\b|permira|cvc|blackrock private|private equity|turn/river|affinius|pretium|arena investors"),
    ("exchange", r"intercontinental exchange|\bice\b|nasdaq|cme group|\bcboe\b|\blseg\b|tradeweb|\bdtcc\b|\bocc\b|s&p global|moody|msci|morningstar|euronext|tmx|bloomberg|factset|clearwater analytics|ss&c|broadridge|hong kong exchanges|kroll bond|\biss\b"),
    ("asset", r"vanguard|fidelity|pimco|invesco|t\. ?rowe|wellington|state street|franklin|nuveen|neuberger|alliancebernstein|dimensional|acadian|russell investments|schroders|\bmfs\b|american century|calamos|northern trust|arrowstreet|panagora|cambridge associates|\bgmo\b|aegon|legal & general|aviva investors|pgim|mackenzie|picton|wisdomtree|conning|ppm america|cliffwater|investment management|asset management|investments\b|advisors\b|capital management|wealth|investment board|pension|teachers|omers|aimco|alberta investment|psp investments|british columbia investment|uvimco|permanent school fund"),
    ("insurance", r"insurance|mutual|\blife\b|prudential|metlife|travelers|allstate|progressive|\baon\b|marsh|willis|\bwtw\b|nationwide|guardian|aflac|assurance|athene|genworth|zurich|aviva|everest|kemper|selective|enact|principal financial|voya|ameriprise|equitable|lincoln financial|globe life|rothesay"),
    ("bank", r"bank|bancorp|bancshares|financial|credit union|capital one|american express|\bm&t\b|fifth third|keybank|u\.s\. bank|\bbny\b|huntington|regions|\bally\b|synchrony|discover|\blpl\b|baird|oppenheimer|cantor|btig|federal home loan|fhlb|freddie mac|fannie mae|federal reserve|navy federal|usaa|stonex|frost|zions|first citizens|comerica|webster|east west|ocbc|dbs|bbva|banco|natwest|lloyds|hsbc|bnp|nomura|societe generale|credit agricole|\bing\b|abn|rabobank|nordea|danske|kbw|keefe|cowen|wedbush|janney|hilltop|stephens|b\. riley"),
    ("fintech", r"visa|mastercard|paypal|stripe|block\b|square|plaid|robinhood|coinbase|chime|sofi|affirm|klarna|brex|ramp|marqeta|toast|fiserv|fis\b|global payments|jack henry|blockchain|galaxy|talos|alpaca|ninjatrader|hiive|icapital|ipreo|figure|best egg|lendable|rho\b|sentilink|debtbook|merqube|bmll|optionmetrics"),
]
TYPE_RE = [(t, re.compile(p, re.I)) for t, p in TYPES]

def firm_type(name):
    for t, r in TYPE_RE:
        if r.search(name):
            return t
    return None

def source_from_url(u):
    p = urlparse(u or "")
    h = p.netloc.lower()
    parts = [x for x in p.path.split("/") if x]
    if h.endswith("myworkdayjobs.com"):
        tenant = h.split(".")[0]
        site = [x for x in parts if not re.match(r"^[a-z]{2}-[A-Z]{2}$", x) and x not in ("job", "details", "jobs")]
        if not site:
            return None
        return {"type": "workday", "host": h, "tenant": tenant, "site": site[0]}
    if "greenhouse.io" in h:
        q = parse_qs(p.query)
        slug = (q.get("for") or [None])[0] or (parts[0] if parts and parts[0] not in ("embed",) else None)
        return {"type": "greenhouse", "slug": slug} if slug else None
    if h == "jobs.lever.co" and parts:
        return {"type": "lever", "slug": parts[0]}
    if h == "jobs.ashbyhq.com" and parts:
        return {"type": "ashby", "slug": parts[0]}
    if "oraclecloud.com" in h and "sites" in parts:
        i = parts.index("sites")
        if i + 1 < len(parts):
            return {"type": "oracle", "host": h, "site": parts[i + 1]}
    if "smartrecruiters.com" in h and parts:
        return {"type": "smartrecruiters", "company": parts[0]}
    if h.endswith("icims.com"):
        return {"type": "icims", "host": h}
    return None

def key_for(name, used):
    k = re.sub(r"[^a-z0-9]+", "", name.lower().replace("&", "and"))[:24] or "firm"
    base, n = k, 2
    while k in used:
        k, n = f"{base}{n}", n + 1
    used.add(k)
    return k

def load(sources):
    for s in sources:
        yield from json.load(open(s) if not s.startswith("http") else urllib.request.urlopen(s))

def main(out, inputs):
    firms = {}
    for x in load(inputs or LISTS):
        if True:
            name = (x.get("company_name") or "").strip()
            if not name or ALREADY.search(name) or NOT_FINANCE.search(name):
                continue
            t = firm_type(name)
            if not t and x.get("category") not in ("Quant", "Quantitative Finance"):
                continue
            src = source_from_url(x.get("url"))
            if not src:
                continue
            sig = json.dumps(src, sort_keys=True)
            f = firms.setdefault(sig, {"names": {}, "type": t or "hedge", "src": src, "active": 0})
            f["names"][name] = f["names"].get(name, 0) + 1
            f["active"] += bool(x.get("active"))
    used, rows = set(), []
    for f in sorted(firms.values(), key=lambda f: -f["active"]):
        name = max(f["names"], key=lambda n: (f["names"][n], -len(n)))
        name = re.sub(r"\s*\((?:[A-Z]{2,5})\)$", "", name)  # "Susquehanna International Group (SIG)" -> base name
        rows.append({"key": key_for(name, used), "name": name, "type": f["type"], "src": f["src"]})
    json.dump(rows, open(out, "w"), indent=1)
    by = {}
    for r in rows:
        by[r["src"]["type"]] = by.get(r["src"]["type"], 0) + 1
    print(len(rows), "candidate boards", by)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
