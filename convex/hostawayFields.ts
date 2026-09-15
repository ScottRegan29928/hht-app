/**
 * Which property fields HostAway owns [scott, 2026-09-15].
 *
 * > "In the admin portal, any fields that are importing from HostAway need to
 * >  be greyed out and not editable. These fields will only be editable in
 * >  HostAway."
 *
 * This list is derived from the arg list of `upsertProperty` in
 * convex/hostawaySync.ts — every field the sync patches on each run. It is not
 * a judgement call: if a field is in that patch, editing it here was already
 * pointless because the next sync (every 30 minutes) overwrites it. Locking it
 * just makes that visible instead of letting an admin lose work silently.
 *
 * ⚠ If you add a field to `upsertProperty`, add it here too, or the admin
 * portal will offer an edit the sync then discards.
 *
 * The lock applies ONLY to properties with a `hostawayId`. A manually created
 * property has no upstream owner, so every field stays editable.
 */

export const HOSTAWAY_OWNED_FIELDS = [
  "address",
  "slug",
  "unitNumber",
  "communityId",
  "bedrooms",
  "bathrooms",
  "sleeps",
  "description",
  "amenityTags",
  "latitude",
  "longitude",
  "photoUrls",
  "nightlyRate",
  "cleaningFee",
  "weeklyDiscount",
  "monthlyDiscount",
  "maxNights",
  "minNights",
  "checkInTime",
  "checkOutTime",
  "bedsCount",
  "roomType",
  "contactPhone",
  "bookingUrl",
] as const;

export type HostawayOwnedField = (typeof HOSTAWAY_OWNED_FIELDS)[number];

const OWNED = new Set<string>(HOSTAWAY_OWNED_FIELDS);

export function isHostawayOwned(field: string): boolean {
  return OWNED.has(field);
}

/** True when this property's data comes from HostAway and should be locked. */
export function isHostawayLinked(property: { hostawayId?: number | null }): boolean {
  return property.hostawayId !== undefined && property.hostawayId !== null;
}

export const HOSTAWAY_LOCK_NOTE =
  "Imported from HostAway — edit it in HostAway, not here. The sync overwrites this field every 30 minutes.";

/**
 * Strip locked fields from an admin update, returning what was rejected so the
 * caller can fail loudly rather than no-op silently.
 */
export function stripHostawayOwned<T extends Record<string, unknown>>(
  fields: T,
  linked: boolean,
): { allowed: Partial<T>; rejected: string[] } {
  if (!linked) return { allowed: { ...fields }, rejected: [] };
  const allowed: Record<string, unknown> = {};
  const rejected: string[] = [];
  for (const [k, val] of Object.entries(fields)) {
    if (val === undefined) continue;
    if (isHostawayOwned(k)) rejected.push(k);
    else allowed[k] = val;
  }
  return { allowed: allowed as Partial<T>, rejected };
}
