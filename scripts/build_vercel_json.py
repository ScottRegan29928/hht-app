"""Regenerate hht-app/vercel.json from a single host->site map.

Every public hostname needs THREE host-matched rules (sitemap, robots,
crawler prerender). Hand-editing them drifted almost immediately, so this
script is the source of truth: add a hostname to HOSTS and re-run.

⚠ vercel_deploy_static.py sends `routes` in the deployment API body, which
makes Vercel ignore vercel.json entirely. That script derives its routes from
this file, so the chain is: HOSTS -> vercel.json -> deployment routes.

Usage:  uv run python skills/hht_website/scripts/build_vercel_json.py [--check]
"""

import argparse
import json
import os
import sys

CONVEX_SITE = "https://savory-heron-748.convex.site"
VERCEL_JSON = "/work/projects/hht-app/vercel.json"

# One entry per site slug -> every hostname that serves it.
HOSTS: dict[str, list[str]] = {
    "heritage": [
        "heritagevacations.com",
        "www.heritagevacations.com",
        # Scott 2026-09-08: hv.lead-works.com is the Heritage front end we
        # build first, before hht.lead-works.com.
        "hv.lead-works.com",
        "hv.hht.lead-works.com",
    ],
    "mhht": [
        "myhiltonheadtimeshare.com",
        "www.myhiltonheadtimeshare.com",
        "hht.lead-works.com",
    ],
    "swallowtail": [
        "swallowtailatseapines.com",
        "www.swallowtailatseapines.com",
        # Scott created these CNAMEs 2026-09-08 (grey cloud, Vercel target).
        "swallowtail.lead-works.com",
        "swallowtail.hht.lead-works.com",
    ],
    "spicebush": [
        "spicebushatseapines.com",
        "www.spicebushatseapines.com",
        "spicebush.lead-works.com",
        "spicebush.hht.lead-works.com",
    ],
}

# The site used when the hostname matches nothing (Vercel preview URLs).
FALLBACK = "mhht"

# Social-preview crawlers only.
#
# ⚠ Googlebot and bingbot are DELIBERATELY EXCLUDED. They execute JavaScript
# and will index the real React app, which carries the full page content.
# Routing them to the prerender would serve them a short summary instead —
# thinner content, not better. Only crawlers that cannot run JS belong here.
CRAWLER_UA = (
    "(?i).*(facebookexternalhit|facebookcatalog|Facebot|Twitterbot|LinkedInBot|"
    "Slackbot|Slack-ImgProxy|WhatsApp|TelegramBot|Discordbot|Pinterest|redditbot|"
    "Applebot|SkypeUriPreview|vkShare|Embedly|quora link preview|"
    "outbrain|nuzzel|Iframely|Google-InspectionTool|Mastodon|Bluesky).*"
)

# Everything except built assets; $1 carries the path through to the resolver.
APP_PATHS = "/((?!assets/).*)"


def build() -> dict:
    rewrites: list[dict] = []

    # 1. Crawler prerender. These must be FIRST — vercel_deploy_static.py also
    #    lifts them above `handle: filesystem`, or "/" would be served straight
    #    from index.html on disk and the homepage preview would never work.
    for slug, hosts in HOSTS.items():
        for host in hosts:
            rewrites.append({
                "source": APP_PATHS,
                "has": [
                    {"type": "host", "value": host},
                    {"type": "header", "key": "user-agent", "value": CRAWLER_UA},
                ],
                "destination": f"{CONVEX_SITE}/api/prerender?site={slug}&path=/$1",
            })
    rewrites.append({
        "source": APP_PATHS,
        "has": [{"type": "header", "key": "user-agent", "value": CRAWLER_UA}],
        "destination": f"{CONVEX_SITE}/api/prerender?site={FALLBACK}&path=/$1",
    })

    # 2. Per-host sitemap.xml and robots.txt.
    for slug, hosts in HOSTS.items():
        for host in hosts:
            for f in ("sitemap.xml", "robots.txt"):
                rewrites.append({
                    "source": f"/{f}",
                    "has": [{"type": "host", "value": host}],
                    "destination": f"{CONVEX_SITE}/api/{f}?site={slug}",
                })

    # 3. Unmatched-host fallback for those two files.
    for f in ("sitemap.xml", "robots.txt"):
        rewrites.append({
            "source": f"/{f}",
            "destination": f"{CONVEX_SITE}/api/{f}?site={FALLBACK}",
        })

    # 4. SPA catch-all. MUST be last.
    rewrites.append({"source": APP_PATHS, "destination": "/index.html"})

    return {"rewrites": rewrites}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="Exit 1 if vercel.json is out of date; write nothing.")
    args = ap.parse_args()

    cfg = build()
    text = json.dumps(cfg, indent=2) + "\n"

    if args.check:
        current = open(VERCEL_JSON).read() if os.path.exists(VERCEL_JSON) else ""
        if current != text:
            print("vercel.json is OUT OF DATE — re-run without --check")
            return 1
        print("vercel.json is up to date")
        return 0

    with open(VERCEL_JSON, "w") as fh:
        fh.write(text)
    hosts = sum(len(h) for h in HOSTS.values())
    print(f"Wrote {VERCEL_JSON}: {len(cfg['rewrites'])} rewrites, "
          f"{hosts} hostnames across {len(HOSTS)} sites")
    return 0


if __name__ == "__main__":
    sys.exit(main())
