import { v } from "convex/values";
import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── Store: annual maintenance fees ──
//
// Scope is maintenance fees [scott, 2026-09-08]. The store is deliberately
// independent of any payment processor [scott, 2026-09-10]: staff can create
// fee items (including $0 ones), assign charges to owners, and record payment
// by check or phone today. Square slots in later as one more payment method
// and changes nothing else here.
//
// Two record types:
//   storeItems   — the catalog: what a fee is and what it costs.
//   storeCharges — one owner owing one amount, with a settlement status.

const ADMIN_ROLES = ["admin", "admin_user", "admin_rental", "admin_sales"];
const SUPER_ROLES = ["admin"];

async function requireAdminProfile(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"userProfiles">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not signed in");
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    throw new Error("Admin access required");
  }
  return profile;
}

async function requireOwnerProfile(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"userProfiles">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not signed in");
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  if (!profile || profile.role !== "owner") {
    throw new Error("Owner access required");
  }
  return profile;
}

function ownerName(p: Doc<"userProfiles"> | null): string {
  if (!p) return "Unknown owner";
  const full = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  return full || p.displayName || p.email || "Unknown owner";
}

// ─────────────────────────── admin: items ───────────────────────────

export const adminListItems = query({
  args: { siteSlug: v.optional(v.string()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdminProfile(ctx);
    const items = args.siteSlug
      ? await ctx.db
          .query("storeItems")
          .withIndex("by_site", (q) => q.eq("siteSlug", args.siteSlug!))
          .collect()
      : await ctx.db.query("storeItems").collect();

    return items
      .sort(
        (a, b) =>
          a.siteSlug.localeCompare(b.siteSlug) ||
          (b.feeYear ?? 0) - (a.feeYear ?? 0) ||
          (a.sortOrder ?? 999) - (b.sortOrder ?? 999) ||
          a.name.localeCompare(b.name)
      )
      .map((i) => ({ ...i, priceLabel: formatMoney(i.priceCents) }));
  },
});

export const saveItem = mutation({
  args: {
    itemId: v.optional(v.id("storeItems")),
    siteSlug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    priceCents: v.number(),
    feeYear: v.optional(v.number()),
    communityId: v.optional(v.id("communities")),
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
  },
  returns: v.object({ itemId: v.id("storeItems") }),
  handler: async (ctx, args) => {
    const profile = await requireAdminProfile(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("Give the fee a name");
    if (!Number.isFinite(args.priceCents) || args.priceCents < 0) {
      throw new Error("Price cannot be negative");
    }
    // Guard against a fat-fingered amount: 100x errors are the expensive kind.
    if (args.priceCents > 5_000_000) {
      throw new Error("That price looks wrong — over $50,000. Check the amount.");
    }

    const patch = {
      siteSlug: args.siteSlug,
      name,
      description: args.description?.trim() || undefined,
      priceCents: Math.round(args.priceCents),
      feeYear: args.feeYear,
      communityId: args.communityId,
      isActive: args.isActive,
      sortOrder: args.sortOrder,
      updatedAt: Date.now(),
      updatedByName: profile.displayName,
    };

    if (args.itemId) {
      await ctx.db.patch(args.itemId, patch);
      return { itemId: args.itemId };
    }
    const itemId = await ctx.db.insert("storeItems", {
      ...patch,
      createdAt: Date.now(),
    });
    return { itemId };
  },
});

export const deleteItem = mutation({
  args: { itemId: v.id("storeItems") },
  returns: v.object({ deleted: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdminProfile(ctx);
    // Charges snapshot their item name, so history survives — but refuse the
    // delete anyway if money is still outstanding against it.
    const open = await ctx.db
      .query("storeCharges")
      .filter((q) =>
        q.and(
          q.eq(q.field("itemId"), args.itemId),
          q.eq(q.field("status"), "due")
        )
      )
      .first();
    if (open) {
      throw new Error(
        "Owners still owe this fee. Settle or waive those charges first."
      );
    }
    await ctx.db.delete(args.itemId);
    return { deleted: true };
  },
});

// ─────────────────────────── admin: charges ───────────────────────────

export const adminListCharges = query({
  args: {
    siteSlug: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdminProfile(ctx);
    let charges = args.siteSlug
      ? await ctx.db
          .query("storeCharges")
          .withIndex("by_site", (q) => q.eq("siteSlug", args.siteSlug!))
          .collect()
      : await ctx.db.query("storeCharges").collect();

    if (args.status) charges = charges.filter((c) => c.status === args.status);

    const rows = await Promise.all(
      charges.map(async (c) => {
        const owner = await ctx.db.get(c.ownerProfileId);
        return {
          ...c,
          ownerName: ownerName(owner),
          ownerEmail: owner?.email,
          amountLabel: formatMoney(c.amountCents),
        };
      })
    );

    return rows.sort(
      (a, b) =>
        (b.feeYear ?? 0) - (a.feeYear ?? 0) ||
        a.ownerName.localeCompare(b.ownerName)
    );
  },
});

export const adminChargeSummary = query({
  args: { siteSlug: v.optional(v.string()) },
  returns: v.object({
    dueCount: v.number(),
    dueCents: v.number(),
    paidCount: v.number(),
    paidCents: v.number(),
    waivedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdminProfile(ctx);
    const charges = args.siteSlug
      ? await ctx.db
          .query("storeCharges")
          .withIndex("by_site", (q) => q.eq("siteSlug", args.siteSlug!))
          .collect()
      : await ctx.db.query("storeCharges").collect();

    const sum = (s: string) =>
      charges
        .filter((c) => c.status === s)
        .reduce((t, c) => t + c.amountCents, 0);

    return {
      dueCount: charges.filter((c) => c.status === "due").length,
      dueCents: sum("due"),
      paidCount: charges.filter((c) => c.status === "paid").length,
      paidCents: sum("paid"),
      waivedCount: charges.filter((c) => c.status === "waived").length,
    };
  },
});

/**
 * Bills a fee item to every owner holding a week in scope, skipping owners who
 * already have that fee for that week. Re-running it after new owners appear
 * tops up rather than duplicating.
 */
export const billItemToOwners = mutation({
  args: {
    itemId: v.id("storeItems"),
    dueDate: v.optional(v.string()),
  },
  returns: v.object({
    created: v.number(),
    skipped: v.number(),
    ownersBilled: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const profile = await requireAdminProfile(ctx);
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("That fee no longer exists");

    // Which communities does this site cover?
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", item.siteSlug))
      .first();
    const communities = await ctx.db.query("communities").collect();
    const siteCommunityIds = new Set(
      communities
        .filter((c) =>
          site?.communitySlugs?.length
            ? site.communitySlugs.includes(c.slug)
            : true
        )
        .map((c) => c._id)
    );

    const weeks = await ctx.db.query("weeks").collect();
    const existing = await ctx.db
      .query("storeCharges")
      .withIndex("by_site", (q) => q.eq("siteSlug", item.siteSlug))
      .collect();
    const alreadyBilled = new Set(
      existing
        .filter((c) => c.itemId === args.itemId)
        .map((c) => `${c.ownerProfileId}:${c.weekId ?? ""}`)
    );

    let created = 0;
    let skipped = 0;
    const ownersBilled = new Set<string>();

    for (const week of weeks) {
      const ownerId = (week as any).ownerId;
      if (!ownerId) continue; // company-held weeks carry no owner fee here

      const property = await ctx.db.get(week.propertyId);
      if (!property) continue;
      if (!siteCommunityIds.has(property.communityId as any)) continue;
      if (item.communityId && property.communityId !== item.communityId) continue;

      const key = `${ownerId}:${week._id}`;
      if (alreadyBilled.has(key)) {
        skipped++;
        continue;
      }

      // `ownerId` is a userProfiles id (weeks.ownerId); the generated union
      // type for ctx.db.get can't narrow it here.
      const owner = (await ctx.db.get(ownerId)) as Doc<"userProfiles"> | null;
      const label = `${(property as any).address ?? (property as any).name ?? "Unit"} — Week ${week.weekNumber}`;

      await ctx.db.insert("storeCharges", {
        siteSlug: item.siteSlug,
        itemId: item._id,
        itemName: item.name,
        ownerProfileId: ownerId,
        weekId: week._id,
        weekLabel: label,
        amountCents: item.priceCents,
        feeYear: item.feeYear,
        // A $0 fee is settled the moment it is issued; there is nothing to pay.
        status: item.priceCents === 0 ? "paid" : "due",
        paymentMethod: item.priceCents === 0 ? "free" : undefined,
        paidAt: item.priceCents === 0 ? Date.now() : undefined,
        dueDate: args.dueDate,
        createdAt: Date.now(),
        updatedByName: profile.displayName,
      });
      created++;
      ownersBilled.add(ownerName(owner));
    }

    return { created, skipped, ownersBilled: [...ownersBilled].sort() };
  },
});

export const setChargeStatus = mutation({
  args: {
    chargeId: v.id("storeCharges"),
    status: v.union(
      v.literal("due"),
      v.literal("paid"),
      v.literal("waived"),
      v.literal("refunded")
    ),
    paymentMethod: v.optional(
      v.union(
        v.literal("square"),
        v.literal("manual"),
        v.literal("external"),
        v.literal("free")
      )
    ),
    paymentRef: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const profile = await requireAdminProfile(ctx);
    const charge = await ctx.db.get(args.chargeId);
    if (!charge) throw new Error("That charge no longer exists");

    await ctx.db.patch(args.chargeId, {
      status: args.status,
      paymentMethod:
        args.status === "paid"
          ? (args.paymentMethod ?? "manual")
          : charge.paymentMethod,
      paymentRef: args.paymentRef?.trim() || charge.paymentRef,
      note: args.note?.trim() || charge.note,
      paidAt: args.status === "paid" ? (charge.paidAt ?? Date.now()) : undefined,
      updatedAt: Date.now(),
      updatedByName: profile.displayName,
    });
    return { ok: true };
  },
});

export const deleteCharge = mutation({
  args: { chargeId: v.id("storeCharges") },
  returns: v.object({ deleted: v.boolean() }),
  handler: async (ctx, args) => {
    const profile = await requireAdminProfile(ctx);
    if (!SUPER_ROLES.includes(profile.role)) {
      throw new Error("Only a super admin can delete a charge");
    }
    const charge = await ctx.db.get(args.chargeId);
    if (!charge) return { deleted: false };
    if (charge.status === "paid") {
      throw new Error(
        "A paid charge is a payment record — refund it instead of deleting it."
      );
    }
    await ctx.db.delete(args.chargeId);
    return { deleted: true };
  },
});

// ─────────────────────────── owner-facing ───────────────────────────

export const myCharges = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const profile = await requireOwnerProfile(ctx);
    const charges = await ctx.db
      .query("storeCharges")
      .withIndex("by_owner", (q) => q.eq("ownerProfileId", profile._id))
      .collect();

    return charges
      .map((c) => ({ ...c, amountLabel: formatMoney(c.amountCents) }))
      .sort(
        (a, b) =>
          (b.feeYear ?? 0) - (a.feeYear ?? 0) ||
          (a.weekLabel ?? "").localeCompare(b.weekLabel ?? "")
      );
  },
});

export const myChargeTotals = query({
  args: {},
  returns: v.object({
    dueCents: v.number(),
    dueCount: v.number(),
    dueLabel: v.string(),
  }),
  handler: async (ctx) => {
    const profile = await requireOwnerProfile(ctx);
    const charges = await ctx.db
      .query("storeCharges")
      .withIndex("by_owner", (q) => q.eq("ownerProfileId", profile._id))
      .collect();
    const due = charges.filter((c) => c.status === "due");
    const dueCents = due.reduce((t, c) => t + c.amountCents, 0);
    return {
      dueCents,
      dueCount: due.length,
      dueLabel: formatMoney(dueCents),
    };
  },
});

// ─────────────────────────── helpers ───────────────────────────

function formatMoney(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
