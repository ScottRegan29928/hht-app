import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { normalizedEmail, validEmail, rosterHolding, uniqueHoldings } from "./ownerRosterData";
import type { Doc } from "./_generated/dataModel";
import type { Holding } from "./ownerRosterData";

const holdingSnapshot = (holdings: Holding[]) => uniqueHoldings(holdings).map(h => [
  h.sourceResort, h.communitySlug ?? null, h.unitNumber, h.weekNumber ?? null,
  h.sourceUnitWeek, h.ownerOfRecord ?? null, h.sourceRosterKey ?? null,
]);

const member = v.object({
  rosterKey: v.string(),
  expectedName: v.string(),
  expectedHoldings: v.array(rosterHolding),
});

/** Explicit management-approved account grouping, never automatic email matching.
 * First member is the account holder. All original source profiles and holdings
 * remain archived in place; only the primary gets the combined active snapshot.
 * No credentials, invitations, inventory, rentals, or notifications are changed.
 */
export const consolidate = internalMutation({
  args: {
    batchId: v.string(),
    source: v.string(),
    dryRun: v.boolean(),
    groups: v.array(v.object({
      email: v.string(),
      primaryRosterKey: v.string(),
      members: v.array(member),
    })),
  },
  handler: async (ctx, { batchId, source, dryRun, groups }) => {
    if (!batchId.trim() || !source.trim() || !groups.length || groups.length > 100)
      throw new Error("Supply batch, source, and 1-100 approved groups");
    const profiles = await ctx.db.query("userProfiles").collect();
    const accounts = await ctx.db.query("authAccounts").collect();
    const users = await ctx.db.query("users").collect();
    // Refuse dependent source identities rather than silently reassigning their work.
    const dependencies = [
      ...(await ctx.db.query("weeks").collect()).map(x => x.ownerId),
      ...(await ctx.db.query("properties").collect()).map(x => x.ownerId),
      ...(await ctx.db.query("ownerInvites").collect()).map(x => x.profileId),
      ...(await ctx.db.query("marketplaceListings").collect()).map(x => x.ownerId),
      ...(await ctx.db.query("marketplaceMatches").collect()).map(x => x.ownerId),
      ...(await ctx.db.query("saleRequests").collect()).map(x => x.ownerId),
    ].filter(Boolean).map(String);
    const seenKeys = new Set<string>();
    const seenEmails = new Set<string>();
    const plans = [];
    for (const group of groups) {
      const email = normalizedEmail(group.email);
      if (!email || !validEmail(email) || seenEmails.has(email))
        throw new Error("Invalid or repeated approved email");
      seenEmails.add(email);
      if (group.members.length < 2 || group.members[0].rosterKey !== group.primaryRosterKey)
        throw new Error("The first approved member must be the primary owner");
      const members: Doc<"userProfiles">[] = [];
      for (const input of group.members) {
        if (seenKeys.has(input.rosterKey)) throw new Error("Repeated approved roster identity");
        seenKeys.add(input.rosterKey);
        const matches = profiles.filter(p => p.rosterKey === input.rosterKey);
        if (matches.length !== 1) throw new Error("Missing or ambiguous approved roster identity");
        const p = matches[0];
        if (p.role !== "owner" || p.rosterSource !== source || p.userId)
          throw new Error("Protected source profile: role, source, or linked account");
        if (normalizedEmail(p.contactEmail || p.email) !== email ||
            (p.email && normalizedEmail(p.email) !== email))
          throw new Error("Approved email no longer matches source profile");
        const name = p.displayName || [p.firstName, p.lastName].filter(Boolean).join(" ");
        if (!name || name !== input.expectedName) throw new Error("Approved owner name changed");
        if (dependencies.includes(String(p._id)))
          throw new Error("Source profile has dependencies; manual migration required");
        members.push(p);
      }
      const primary = members[0];
      const memberIds = new Set(members.map(p => String(p._id)));
      if (profiles.some(p => !memberIds.has(String(p._id)) &&
          (normalizedEmail(p.email) === email || normalizedEmail(p.contactEmail) === email)))
        throw new Error("Email has an owner outside the approved group");
      if (accounts.some(a => normalizedEmail(a.providerAccountId) === email) ||
          users.some(u => normalizedEmail(u.email) === email))
        throw new Error("Existing authentication identity requires manual migration");
      const holdings = uniqueHoldings(group.members.flatMap(input =>
        input.expectedHoldings.map(h => ({
          ...h, ownerOfRecord: input.expectedName, sourceRosterKey: input.rosterKey,
        }))));
      const prior = primary.rosterSharedAccount;
      const alreadyApplied = !!prior;
      if (prior && (prior.batchId !== batchId ||
          JSON.stringify(prior.memberRosterKeys) !== JSON.stringify(group.members.map(m => m.rosterKey))))
        throw new Error("Primary already belongs to a different shared account");
      for (let i = 0; i < members.length; i++) {
        const p = members[i];
        const expected = i === 0 && alreadyApplied ? holdings : uniqueHoldings(group.members[i].expectedHoldings);
        if (JSON.stringify(holdingSnapshot(p.rosterHoldings ?? [])) !== JSON.stringify(holdingSnapshot(expected)))
          throw new Error("Source holdings changed since approval");
        if (i === 0) {
          if (p.rosterConsolidatedInto) throw new Error("Primary is an archived source profile");
          if (alreadyApplied && normalizedEmail(p.email) !== email)
            throw new Error("Primary sign-in email changed after consolidation");
        } else if (p.rosterSharedAccount ||
            (alreadyApplied ? p.rosterConsolidatedInto !== primary._id : !!p.rosterConsolidatedInto)) {
          throw new Error("Secondary already belongs to another or incomplete shared account");
        }
      }
      plans.push({ group, members, primary, email, holdings, alreadyApplied });
    }
    const result = { dryRun, groups: plans.length, consolidated: 0, unchanged: 0,
      archivedProfiles: 0, activeHoldingRows: 0 };
    // All groups validated before the first write. Convex additionally makes this atomic.
    for (const plan of plans) {
      result.activeHoldingRows += plan.holdings.length;
      if (plan.alreadyApplied) { result.unchanged++; continue; }
      result.consolidated++;
      result.archivedProfiles += plan.members.length - 1;
      if (dryRun) continue;
      await ctx.db.patch(plan.primary._id, {
        email: plan.email,
        rosterHoldings: plan.holdings,
        rosterSharedAccount: {
          batchId, consolidatedAt: Date.now(),
          memberRosterKeys: plan.group.members.map(p => p.rosterKey),
          ownerNames: plan.group.members.map(p => p.expectedName),
        },
      });
      for (const secondary of plan.members.slice(1)) {
        await ctx.db.patch(secondary._id, {
          rosterConsolidatedInto: plan.primary._id, email: undefined,
        });
      }
    }
    return result;
  },
});
