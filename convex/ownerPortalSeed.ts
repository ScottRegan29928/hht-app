import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * One-time seeding of the owner portal from the legacy WordPress portals.
 *
 * The documents are MIRRORED into Convex storage rather than hotlinked: the
 * WordPress sites go away at cutover and 84 owner PDFs going 404 would be a
 * silent failure nobody notices until an owner complains.
 *
 * Idempotent on (siteSlug, category, title): re-running tops up rather than
 * duplicating, so a failed batch can simply be re-run.
 */

type SeedDoc = {
  category: "association" | "newsletter" | "minutes" | "stay" | "form";
  title: string;
  sourceUrl: string;
  documentDate?: number;
};

export const upsertMirrored = internalMutation({
  args: {
    siteSlug: v.string(),
    category: v.union(
      v.literal("association"),
      v.literal("newsletter"),
      v.literal("minutes"),
      v.literal("stay"),
      v.literal("form")
    ),
    title: v.string(),
    storageId: v.optional(v.id("_storage")),
    externalUrl: v.optional(v.string()),
    legacySourceUrl: v.string(),
    documentDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ownerDocuments")
      .withIndex("by_site_category", (q) =>
        q.eq("siteSlug", args.siteSlug).eq("category", args.category)
      )
      .collect();
    const match = existing.find((d) => d.title === args.title);

    if (match) {
      // Replacing a mirror: drop the old blob so storage doesn't accumulate.
      if (args.storageId && match.storageId && match.storageId !== args.storageId) {
        await ctx.storage.delete(match.storageId);
      }
      await ctx.db.patch(match._id, {
        storageId: args.storageId ?? match.storageId,
        externalUrl: args.externalUrl ?? match.externalUrl,
        documentDate: args.documentDate ?? match.documentDate,
        legacySourceUrl: args.legacySourceUrl,
        updatedAt: Date.now(),
      });
      return { action: "updated" as const, id: match._id };
    }

    const id = await ctx.db.insert("ownerDocuments", {
      siteSlug: args.siteSlug,
      category: args.category,
      title: args.title,
      storageId: args.storageId,
      externalUrl: args.externalUrl,
      documentDate: args.documentDate,
      published: true,
      legacySourceUrl: args.legacySourceUrl,
      createdAt: Date.now(),
    });
    return { action: "created" as const, id };
  },
});

/** Fetch each legacy PDF and store it in Convex storage. */
export const mirrorDocuments = internalAction({
  args: {
    siteSlug: v.string(),
    docs: v.array(
      v.object({
        category: v.union(
          v.literal("association"),
          v.literal("newsletter"),
          v.literal("minutes"),
          v.literal("stay"),
          v.literal("form")
        ),
        title: v.string(),
        sourceUrl: v.string(),
        documentDate: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, { siteSlug, docs }) => {
    const results = { mirrored: 0, linkedOnly: 0, failed: [] as string[] };

    for (const doc of docs as SeedDoc[]) {
      let storageId: string | undefined;
      try {
        const resp = await fetch(doc.sourceUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        if (blob.size < 1000) throw new Error(`suspiciously small (${blob.size}b)`);
        storageId = await ctx.storage.store(blob);
        results.mirrored++;
      } catch (err) {
        // Keep the legacy link so the document is still reachable, and report
        // it rather than pretending the mirror succeeded.
        results.failed.push(`${doc.title}: ${String(err).slice(0, 80)}`);
        results.linkedOnly++;
      }

      await ctx.runMutation(internal.ownerPortalSeed.upsertMirrored, {
        siteSlug,
        category: doc.category,
        title: doc.title,
        storageId: storageId as any,
        externalUrl: storageId ? undefined : doc.sourceUrl,
        legacySourceUrl: doc.sourceUrl,
        documentDate: doc.documentDate,
      });
    }

    return results;
  },
});

export const seedBoard = internalMutation({
  args: {
    siteSlug: v.string(),
    members: v.array(
      v.object({
        name: v.string(),
        title: v.optional(v.string()),
        holdings: v.optional(v.string()),
        termStart: v.optional(v.number()),
        termEnd: v.optional(v.number()),
        termNote: v.optional(v.string()),
        email: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { siteSlug, members }) => {
    const existing = await ctx.db
      .query("boardMembers")
      .withIndex("by_site", (q) => q.eq("siteSlug", siteSlug))
      .collect();
    let created = 0;
    let updated = 0;
    for (const [i, m] of members.entries()) {
      const match = existing.find((e) => e.name === m.name);
      if (match) {
        await ctx.db.patch(match._id, { ...m, sortOrder: i, updatedAt: Date.now() });
        updated++;
      } else {
        await ctx.db.insert("boardMembers", {
          siteSlug,
          ...m,
          sortOrder: i,
          published: true,
          createdAt: Date.now(),
        });
        created++;
      }
    }
    return { created, updated };
  },
});

export const seedSettings = internalMutation({
  args: { siteSlug: v.string(), settings: v.any() },
  handler: async (ctx, { siteSlug, settings }) => {
    const existing = await ctx.db
      .query("ownerPortalSettings")
      .withIndex("by_site", (q) => q.eq("siteSlug", siteSlug))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...settings, updatedAt: Date.now() });
      return "updated";
    }
    await ctx.db.insert("ownerPortalSettings", {
      siteSlug,
      ...settings,
      createdAt: Date.now(),
    });
    return "created";
  },
});
