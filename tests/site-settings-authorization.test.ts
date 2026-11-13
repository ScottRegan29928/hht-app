import { describe, expect, test } from "bun:test";
import {
  getByHostname, getBySlug, listSites, scopeForHostname, seedSites, updateSite,
} from "../convex/sites";
import { saveSeoDefaults } from "../convex/content";

// Exercise the real registered handlers and Convex Auth's identity parsing.
// All data and writes stay in memory; no deployed backend is contacted.
function fixture(role?: string, signedIn = true) {
  const site = {
    _id: "site", slug: "heritage", name: "Heritage Vacations",
    domain: "heritagevacations.com", altDomains: ["hv.lead-works.com"],
    scopeMode: "all", isActive: true, sortOrder: 1,
  };
  const writes: { id: string; patch: any }[] = [];
  const reads: string[] = [];
  const ctx = {
    auth: { getUserIdentity: async () => signedIn ? { subject: "user|session" } : null },
    db: {
      query(table: string) {
        reads.push(table);
        return {
          collect: async () => table === "sites" ? [site] : [],
          withIndex(index: string, select: any) {
            let field = "", value: unknown;
            select({ eq: (key: string, val: unknown) => { field = key; value = val; } });
            const result = table === "userProfiles"
              && index === "by_userId" && field === "userId" && value === "user"
              ? role === undefined ? null : { _id: "profile", userId: "user", role }
              : table === "sites" && field === "slug" && value === site.slug ? site : null;
            return { first: async () => result, unique: async () => result };
          },
        };
      },
      get: async (id: string) => { reads.push(id); return id === site._id ? site : null; },
      patch: async (id: string, patch: any) => { writes.push({ id, patch }); },
    },
  };
  return { ctx, writes, reads, site };
}

const settingsWrites = [
  { name: "sites.updateSite", fn: updateSite, args: { id: "site", patch: { name: "Updated", rentalsEnabled: false } } },
  { name: "content.saveSeoDefaults", fn: saveSeoDefaults, args: { siteId: "site", titleSuffix: " | Updated" } },
];

for (const { name, fn, args } of settingsWrites) {
  describe(name, () => {
    test("rejects unauthenticated callers before any database access", async () => {
      const { ctx, writes, reads } = fixture(undefined, false);
      await expect((fn as any)._handler(ctx, args)).rejects.toThrow("Not signed in");
      expect(reads).toEqual([]);
      expect(writes).toEqual([]);
    });

    for (const role of [undefined, "owner", "user", "guest", "ADMIN", "super_admin"]) {
      test(`rejects a missing or non-admin profile: ${role}`, async () => {
        const { ctx, writes, reads } = fixture(role);
        await expect((fn as any)._handler(ctx, args)).rejects.toThrow("Admin access required");
        expect(reads).toEqual(["userProfiles"]);
        expect(writes).toEqual([]);
      });
    }

    for (const role of ["admin", "admin_user", "admin_rental", "admin_sales"]) {
      test(`allows the existing admin role: ${role}`, async () => {
        const { ctx, writes } = fixture(role);
        const before = Date.now();
        await (fn as any)._handler(ctx, args);
        expect(writes).toHaveLength(1);
        expect(writes[0].id).toBe("site");
        expect(writes[0].patch.updatedAt).toBeGreaterThanOrEqual(before);
        expect(writes[0].patch.updatedAt).toBeLessThanOrEqual(Date.now());
        if (name === "sites.updateSite") {
          expect(writes[0].patch).toMatchObject(args.patch!);
        } else {
          expect(writes[0].patch.seoDefaults.titleSuffix).toBe("| Updated");
        }
      });
    }
  });
}

describe("site visibility remains unchanged", () => {
  test("the seed writer is internal-only, not a public mutation", () => {
    expect((seedSites as any).isInternal).toBe(true);
    expect((seedSites as any).isPublic).toBeUndefined();
    expect((updateSite as any).isPublic).toBe(true);
  });

  test("public site queries still work without authentication", async () => {
    const { ctx, site, writes } = fixture(undefined, false);
    expect(await (getByHostname as any)._handler(ctx, { hostname: "WWW.HERITAGEVACATIONS.COM:443" })).toEqual(site);
    expect(await (getByHostname as any)._handler(ctx, { hostname: "hv.lead-works.com" })).toEqual(site);
    expect(await (getBySlug as any)._handler(ctx, { slug: "heritage" })).toEqual(site);
    expect(await (listSites as any)._handler(ctx, {})).toEqual([site]);
    expect(await (scopeForHostname as any)._handler(ctx, { hostname: "heritagevacations.com" }))
      .toEqual({ site, communityIds: null });
    expect(writes).toEqual([]);
  });
});
