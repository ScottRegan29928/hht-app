import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Intent rule 3 (images are always WebP) [scott, 2026-10-17]: one-off ops helper that points every
 * reference to an old JPEG/PNG storage file at its WebP re-encode. Replaces both storage ids and
 * resolved storage URLs anywhere inside a document (nested arrays/objects and HTML strings), so
 * hero ids, gallery arrays, cover URLs and inline article images all follow. Old files are kept.
 */
const TABLES = [
  "amenitySettings", "blogPosts", "boardMembers", "communities", "communityDocuments", "contentPages",
  "marketplaceListings", "ownerDocuments", "ownerPortalNotices", "ownerPortalSettings", "ownerProfiles",
  "properties", "propertyPhotos", "sites", "storeItems", "userProfiles",
] as const;

export const _swap = internalMutation({
  args: { pairs: v.array(v.object({ oldId: v.id("_storage"), newId: v.id("_storage") })), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { pairs, dryRun }) => {
    const map = new Map<string, string>();
    for (const { oldId, newId } of pairs) {
      map.set(oldId, newId);
      const [ou, nu] = [await ctx.storage.getUrl(oldId), await ctx.storage.getUrl(newId)];
      if (ou && nu) map.set(ou, nu);
    }
    const keys = [...map.keys()];
    const fix = (x: any): any => {
      if (typeof x === "string") {
        if (map.has(x)) return map.get(x);
        let s = x;
        for (const k of keys) if (k.startsWith("http") && s.includes(k)) s = s.split(k).join(map.get(k)!);
        return s;
      }
      if (Array.isArray(x)) return x.map(fix);
      if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, val]) => [k, fix(val)]));
      return x;
    };
    const changed: string[] = [];
    for (const t of TABLES) {
      for (const doc of await ctx.db.query(t as any).collect()) {
        const { _id, _creationTime, ...rest } = doc as any;
        const before = JSON.stringify(rest);
        const next = fix(rest);
        if (JSON.stringify(next) !== before) {
          changed.push(`${t}:${_id}`);
          if (!dryRun) await ctx.db.replace(_id, next);
        }
      }
    }
    return { changed: changed.length, sample: changed.slice(0, 20) };
  },
});

/** Ops: upload URL for the one-off WebP re-encodes. */
export const _uploadUrl = internalMutation({ args: {}, handler: async (ctx) => await ctx.storage.generateUploadUrl() });

/** Ops: resolved URLs for storage ids (to download the originals). */
export const _urls = internalQuery({
  args: { ids: v.array(v.id("_storage")) },
  handler: async (ctx, { ids }) => Promise.all(ids.map(async (id) => ({ id, url: await ctx.storage.getUrl(id) }))),
});
