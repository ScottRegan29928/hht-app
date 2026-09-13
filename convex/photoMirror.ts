import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Mirror property photos out of HostAway's S3 bucket into Convex storage.
 *
 * Every property photo on the four sites was hotlinked from
 * `hostaway-platform.s3.us-west-2.amazonaws.com`. The URLs resolve fine from a
 * server, but a third-party S3 bucket is exactly the kind of host that ad
 * blockers, privacy extensions and corporate DNS filters drop — which is what
 * produced Scott's blank photo on My Weeks while the same image loaded for
 * everyone else [scott, 2026-09-13]. Serving from Convex storage puts the
 * images on the same origin the app already needs, so they cannot be blocked
 * independently of the site itself.
 *
 * Mirrors the primary photo per property by default (one round of 82 images);
 * pass a higher `perProperty` to pull gallery images too.
 */

const isMirrorable = (url: string) => url.startsWith("http");

export const listToMirror = internalQuery({
  args: { perProperty: v.number(), limit: v.number() },
  handler: async (ctx, { perProperty, limit }) => {
    const properties = await ctx.db.query("properties").collect();
    const out: Array<{
      propertyId: string;
      address: string;
      urls: string[];
      alreadyStored: number;
    }> = [];

    for (const p of properties) {
      const existing = await ctx.db
        .query("propertyPhotos")
        .withIndex("by_property", (q: any) => q.eq("propertyId", p._id))
        .collect();
      const storedUrls = new Set(
        existing.map((e: any) => e.legacyUrl).filter(Boolean),
      );
      const stored = existing.filter((e: any) => e.storageId).length;

      const candidates = (p.photoUrls ?? [])
        .filter(isMirrorable)
        .filter((u: string) => !storedUrls.has(u))
        .slice(0, Math.max(0, perProperty - stored));

      if (candidates.length > 0) {
        out.push({
          propertyId: p._id,
          address: p.address,
          urls: candidates,
          alreadyStored: stored,
        });
      }
      if (out.length >= limit) break;
    }
    return out;
  },
});

export const recordPhoto = internalMutation({
  args: {
    propertyId: v.id("properties"),
    storageId: v.id("_storage"),
    legacyUrl: v.string(),
    sortOrder: v.number(),
    isPrimary: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Re-check inside the mutation: two overlapping runs would otherwise both
    // pass the query-time check and store the same image twice.
    const existing = await ctx.db
      .query("propertyPhotos")
      .withIndex("by_property", (q: any) => q.eq("propertyId", args.propertyId))
      .collect();
    if (existing.some((e: any) => e.legacyUrl === args.legacyUrl)) {
      await ctx.storage.delete(args.storageId);
      return { inserted: false };
    }
    await ctx.db.insert("propertyPhotos", {
      propertyId: args.propertyId,
      storageId: args.storageId,
      legacyUrl: args.legacyUrl,
      sortOrder: args.sortOrder,
      isPrimary: args.isPrimary && existing.length === 0,
    });
    return { inserted: true };
  },
});

export const mirrorPhotos = internalAction({
  args: {
    perProperty: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { perProperty = 1, limit = 25 }) => {
    const batch: any[] = await ctx.runQuery(internal.photoMirror.listToMirror, {
      perProperty,
      limit,
    });

    let mirrored = 0;
    const failures: string[] = [];

    for (const prop of batch) {
      for (let i = 0; i < prop.urls.length; i++) {
        const url = prop.urls[i];
        try {
          const res = await fetch(url);
          if (!res.ok) {
            failures.push(`${prop.address}: HTTP ${res.status}`);
            continue;
          }
          const blob = await res.blob();
          // A blocked or error response can still be 200 with an HTML body;
          // storing that would swap a broken photo for a broken photo.
          if (!blob.type.startsWith("image/")) {
            failures.push(`${prop.address}: not an image (${blob.type})`);
            continue;
          }
          const storageId = await ctx.storage.store(blob);
          const result: any = await ctx.runMutation(
            internal.photoMirror.recordPhoto,
            {
              propertyId: prop.propertyId,
              storageId,
              legacyUrl: url,
              sortOrder: prop.alreadyStored + i,
              isPrimary: prop.alreadyStored === 0 && i === 0,
            },
          );
          if (result.inserted) mirrored++;
        } catch (err: any) {
          failures.push(`${prop.address}: ${String(err).slice(0, 80)}`);
        }
      }
    }

    return {
      propertiesTouched: batch.length,
      mirrored,
      failures: failures.slice(0, 10),
      failureCount: failures.length,
    };
  },
});

export const mirrorStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const properties = await ctx.db.query("properties").collect();
    const photos = await ctx.db.query("propertyPhotos").collect();
    const withStored = new Set(
      photos
        .filter((p: any) => p.storageId)
        .map((p: any) => String(p.propertyId)),
    );
    return {
      properties: properties.length,
      propertiesWithStoredPhoto: withStored.size,
      storedPhotos: photos.filter((p: any) => p.storageId).length,
      missing: properties
        .filter((p) => !withStored.has(String(p._id)))
        .map((p) => p.address)
        .slice(0, 10),
    };
  },
});

/**
 * Set a property's hero photo to a specific source URL, mirroring it locally.
 *
 * Hero photos are chosen by review, not by algorithm: two rounds of pixel
 * heuristics picked bathrooms, stairwells and laundry rooms, because "is this
 * a photo that sells the villa" is not something brightness and color variety
 * can answer [2026-09-13]. The choices live in the caller; this just applies
 * them and keeps the old mirrored rows as non-primary gallery images.
 */
export const setHeroPhoto = internalAction({
  args: { propertyId: v.id("properties"), url: v.string() },
  handler: async (ctx, { propertyId, url }) => {
    const existingId: any = await ctx.runQuery(
      internal.photoMirror.findByLegacyUrl,
      { propertyId, legacyUrl: url }
    );
    if (existingId) {
      await ctx.runMutation(internal.photoMirror.promote, {
        propertyId,
        photoId: existingId,
      });
      return { action: "promoted" };
    }

    const res = await fetch(url);
    if (!res.ok) return { action: "fetch-failed", status: res.status };
    const blob = await res.blob();
    if (!blob.type.startsWith("image/"))
      return { action: "not-an-image", type: blob.type };

    const storageId = await ctx.storage.store(blob);
    await ctx.runMutation(internal.photoMirror.insertHero, {
      propertyId,
      storageId,
      legacyUrl: url,
    });
    return { action: "stored" };
  },
});

export const findByLegacyUrl = internalQuery({
  args: { propertyId: v.id("properties"), legacyUrl: v.string() },
  handler: async (ctx, { propertyId, legacyUrl }) => {
    const rows = await ctx.db
      .query("propertyPhotos")
      .withIndex("by_property", (q: any) => q.eq("propertyId", propertyId))
      .collect();
    return rows.find((r: any) => r.legacyUrl === legacyUrl)?._id ?? null;
  },
});

export const promote = internalMutation({
  args: { propertyId: v.id("properties"), photoId: v.id("propertyPhotos") },
  handler: async (ctx, { propertyId, photoId }) => {
    const rows = await ctx.db
      .query("propertyPhotos")
      .withIndex("by_property", (q: any) => q.eq("propertyId", propertyId))
      .collect();
    for (const r of rows) {
      await ctx.db.patch(r._id, { isPrimary: r._id === photoId });
    }
  },
});

export const insertHero = internalMutation({
  args: {
    propertyId: v.id("properties"),
    storageId: v.id("_storage"),
    legacyUrl: v.string(),
  },
  handler: async (ctx, { propertyId, storageId, legacyUrl }) => {
    const rows = await ctx.db
      .query("propertyPhotos")
      .withIndex("by_property", (q: any) => q.eq("propertyId", propertyId))
      .collect();
    for (const r of rows) await ctx.db.patch(r._id, { isPrimary: false });
    await ctx.db.insert("propertyPhotos", {
      propertyId,
      storageId,
      legacyUrl,
      sortOrder: -1,
      isPrimary: true,
    });
  },
});
