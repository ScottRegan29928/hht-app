import { v } from "convex/values";

// Roster records are evidence supplied by management, NOT booking inventory.
export const rosterHolding = v.object({
  // Actual display resort, e.g. "Night Heron"; NEVER the source filename.
  sourceResort: v.string(),
  communitySlug: v.optional(v.string()),
  unitNumber: v.string(),
  weekNumber: v.optional(v.number()),
  sourceUnitWeek: v.string(),
  ownerOfRecord: v.optional(v.string()),
  sourceRosterKey: v.optional(v.string()),
});

export type Holding = {
  sourceResort: string; communitySlug?: string; unitNumber: string;
  weekNumber?: number; sourceUnitWeek: string; ownerOfRecord?: string; sourceRosterKey?: string;
};

export const normalizedEmail = (value?: string) => value?.trim().toLowerCase() || undefined;
export const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function uniqueHoldings(holdings: Holding[]): Holding[] {
  const result = new Map<string, Holding>();
  for (const h of holdings) {
    if (!h.sourceResort.trim() || !h.unitNumber.trim() || !h.sourceUnitWeek.trim())
      throw new Error("Holdings require sourceResort, unitNumber and sourceUnitWeek");
    if (h.weekNumber !== undefined &&
        (!Number.isInteger(h.weekNumber) || h.weekNumber < 1 || h.weekNumber > 53))
      throw new Error("Invalid roster week number");
    const row = { ...h, sourceResort: h.sourceResort.trim(), unitNumber: h.unitNumber.trim(),
      sourceUnitWeek: h.sourceUnitWeek.trim() };
    const key = JSON.stringify([row.communitySlug ?? row.sourceResort, row.unitNumber,
      row.weekNumber ?? row.sourceUnitWeek, row.sourceRosterKey ?? row.ownerOfRecord ?? null]);
    result.set(key, row);
  }
  return [...result.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, h]) => h);
}

export function holdingSummary(holdings: Holding[] = []) {
  return {
    rosterWeekCount: holdings.length,
    rosterPropertyCount: new Set(holdings.map(h =>
      JSON.stringify([h.communitySlug ?? h.sourceResort, h.unitNumber]))).size,
    rosterResorts: [...new Set(holdings.map(h => h.sourceResort))].sort(),
  };
}

/** Contact email is deliberately NOT a sign-in identifier. Never resolve by it.
 * It does veto invitations when an address belongs to several owner identities.
 */
export async function assertUniqueOwnerLogin(ctx: any, profile: any) {
  if (profile?.rosterConsolidatedInto) throw new Error("Use the primary shared owner account");
  if (profile?.rosterKey && ![profile.displayName, profile.firstName, profile.lastName]
      .some(value => value?.trim())) throw new Error("Owner needs a reviewed owner name");
  const email = normalizedEmail(profile?.email);
  if (!email || !validEmail(email)) throw new Error("Owner needs a reviewed sign-in email");
  const profiles = await ctx.db.query("userProfiles").collect();
  const conflicts = profiles.filter((p: any) => p._id !== profile._id &&
    !(profile.rosterSharedAccount?.memberRosterKeys?.includes(p.rosterKey) &&
      p.rosterConsolidatedInto === profile._id) &&
    (normalizedEmail(p.email) === email || normalizedEmail(p.contactEmail) === email));
  if (conflicts.length) throw new Error("Ambiguous email: reconcile owner identities before inviting");
}

export type OwnerOfRecordGroup = {
  ownerOfRecord: string; sourceResort: string; communitySlug?: string;
  unitNumber: string; weeks: number[]; unresolvedWeeks: string[];
};

/** Keep legal/joint/trust labels tied to their exact unit AND weeks. */
export function ownerOfRecordGroups(holdings: Holding[] = []): OwnerOfRecordGroup[] {
  const groups = new Map<string, OwnerOfRecordGroup>();
  for (const h of holdings) {
    if (!h.ownerOfRecord) continue;
    const key = JSON.stringify([h.communitySlug ?? h.sourceResort, h.unitNumber, h.ownerOfRecord]);
    const group = groups.get(key) ?? { ownerOfRecord: h.ownerOfRecord,
      sourceResort: h.sourceResort, communitySlug: h.communitySlug,
      unitNumber: h.unitNumber, weeks: [], unresolvedWeeks: [] };
    if (h.weekNumber === undefined) group.unresolvedWeeks.push(h.sourceUnitWeek);
    else group.weeks.push(h.weekNumber);
    groups.set(key, group);
  }
  return [...groups.values()].map(g => ({ ...g,
    weeks: [...new Set(g.weeks)].sort((a,b) => a-b),
    unresolvedWeeks: [...new Set(g.unresolvedWeeks)].sort() }))
    .sort((a,b) => a.sourceResort.localeCompare(b.sourceResort) ||
      a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }) ||
      a.ownerOfRecord.localeCompare(b.ownerOfRecord));
}
