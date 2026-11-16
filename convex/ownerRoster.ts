import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { rosterHolding, normalizedEmail, validEmail, uniqueHoldings, holdingSummary } from "./ownerRosterData";

const text = v.optional(v.string());
const profileInput = v.object({
  rosterKey: v.string(), displayName: v.string(),
  firstName: text, lastName: text, contactEmail: text, email: text,
  phone: text, homeAddress: text, homeCity: text, homeState: text,
  homePostalCode: text, homeCountry: text, importNotes: text,
  rosterHoldings: v.array(rosterHolding),
});
const contactFields = ["firstName", "lastName", "displayName", "contactEmail",
  "phone", "homeAddress", "homeCity", "homeState", "homePostalCode", "homeCountry"] as const;

/** Internal-only, no notifications, never reads or writes weeks/properties/bookings.
 * Each row supplies the COMPLETE holdings snapshot for its stable rosterKey.
 * sourceResort must name the actual resort; file provenance belongs in source.
 * Dry run validates the entire batch before returning; failures write nothing.
 */
export const importBatch = internalMutation({
  args: { source: v.string(), dryRun: v.boolean(), profiles: v.array(profileInput) },
  handler: async (ctx, { source, dryRun, profiles }) => {
    if (!source.trim() || profiles.length > 100) throw new Error("Supply source and at most 100 profiles");
    const existing = await ctx.db.query("userProfiles").collect();
    const seen = new Set<string>();
    const plans: { prior: any; data: any; action: string; rosterKey: string }[] = [];
    for (const input of profiles) {
      const key = input.rosterKey.trim();
      if (!key || (!input.displayName.trim() && !input.importNotes?.trim()) || seen.has(key))
        throw new Error("Missing identity or duplicate rosterKey in batch");
      seen.add(key);
      const matches = existing.filter(p => p.rosterKey === key);
      if (matches.length > 1) throw new Error("Ambiguous existing rosterKey");
      const prior = matches[0];
      if (prior && (prior.role !== "owner" || prior.userId || prior.rosterSource !== source))
        throw new Error("Protected profile: linked, non-owner, or different source");
      const email = normalizedEmail(input.email);
      if (input.email !== undefined && (!email || !validEmail(email)))
        throw new Error("Invalid sign-in email: omit it instead");
      if (prior?.email && prior.email !== email)
        throw new Error("Changing a roster sign-in email requires manual review");
      if (email && !input.displayName.trim()) throw new Error("Missing owner name: omit sign-in email until reviewed");
      if (email) {
        // Check the whole batch and existing profiles, never choose the first email match.
        const conflicts = existing.some(p => p._id !== prior?._id &&
          (normalizedEmail(p.email) === email || normalizedEmail(p.contactEmail) === email));
        const inBatch = profiles.some(p => p.rosterKey !== input.rosterKey &&
          (normalizedEmail(p.email) === email || normalizedEmail(p.contactEmail) === email));
        if (conflicts || inBatch) throw new Error("Ambiguous sign-in email: omit email and retain contactEmail");
        // A pre-existing password account must not gain access to imported PII.
        const accounts = await ctx.db.query("authAccounts")
          .withIndex("providerAndAccountId", q => q.eq("provider", "password").eq("providerAccountId", email)).collect();
        if (accounts.length) throw new Error("Email already has authentication credentials; manual review required");
      }
      const data: any = {
        rosterKey: key, rosterSource: source, role: "owner",
        rosterHoldings: uniqueHoldings(input.rosterHoldings),
      };
      if (email) data.email = email;
      if (input.importNotes?.trim()) data.importNotes = input.importNotes.trim();
      for (const field of contactFields) {
        const value = input[field]?.trim();
        if (value && !prior?.[field]) data[field] = field === "contactEmail" ? normalizedEmail(value) : value;
      }
      const changed = !prior || Object.entries(data).some(([k, value]) =>
        JSON.stringify((prior as any)[k]) !== JSON.stringify(value));
      plans.push({ prior, data, rosterKey: key, action: !prior ? "created" : changed ? "updated" : "unchanged" });
    }
    const result = { dryRun, created: 0, updated: 0, unchanged: 0, holdings: 0 };
    for (const plan of plans) {
      result[plan.action as "created" | "updated" | "unchanged"]++;
      result.holdings += plan.data.rosterHoldings.length;
      if (dryRun || plan.action === "unchanged") continue;
      plan.data.rosterImportedAt = Date.now();
      if (plan.prior) await ctx.db.patch(plan.prior._id, plan.data);
      else await ctx.db.insert("userProfiles", { ...plan.data, createdAt: Date.now() });
    }
    return result;
  },
});

/** Only the linked owner can read their roster; no profileId or email argument.
 * Non-portal resorts remain available to management only.
 */
export const myHoldings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await ctx.db.query("userProfiles")
      .withIndex("by_userId", q => q.eq("userId", userId)).unique();
    if (!profile || profile.role !== "owner") throw new Error("Owner access required");
    const sites = await ctx.db.query("sites").collect();
    const communities = new Set(sites.filter(s => s.ownerPortalEnabled).flatMap(s => s.communitySlugs ?? []));
    const holdings = (profile.rosterHoldings ?? []).filter(h => h.communitySlug && communities.has(h.communitySlug));
    return { holdings, ...holdingSummary(holdings) };
  },
});
