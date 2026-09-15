/**
 * The curated search-filter taxonomy [scott, 2026-09-15].
 *
 * The filter list used to be every distinct HostAway amenity tag, which meant
 * 138 alphabetical checkboxes ("Baking sheet", "Antiquing", "Iron board") that
 * nobody would ever filter a villa by. Scott replaced that with exactly these
 * twelve facets, and this file is the only place they are defined.
 *
 * Each facet resolves from three layers, in order of authority:
 *
 *   1. `facetOverrides` on the property — an admin decision, always wins.
 *   2. HostAway `amenityTags` — imported, so read-only in our admin [scott #7].
 *   3. `amenities` on the community — for facets that are a property of the
 *      place rather than the unit (shuffleboard, beach club proximity).
 *
 * Two facets have no usable source data at all: PATIO is tagged on 1 of 82
 * properties and SHUFFLEBOARD on none. They resolve to false until an admin
 * sets them, which is why the admin editor exposes all twelve rather than only
 * the ones HostAway can't supply.
 *
 * ⚠ Convex functions cannot import from `src/`, so this lives here and the
 * client imports it from `convex/searchFacets`. Do not fork a second copy in
 * `src/lib` — a drifting label list would silently filter on ids the server
 * doesn't know.
 */

export interface FacetDef {
  id: string;
  label: string;
  /** HostAway amenityTag names that imply this facet (case-insensitive). */
  tags?: string[];
  /** Community `amenities` keys that imply this facet. */
  communityKeys?: string[];
  /** Set when the facet cannot be derived and must be entered by an admin. */
  adminOnly?: boolean;
  /** Free-form note surfaced in the admin editor. */
  note?: string;
}

/**
 * Ordered exactly as Scott listed them, which is alphabetical by label. The
 * UI renders this order, so it is intentionally not re-sorted at runtime.
 */
export const SEARCH_FACETS: FacetDef[] = [
  {
    id: "balcony",
    label: "Balcony",
    tags: ["balcony"],
  },
  {
    id: "golf_course_view",
    label: "Golf Course View",
    tags: ["golf course view", "golf course front"],
    communityKeys: ["on_golf_course"],
  },
  {
    id: "grill_area",
    label: "Grill Area",
    tags: ["outdoor grill", "barbeque utensils", "bbq grill"],
    communityKeys: ["grill"],
  },
  {
    id: "hot_tub",
    label: "Hot Tub",
    tags: ["hot tub", "jacuzzi"],
    communityKeys: ["hot_tub"],
  },
  {
    id: "near_marina",
    label: "Near Marina/Harbour Town",
    tags: ["marina"],
    communityKeys: ["marina", "near_harbour_town"],
  },
  {
    id: "near_beach_club",
    label: "Near Sea Pines Beach Club",
    // Deliberately NOT the HostAway "Beach" tag: all 82 properties carry it,
    // so it would make this facet meaningless. Community-scoped only.
    communityKeys: ["near_beach_club"],
  },
  {
    id: "patio",
    label: "Patio",
    tags: ["deck patio uncovered", "patio", "deck"],
    adminOnly: true,
    note: "Only 1 property carries a patio tag in HostAway — set this per property.",
  },
  {
    id: "shuffleboard",
    label: "Shuffleboard Courts",
    adminOnly: true,
    note: "No source data anywhere. Set it on the community or per property.",
    communityKeys: ["shuffleboard"],
  },
  {
    id: "pool_heated",
    label: "Swimming Pool, Heated",
    tags: ["heated swimming pool"],
  },
  {
    id: "pool_unheated",
    label: "Swimming Pool, Unheated",
    // No "unheated pool" tag exists. Inferred: has a pool but not a heated one.
    // Inference is in resolveFacets, not here, because it depends on another
    // facet's outcome.
    tags: [],
    note: "Inferred as 'has a pool, but not a heated one'. Override per property.",
  },
  {
    id: "tennis",
    label: "Tennis Courts",
    tags: ["tennis", "communal tennis court"],
    communityKeys: ["tennis"],
  },
  {
    id: "water_view",
    label: "Water/Lagoon View",
    tags: ["water view", "lake view", "ocean view", "waterfront"],
    communityKeys: ["lagoon_views", "water_views"],
  },
];

export const FACET_IDS = SEARCH_FACETS.map((f) => f.id);

const FACET_BY_ID = new Map(SEARCH_FACETS.map((f) => [f.id, f]));

export function facetLabel(id: string): string {
  return FACET_BY_ID.get(id)?.label ?? id;
}

/** Tags that mean "there is a pool of some kind", for the unheated inference. */
const ANY_POOL_TAGS = ["swimming pool", "communal swimming pool", "pool", "heated swimming pool"];

function hasTag(tagsLower: Set<string>, wanted: string[]): boolean {
  return wanted.some((w) => tagsLower.has(w));
}

/**
 * Resolve which of the twelve facets a property matches.
 *
 * `overrides` is a sparse record of admin decisions: `{ patio: true }` forces
 * a facet on, `{ tennis: false }` forces it off even though HostAway says
 * otherwise. Anything absent falls through to the derived value.
 */
export function resolveFacets(
  amenityTags: string[] | undefined,
  communityAmenities: string[] | undefined,
  overrides: Record<string, boolean> | undefined,
): string[] {
  const tagsLower = new Set((amenityTags ?? []).map((t) => t.trim().toLowerCase()));
  const commKeys = new Set(communityAmenities ?? []);

  const derived = new Set<string>();
  for (const f of SEARCH_FACETS) {
    if (f.tags && f.tags.length > 0 && hasTag(tagsLower, f.tags)) {
      derived.add(f.id);
      continue;
    }
    if (f.communityKeys && f.communityKeys.some((k) => commKeys.has(k))) {
      derived.add(f.id);
    }
  }

  // Unheated pool: a pool exists but no heated-pool tag. Runs after the loop
  // because it depends on whether pool_heated resolved.
  if (!derived.has("pool_heated") && (hasTag(tagsLower, ANY_POOL_TAGS) || commKeys.has("pool"))) {
    derived.add("pool_unheated");
  }

  // Admin overrides last, so they beat both HostAway and the inference.
  if (overrides) {
    for (const [id, on] of Object.entries(overrides)) {
      if (!FACET_BY_ID.has(id)) continue;
      if (on) derived.add(id);
      else derived.delete(id);
    }
  }

  // Preserve SEARCH_FACETS order rather than insertion order.
  return FACET_IDS.filter((id) => derived.has(id));
}

/**
 * What the admin editor needs per facet: the value HostAway/community implies,
 * the override if any, and the effective result.
 */
export function explainFacets(
  amenityTags: string[] | undefined,
  communityAmenities: string[] | undefined,
  overrides: Record<string, boolean> | undefined,
) {
  const derived = new Set(resolveFacets(amenityTags, communityAmenities, undefined));
  const effective = new Set(resolveFacets(amenityTags, communityAmenities, overrides));
  return SEARCH_FACETS.map((f) => ({
    id: f.id,
    label: f.label,
    note: f.note,
    adminOnly: f.adminOnly ?? false,
    derived: derived.has(f.id),
    override: overrides?.[f.id],
    effective: effective.has(f.id),
  }));
}
