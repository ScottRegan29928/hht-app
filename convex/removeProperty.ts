import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Permanently remove a property and every row that references it.
 *
 * Written for `45 Night Heron` (hostawayId 392447), which existed in our
 * database but not in HostAway — it presented as bookable and permanently
 * available with no calendar behind it. Scott approved removal 2026-09-07.
 *
 * Refuses to run if the property has any real booking or sale activity, so it
 * can't quietly destroy revenue records. Always dry-run first: the report lists
 * exactly what would be deleted.
 */
export const removeProperty = internalMutation({
  args: {
    propertyId: v.string(),
    expectedSlug: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const propertyId = args.propertyId as Id<"properties">;

    const property = await ctx.db.get(propertyId);
    if (!property) throw new Error(`property ${args.propertyId} not found`);

    // Safety: caller must name the slug it thinks it's deleting.
    const p = property as any;
    if (p.slug !== args.expectedSlug) {
      throw new Error(
        `slug mismatch: record is "${p.slug}", caller expected "${args.expectedSlug}"`,
      );
    }

    const byProperty = async (table: string) =>
      await ctx.db
        .query(table as any)
        .withIndex("by_property", (q: any) => q.eq("propertyId", propertyId))
        .collect();

    const weeks = await byProperty("weeks");
    const calendarBookings = await byProperty("calendarBookings");
    const inquiries = await byProperty("inquiries");
    const photos = await byProperty("propertyPhotos");
    const saleRequests = await byProperty("saleRequests");
    const bookings = await byProperty("bookings");

    // Safety: never delete a property that carries real activity.
    if (bookings.length > 0) {
      throw new Error(
        `refusing to delete: ${bookings.length} booking(s) reference this property`,
      );
    }
    const soldWeeks = weeks.filter((w: any) => w.status === "sold");
    if (soldWeeks.length > 0) {
      throw new Error(
        `refusing to delete: ${soldWeeks.length} week(s) are marked sold`,
      );
    }
    const ownedWeeks = weeks.filter((w: any) => w.ownerId);
    if (ownedWeeks.length > 0) {
      throw new Error(
        `refusing to delete: ${ownedWeeks.length} week(s) have an ownerId`,
      );
    }

    const report = {
      dryRun,
      property: {
        id: args.propertyId,
        address: p.address,
        slug: p.slug,
        hostawayId: p.hostawayId,
        unitNumber: p.unitNumber,
      },
      deleted: {
        weeks: weeks.length,
        calendarBookings: calendarBookings.length,
        inquiries: inquiries.length,
        propertyPhotos: photos.length,
        saleRequests: saleRequests.length,
        bookings: bookings.length,
      },
      // Full row payload so a dry run doubles as the backup.
      backup: dryRun
        ? { property: p, weeks, calendarBookings, inquiries, photos, saleRequests }
        : undefined,
    };

    if (dryRun) return report;

    for (const rows of [weeks, calendarBookings, inquiries, photos, saleRequests]) {
      for (const row of rows as any[]) {
        await ctx.db.delete(row._id);
      }
    }
    await ctx.db.delete(propertyId);

    return report;
  },
});
