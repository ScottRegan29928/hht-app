import type { Holding } from "./ownerRosterData";

/** Admin-directory projection only; roster evidence never creates inventory links. */
export type OwnershipGroup = {
  propertyName: string;
  propertyAddress?: string;
  communityName: string;
  communitySlug?: string;
  unitNumber: string;
  weeks: number[];
  unresolvedWeeks: string[];
};
type Property = { _id: string; address: string; unitNumber: string; communityId: string };
type Community = { _id: string; name: string; slug: string };
type OwnedWeek = { propertyId: string; weekNumber: number };

export function groupedOwnership(
  holdings: Holding[] = [], ownedWeeks: OwnedWeek[] = [],
  properties: Property[] = [], communities: Community[] = [],
): OwnershipGroup[] {
  const groups = new Map<string, OwnershipGroup>();
  const add = (group: OwnershipGroup, missingPropertyId?: string) => {
    const key = JSON.stringify([missingPropertyId ?? (group.communitySlug || group.communityName).toLowerCase(), group.unitNumber.toLowerCase()]);
    const previous = groups.get(key);
    if (!previous) { groups.set(key, group); return; }
    previous.weeks = [...new Set([...previous.weeks, ...group.weeks])];
    previous.unresolvedWeeks = [...new Set([...previous.unresolvedWeeks, ...group.unresolvedWeeks])];
    if (group.propertyAddress) {
      previous.propertyAddress = group.propertyAddress;
      previous.propertyName = group.propertyName;
    }
  };
  for (const h of holdings) add({
    propertyName: h.sourceResort, communityName: h.sourceResort,
    communitySlug: h.communitySlug, unitNumber: h.unitNumber,
    weeks: h.weekNumber === undefined ? [] : [h.weekNumber],
    unresolvedWeeks: h.weekNumber === undefined ? [h.sourceUnitWeek] : [],
  });
  for (const week of ownedWeeks) {
    const property = properties.find(p => String(p._id) === String(week.propertyId));
    const community = communities.find(c => String(c._id) === String(property?.communityId));
    // Only directly assigned legacy weeks resolve a property. Never guess a roster unit from inventory.
    add({ propertyName: property?.address || community?.name || "Property unavailable",
      propertyAddress: property?.address, communityName: community?.name || "Resort unavailable",
      communitySlug: community?.slug, unitNumber: property?.unitNumber || "Not supplied",
      weeks: [week.weekNumber], unresolvedWeeks: [],
    }, property ? undefined : String(week.propertyId));
  }
  return [...groups.values()].map(g => ({ ...g, weeks: g.weeks.sort((a, b) => a - b),
    unresolvedWeeks: g.unresolvedWeeks.sort() }))
    .sort((a, b) => a.communityName.localeCompare(b.communityName) ||
      a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }));
}

const tokens = (value: string) => value.toLowerCase().match(/[\p{L}]+|\d+/gu) ?? [];
const matchesToken = (values: string[], term: string) => values.some(value =>
  /^\d+$/.test(term) ? value === term : value.includes(term));

/** Every ownership term must match ONE property/unit group. Numbers are exact tokens. */
export function matchesOwnerSearch(owner: {
  fullName: string; email?: string; contactEmail?: string; phone?: string;
  ownershipGroups?: OwnershipGroup[];
}, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const parts = tokens(term);
  const contacts = [owner.fullName, owner.email, owner.contactEmail, owner.phone].filter(Boolean) as string[];
  // Keep the existing name/email/phone substring search intact.
  if (!/\b(?:weeks?|units?)\s*\d/i.test(term) && contacts.some(value => value.toLowerCase().includes(term))) return true;
  if (!parts.length) return false;
  const contactTokens = contacts.flatMap(tokens);
  return (owner.ownershipGroups ?? []).some(group => {
    const propertyTokens = tokens([group.propertyName, group.propertyAddress, group.communityName,
      group.communitySlug, group.unitNumber, ...group.weeks, ...group.unresolvedWeeks].join(" "));
    // Source-style resort initials (e.g. Night Heron -> NH69-13) are
    // resolved from the actual resort label, never a hard-coded resort map.
    let invalidPair = false;
    const scopedTerm = term.replace(/\b([a-z]+)(\d+)-(\d+)\b/g, (pair, prefix: string, unit: string, week: string) => {
      const initials = tokens(group.communityName).filter(t => !/^\d+$/.test(t)).map(t => t[0]).join("");
      const unitPrefix = group.unitNumber.toLowerCase().match(/^[a-z]+/)?.[0];
      if ((prefix !== unitPrefix && !(prefix.length >= 2 && initials.startsWith(prefix))) ||
          !tokens(group.unitNumber).includes(unit) || !group.weeks.map(String).includes(week)) {
        invalidPair = true;
        return pair;
      }
      return `unit ${unit} week ${week}`;
    }).replace(/\b(\d+)-(\d+)\b/g, (_pair, unit: string, week: string) => {
      if (!tokens(group.unitNumber).includes(unit) || !group.weeks.map(String).includes(week)) invalidPair = true;
      return `unit ${unit} week ${week}`;
    });
    if (invalidPair) return false;
    const scopedParts = tokens(scopedTerm);
    for (let i = 0; i < scopedParts.length; i++) {
      const part = scopedParts[i];
      if (/^(week|weeks|unit|units)$/.test(part) && /^\d+$/.test(scopedParts[i + 1] ?? "")) {
        const number = scopedParts[++i];
        const values = part.startsWith("week") ? group.weeks.map(String) : tokens(group.unitNumber);
        if (!values.includes(number)) return false;
      } else if (!matchesToken(propertyTokens, part) &&
          (/^\d+$/.test(part) || !matchesToken(contactTokens, part))) return false;
    }
    return true;
  });
}
