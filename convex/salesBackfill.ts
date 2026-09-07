import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Backfill sale prices onto Spicebush / Swallowtail week records from the HOA
 * resale PDFs.
 *
 * Context: every Spicebush and Swallowtail unit listed for rent on HostAway is
 * also sale inventory (confirmed by the client 2026-09-07), sold in one-week
 * Friday-to-Friday increments. The HOA resale PDFs price only a subset of those
 * weeks, so unpriced weeks are set to 0 meaning "price not published" -- NOT
 * "free". Any UI must render 0 as a call-for-price state.
 *
 * Runs one property at a time to stay well inside Convex per-mutation limits.
 */
export const backfillUnitSalePrices = internalMutation({
  args: {
    communityName: v.string(),
    unitNumber: v.string(),
    year: v.number(),
    // [{ week, price }] from the resale PDF for this unit
    prices: v.array(v.object({ week: v.number(), price: v.number() })),
    dryRun: v.boolean(),
  },
  handler: async (ctx, { communityName, unitNumber, year, prices, dryRun }) => {
    const communities = await ctx.db.query("communities").collect();
    const community = communities.find((c) => c.name === communityName);
    if (!community) throw new Error(`Community not found: ${communityName}`);

    const props = await ctx.db
      .query("properties")
      .filter((q) => q.eq(q.field("communityId"), community._id))
      .collect();

    const matches = props.filter((p) => p.unitNumber === unitNumber);
    if (matches.length === 0) {
      return { unitNumber, status: "no_property", priced: 0, zeroed: 0 };
    }

    // Units 571 and 2901 are duplicated: the HostAway-synced record carries the
    // rental identity while an older orphan record carries the 52 week rows.
    // Write where the week rows actually are, preferring the synced record only
    // as a tie-break.
    const withWeeks = await Promise.all(
      matches.map(async (p) => {
        const ws = await ctx.db
          .query("weeks")
          .filter((q) => q.eq(q.field("propertyId"), p._id))
          .collect();
        return { prop: p, weeks: ws.filter((w) => w.year === year) };
      })
    );
    withWeeks.sort((a, b) =>
      b.weeks.length - a.weeks.length ||
      (b.prop.hostawayId != null ? 1 : 0) - (a.prop.hostawayId != null ? 1 : 0)
    );
    const property = withWeeks[0].prop;
    const target = withWeeks[0].weeks;

    const priceByWeek = new Map(prices.map((p) => [p.week, p.price]));

    let priced = 0;
    let zeroed = 0;
    let unmatchedPdfWeeks: number[] = [];

    for (const w of target) {
      const pdfPrice = priceByWeek.get(w.weekNumber);
      const price = pdfPrice ?? 0;
      if (pdfPrice != null) priced++;
      else zeroed++;
      if (!dryRun) {
        await ctx.db.patch(w._id, {
          price,
          listingType: "both",
          updatedAt: Date.now(),
        });
      }
    }

    const weekNumbers = new Set(target.map((w) => w.weekNumber));
    unmatchedPdfWeeks = prices
      .map((p) => p.week)
      .filter((wk) => !weekNumbers.has(wk));

    return {
      unitNumber,
      propertyId: property._id,
      duplicatesSkipped: matches.length - 1,
      usedUnsyncedRecord: property.hostawayId == null,
      weekRecords: target.length,
      priced,
      zeroed,
      unmatchedPdfWeeks,
      status: "ok",
    };
  },
});
