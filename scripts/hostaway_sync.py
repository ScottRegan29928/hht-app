#!/usr/bin/env python3
"""
Hostaway → HHT App Sync Script
READ-ONLY: Only pulls data from Hostaway, never pushes.

Syncs:
1. Property listings (details, photos, amenities)
2. Calendar availability (blocked dates)

Usage:
    python scripts/hostaway_sync.py                    # Full sync
    python scripts/hostaway_sync.py --listings-only    # Listings only
    python scripts/hostaway_sync.py --calendar-only    # Calendar only
    python scripts/hostaway_sync.py --dry-run          # Preview changes
"""

import httpx
import json
import subprocess
import sys
import re
from pathlib import Path
from datetime import datetime, timedelta

# ── Config ──
import os

PROJECT_DIR = Path(__file__).parent.parent


def _load_env_file(path: Path) -> None:
    """Load KEY=VALUE pairs from a dotenv file into os.environ (no overwrite)."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


# Credentials come from the environment (or the gitignored .env.hostaway file).
# Never hardcode them here — this repo is public.
_load_env_file(PROJECT_DIR / ".env.hostaway")

HOSTAWAY_CLIENT_ID = os.environ.get("HOSTAWAY_CLIENT_ID", "")
HOSTAWAY_CLIENT_SECRET = os.environ.get("HOSTAWAY_CLIENT_SECRET", "")
HOSTAWAY_API = "https://api.hostaway.com/v1"

if not HOSTAWAY_CLIENT_ID or not HOSTAWAY_CLIENT_SECRET:
    sys.exit(
        "Missing HostAway credentials.\n"
        "Set HOSTAWAY_CLIENT_ID and HOSTAWAY_CLIENT_SECRET as environment variables,\n"
        "or create a .env.hostaway file in the project root (it is gitignored)."
    )

# Manual overrides for listings with non-standard names
LISTING_OVERRIDES = {
    392484: {"community": "swallowtail-at-sea-pines", "unit": "2885", "name": "2885 Swallowtail"},
}

# Community name → slug mapping for matching
COMMUNITY_MAP = {
    "swallowtail": "swallowtail-at-sea-pines",
    "spicebush": "spicebush",
    "racquet club": "racquet-club",
    "plantation club": "plantation-club",
    "night heron": "night-heron",
    "port villa": "port-villa",
    "twin oaks": "twin-oaks",
    "ketch court": "ketch-court",
}


def get_token() -> str:
    """Get Hostaway OAuth token."""
    resp = httpx.post(
        f"{HOSTAWAY_API}/accessTokens",
        headers={
            "Content-type": "application/x-www-form-urlencoded",
            "Cache-control": "no-cache",
        },
        data={
            "grant_type": "client_credentials",
            "client_id": HOSTAWAY_CLIENT_ID,
            "client_secret": HOSTAWAY_CLIENT_SECRET,
            "scope": "general",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def convex_query(fn: str, args: dict = {}) -> any:
    """Run a Convex internal query."""
    result = subprocess.run(
        ["npx", "convex", "run", "--no-push", fn, json.dumps(args)],
        capture_output=True, text=True, cwd=str(PROJECT_DIR),
    )
    if result.returncode != 0:
        print(f"  ❌ Query {fn} failed: {result.stderr[:200]}")
        return None
    return json.loads(result.stdout)


def convex_mutation(fn: str, args: dict) -> any:
    """Run a Convex internal mutation."""
    result = subprocess.run(
        ["npx", "convex", "run", "--no-push", fn, json.dumps(args)],
        capture_output=True, text=True, cwd=str(PROJECT_DIR),
    )
    if result.returncode != 0:
        print(f"  ❌ Mutation {fn} failed: {result.stderr[:200]}")
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return result.stdout.strip()


def detect_community(name: str) -> str | None:
    """Detect community slug from a Hostaway listing name."""
    name_lower = name.lower()
    for keyword, slug in COMMUNITY_MAP.items():
        if keyword in name_lower:
            return slug
    return None


def extract_unit_number(name: str) -> str:
    """Extract unit number from listing name like '441 Plantation Club'."""
    match = re.match(r"(\d+)", name.strip())
    return match.group(1) if match else name.split()[0]


def make_slug(name: str) -> str:
    """Generate URL slug from listing name."""
    clean = name.lower()
    clean = re.sub(r"\s*-\s*", " ", clean)
    clean = re.sub(r"\s+at sea pines$", "", clean)
    clean = re.sub(r"\s*\|.*$", "", clean)
    clean = re.sub(r"\s+sleeps.*$", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\s+lux.*$", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"[^a-z0-9\s]", "", clean)
    clean = re.sub(r"\s+", "-", clean.strip())
    return clean


def format_phone(phone: str | None) -> str | None:
    """Format phone number."""
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 11 and digits[0] == "1":
        digits = digits[1:]
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    return phone


def format_time(hour: int | None) -> str | None:
    """Convert hour (24h) to readable time."""
    if hour is None:
        return None
    if hour == 0:
        return "12:00 AM"
    elif hour < 12:
        return f"{hour}:00 AM"
    elif hour == 12:
        return "12:00 PM"
    else:
        return f"{hour - 12}:00 PM"


BED_TYPE_MAP = {
    1: "Double Bed",
    2: "King Bed",
    3: "Single Bed",
    4: "Sofa Bed",
    5: "Bunk Bed",
    6: "Queen Bed",
}


def sync_listings(token: str, dry_run: bool = False):
    """Sync property listings from Hostaway."""
    print("\n═══ SYNCING LISTINGS ═══")

    resp = httpx.get(f"{HOSTAWAY_API}/listings", headers={"Authorization": f"Bearer {token}"}, timeout=60)
    resp.raise_for_status()
    ha_listings = resp.json().get("result", [])
    print(f"  Hostaway: {len(ha_listings)} listings")

    db_properties = convex_query("hostawaySync:getAllProperties")
    communities = convex_query("hostawaySync:getAllCommunities")

    if not db_properties or not communities:
        print("  ❌ Failed to query DB")
        return

    print(f"  DB: {len(db_properties)} properties, {len(communities)} communities")

    community_by_slug = {c["slug"]: c for c in communities}
    prop_by_hostaway_id = {p["hostawayId"]: p for p in db_properties if p.get("hostawayId")}
    prop_by_slug = {p["slug"]: p for p in db_properties}

    stats = {"updated": 0, "created": 0, "skipped": 0, "errors": 0}

    for ha in ha_listings:
        ha_id = ha["id"]
        ha_name = ha.get("name", ha.get("externalListingName", f"Listing {ha_id}"))

        # Check for manual overrides
        override = LISTING_OVERRIDES.get(ha_id)
        if override:
            community_slug = override["community"]
            unit_number = override["unit"]
            ha_name = override.get("name", ha_name)
        else:
            community_slug = detect_community(ha_name)
            unit_number = extract_unit_number(ha_name)

        if not community_slug:
            print(f"  ⚠️  Cannot detect community for: {ha_name}")
            stats["skipped"] += 1
            continue

        community = community_by_slug.get(community_slug)
        if not community:
            print(f"  ⚠️  Community not in DB: {community_slug} (for {ha_name})")
            stats["skipped"] += 1
            continue

        slug = make_slug(ha_name)
        community_short = community["name"].split(" at ")[0] if " at " in community["name"] else community["name"]
        address = f"{unit_number} {community_short}"

        existing = prop_by_hostaway_id.get(ha_id)
        if not existing:
            existing = prop_by_slug.get(slug)

        images = sorted(ha.get("listingImages", []), key=lambda i: i.get("sortOrder", 999))
        photo_urls = [img["url"] for img in images if img.get("url")]

        amenity_tags = sorted(set(
            a.get("amenityName", "") for a in ha.get("listingAmenities", [])
            if a.get("amenityName")
        ))

        bed_types_raw = ha.get("listingBedTypes", [])
        bed_types = []
        beds_count = 0
        for bt in bed_types_raw:
            if isinstance(bt, dict):
                type_name = BED_TYPE_MAP.get(bt.get("bedTypeId"), f"Bed Type {bt.get('bedTypeId')}")
                qty = bt.get("quantity", 1)
                beds_count += qty
                for _ in range(qty):
                    bed_types.append(type_name)

        args = {
            "hostawayId": ha_id,
            "address": address,
            "slug": slug,
            "unitNumber": unit_number,
            "communityId": community["_id"],
            "bedrooms": ha.get("bedroomsNumber", 0),
            "bathrooms": ha.get("bathroomsNumber", 0),
            "sleeps": ha.get("personCapacity"),
            "description": ha.get("description"),
            "amenityTags": amenity_tags if amenity_tags else None,
            "latitude": ha.get("lat"),
            "longitude": ha.get("lng"),
            "photoUrls": photo_urls if photo_urls else None,
            "nightlyRate": ha.get("price"),
            "cleaningFee": ha.get("cleaningFee"),
            "weeklyDiscount": ha.get("weeklyDiscount"),
            "monthlyDiscount": ha.get("monthlyDiscount"),
            "maxNights": ha.get("maxNights"),
            "minNights": ha.get("minNights"),
            "checkInTime": format_time(ha.get("checkInTimeStart")),
            "checkOutTime": format_time(ha.get("checkOutTime")),
            "bedsCount": beds_count if beds_count > 0 else ha.get("bedsNumber"),
            "roomType": ha.get("roomType"),
            "contactPhone": format_phone(ha.get("contactPhone1")),
        }

        args = {k: v for k, v in args.items() if v is not None}

        if existing:
            args["existingId"] = existing["_id"]
            action_label = "UPDATE"
        else:
            action_label = "CREATE"

        if dry_run:
            print(f"  {'🔄' if existing else '✨'} [{action_label}] {address} (HA:{ha_id}, slug:{slug})")
            stats[action_label.lower() + "d"] += 1
        else:
            result = convex_mutation("hostawaySync:upsertProperty", args)
            if result:
                action = result.get("action", action_label.lower() + "d") if isinstance(result, dict) else action_label.lower() + "d"
                if action not in stats:
                    action = action_label.lower() + "d"
                stats[action] += 1
                print(f"  {'🔄' if 'update' in action else '✨'} [{action.upper()}] {address}")
            else:
                stats["errors"] += 1
                print(f"  ❌ Failed: {address}")

    print(f"\n  Summary: {stats['updated']} updated, {stats['created']} created, {stats['skipped']} skipped, {stats['errors']} errors")


def sync_calendar(token: str, dry_run: bool = False, days_ahead: int = 180):
    """Sync calendar availability from Hostaway."""
    print(f"\n═══ SYNCING CALENDAR ({days_ahead} days ahead) ═══")

    db_properties = convex_query("hostawaySync:getAllProperties")
    if not db_properties:
        print("  ❌ Failed to query DB")
        return

    props_with_ha = [p for p in db_properties if p.get("hostawayId")]
    print(f"  Properties with Hostaway ID: {len(props_with_ha)}")

    start_date = datetime.now().strftime("%Y-%m-%d")
    end_date = (datetime.now() + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

    stats = {"properties": 0, "blocked_ranges": 0, "errors": 0}

    for prop in props_with_ha:
        ha_id = prop["hostawayId"]
        prop_id = prop["_id"]

        try:
            resp = httpx.get(
                f"{HOSTAWAY_API}/listings/{ha_id}/calendar",
                headers={"Authorization": f"Bearer {token}"},
                params={"startDate": start_date, "endDate": end_date},
                timeout=30,
            )
            resp.raise_for_status()
            days = resp.json().get("result", [])

            bookings = []
            current_start = None
            for day in days:
                if not day.get("isAvailable"):
                    if current_start is None:
                        current_start = day["date"]
                else:
                    if current_start is not None:
                        bookings.append({
                            "startDate": current_start,
                            "endDate": day["date"],
                            "source": "hostaway",
                            "summary": "Blocked (Hostaway)",
                        })
                        current_start = None
            if current_start is not None:
                bookings.append({
                    "startDate": current_start,
                    "endDate": end_date,
                    "source": "hostaway",
                    "summary": "Blocked (Hostaway)",
                })

            if dry_run:
                print(f"  📅 {prop['address']}: {len(bookings)} blocked ranges")
            else:
                result = convex_mutation("hostawaySync:upsertCalendarBookings", {
                    "propertyId": prop_id,
                    "bookings": bookings,
                })
                if result:
                    deleted = result.get("deleted", 0) if isinstance(result, dict) else "?"
                    inserted = result.get("inserted", 0) if isinstance(result, dict) else "?"
                    print(f"  📅 {prop['address']}: {inserted} blocked ranges (replaced {deleted})")
                else:
                    print(f"  ❌ Calendar sync failed for {prop['address']}")
                    stats["errors"] += 1

            stats["properties"] += 1
            stats["blocked_ranges"] += len(bookings)

        except Exception as e:
            print(f"  ❌ Calendar error for {prop['address']}: {e}")
            stats["errors"] += 1

    print(f"\n  Summary: {stats['properties']} properties, {stats['blocked_ranges']} blocked ranges, {stats['errors']} errors")


def main():
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    listings_only = "--listings-only" in args
    calendar_only = "--calendar-only" in args

    if dry_run:
        print("🏖️  DRY RUN — no changes will be made")
    print(f"🔑 Authenticating with Hostaway...")

    token = get_token()
    print(f"✅ Token received")

    if not calendar_only:
        sync_listings(token, dry_run=dry_run)
    if not listings_only:
        sync_calendar(token, dry_run=dry_run)

    print("\n✅ Sync complete!")


if __name__ == "__main__":
    main()
