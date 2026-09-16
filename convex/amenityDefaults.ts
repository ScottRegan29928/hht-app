/**
 * Defaults for the amenity filter registry [scott, 2026-09-16].
 *
 * Split out from amenitySettings.ts so the pure rules can be imported by the
 * client and unit-tested without pulling in Convex server bindings.
 *
 * The rule: the twelve curated facets are filterable out of the box, raw
 * HostAway tags are not. That keeps the current filter UI byte-identical on
 * the day this ships — the admin opts in to anything more.
 */

import { FACET_IDS, isRawTagId } from "./searchFacets";

const FACET_ID_SET = new Set(FACET_IDS);

/** Filterable-by-default? True for the curated twelve, false for raw tags. */
export function defaultFilterEnabled(amenityId: string): boolean {
  if (isRawTagId(amenityId)) return false;
  return FACET_ID_SET.has(amenityId);
}

export interface AmenitySettingRow {
  amenityId: string;
  filterEnabled: boolean;
  siteDisabled?: string[];
}

/**
 * Is this amenity an active search filter on this site?
 *
 * Global `filterEnabled` decides for all four sites; `siteDisabled` lets one
 * site opt out. A site cannot opt IN to something switched off globally —
 * that is deliberate, and it is what Scott asked for:
 *
 *   "Across all four but with the ability to toggle on and off per site."
 *
 * So the global switch is the ceiling and per-site can only subtract. If that
 * ever needs to become a true per-site opt-in, add `siteEnabled` rather than
 * reinterpreting this field, or every existing row changes meaning.
 */
export function isFilterableOnSite(
  amenityId: string,
  row: AmenitySettingRow | undefined,
  siteSlug: string | undefined,
): boolean {
  const globallyOn = row ? row.filterEnabled : defaultFilterEnabled(amenityId);
  if (!globallyOn) return false;
  if (!siteSlug) return true;
  return !(row?.siteDisabled ?? []).includes(siteSlug);
}
