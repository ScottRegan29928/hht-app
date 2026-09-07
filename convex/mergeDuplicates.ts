import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Merge a duplicate property record into the canonical one.
 *
 * Background: units 571 and 2901 each exist twice — an older record created by
 * the original import (holds the 52 week rows, no hostawayId) and the record
 * created by the HostAway sync (holds photos, amenities, calendar bookings).
 * We keep the synced record and move everything else onto it.
 *
 * Carries across any field the keeper is missing, repoints every referencing
 * row, then deletes the drop record. Refuses to run if the two records disagree
 * on unitNumber/community, or if moving weeks would collide.
 */
export const mergeProperty = internalMutation({
  args: {
    keepId: v.string(),
    dropId: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const keepId = args.keepId as Id<"properties">;
    const dropId = args.dropId as Id<"properties">;

    const keep = await ctx.db.get(keepId);
    const drop = await ctx.db.get(dropId);
    if (!keep) throw new Error(`keep record ${args.keepId} not found`);
    if (!drop) throw new Error(`drop record ${args.dropId} not found`);
    if (keepId === dropId) throw new Error("keepId and dropId are the same");

    // Safety: never merge two records that aren't actually the same unit.
    const k = keep as any;
    const d = drop as any;
    if (k.unitNumber !== d.unitNumber) {
      throw new Error(`unitNumber mismatch: ${k.unitNumber} vs ${d.unitNumber}`);
    }
    if (k.communityId !== d.communityId) {
      throw new Error("communityId mismatch — refusing to merge");
    }

    const report: Record<string, unknown> = {
      unitNumber: k.unitNumber,
      keep: { id: args.keepId, address: k.address, slug: k.slug, hostawayId: k.hostawayId },
      drop: { id: args.dropId, address: d.address, slug: d.slug, hostawayId: d.hostawayId },
      dryRun,
    };

    // 1. Move week rows, refusing on any (weekNumber, year) collision.
    const keepWeeks = await ctx.db
      .query("weeks")
      .filter((q) => q.eq(q.field("propertyId"), keepId))
      .collect();
    const dropWeeks = await ctx.db
      .query("weeks")
      .filter((q) => q.eq(q.field("propertyId"), dropId))
      .collect();

    const taken = new Set(keepWeeks.map((w: any) => `${w.year}-${w.weekNumber}`));
    const collisions = dropWeeks
      .filter((w: any) => taken.has(`${w.year}-${w.weekNumber}`))
      .map((w: any) => `${w.year} wk${w.weekNumber}`);
    if (collisions.length > 0) {
      throw new Error(
        `${collisions.length} week collision(s), refusing to merge: ${collisions.slice(0, 5).join(", ")}`,
      );
    }
    report.weeksOnKeeperBefore = keepWeeks.length;
    report.weeksMoved = dropWeeks.length;
    if (!dryRun) {
      for (const w of dropWeeks) {
        await ctx.db.patch(w._id, { propertyId: keepId, updatedAt: Date.now() });
      }
    }

    // 2. Repoint every other table that references the drop record.
    const refTables = [
      "calendarBookings",
      "bookings",
      "inquiries",
      "saleRequests",
      "propertyPhotos",
    ] as const;
    const moved: Record<string, number> = {};
    for (const table of refTables) {
      let rows: any[] = [];
      try {
        rows = await ctx.db
          .query(table as any)
          .filter((q) => q.eq(q.field("propertyId"), dropId))
          .collect();
      } catch {
        continue; // table has no propertyId field
      }
      moved[table] = rows.length;
      if (!dryRun) {
        for (const r of rows) {
          await ctx.db.patch(r._id, { propertyId: keepId } as any);
        }
      }
    }
    report.referencesMoved = moved;

    // 3. Carry across any field the keeper doesn't have, so nothing is lost.
    const skip = new Set(["_id", "_creationTime", "slug", "createdAt", "updatedAt"]);
    const carried: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(d)) {
      if (skip.has(field)) continue;
      if (value === undefined || value === null) continue;
      if (k[field] === undefined || k[field] === null) {
        carried[field] = value;
      }
    }
    report.fieldsCarriedOver = carried;
    if (!dryRun && Object.keys(carried).length > 0) {
      await ctx.db.patch(keepId, { ...carried, updatedAt: Date.now() } as any);
    }

    // 4. Drop the duplicate.
    if (!dryRun) await ctx.db.delete(dropId);
    report.deleted = !dryRun;

    return report;
  },
});
