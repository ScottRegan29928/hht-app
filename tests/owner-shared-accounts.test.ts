import { describe, expect, test } from "bun:test";
import { consolidate } from "../convex/ownerRosterConsolidation";
import { importBatch, myHoldings } from "../convex/ownerRoster";
import { assertUniqueOwnerLogin, ownerOfRecordGroups, uniqueHoldings } from "../convex/ownerRosterData";
import { listOwners, getOwner, searchOwners, updateOwner, deleteOwner } from "../convex/admin";
import { matchesOwnerSearch } from "../convex/ownerOwnership";
import { currentUser } from "../convex/owner";

const run = (fn: any, ctx: any, args: any = {}) => fn._handler(ctx, args);
const holding = (unitNumber = "1001", weekNumber = 12, communitySlug = "swallowtail") => ({
  sourceResort: communitySlug === "swallowtail" ? "Swallowtail" : communitySlug === "spicebush" ? "Spicebush" : "Other",
  communitySlug, unitNumber, weekNumber, sourceUnitWeek: `${unitNumber}-${weekNumber}`,
});

function fixture() {
  const rows: Record<string, any[]> = {
    userProfiles: [
      { _id: "primary", role: "owner", rosterKey: "first", displayName: "Synthetic First",
        firstName: "Synthetic", lastName: "First", rosterSource: "source",
        contactEmail: "common@example.test", homeAddress: "First contact", createdAt: 1,
        importNotes: "Phone missing in source; Email shared by multiple owner records; sign-in requires identity review",
        rosterHoldings: [holding()] },
      { _id: "secondary", role: "owner", rosterKey: "second", displayName: "Synthetic Trust",
        rosterSource: "source", contactEmail: "COMMON@example.test",
        homeAddress: "Different contact", createdAt: 2,
        rosterHoldings: [holding("2001", 14, "spicebush"), holding("9001", 20, "other")] },
    ],
    users: [], authAccounts: [], weeks: [], properties: [], ownerInvites: [],
    marketplaceListings: [], marketplaceMatches: [], saleRequests: [], communities: [],
    sites: [
      { slug: "swallowtail", ownerPortalEnabled: true, communitySlugs: ["swallowtail"] },
      { slug: "spicebush", ownerPortalEnabled: true, communitySlugs: ["spicebush"] },
      { slug: "other", ownerPortalEnabled: false, communitySlugs: ["other"] },
    ],
  };
  const writes: any[] = [];
  const ctx: any = {
    auth: { getUserIdentity: async () => ({ subject: "user-a|session" }) },
    storage: { getUrl: async () => null },
    db: {
      query(table: string) {
        const predicates: [string, unknown][] = [];
        const match = () => (rows[table] ?? []).filter(r => predicates.every(([k,v]) => r[k] === v));
        const chain: any = {
          withIndex(_name: string, fn: any) {
            const q: any = { eq(k: string,v: unknown) { predicates.push([k,v]); return q; } };
            fn(q); return chain;
          },
          collect: async () => match(), first: async () => match()[0] ?? null,
          unique: async () => { const found = match(); if (found.length > 1) throw new Error("Not unique"); return found[0] ?? null; },
        };
        return chain;
      },
      get: async (id: string) => Object.values(rows).flat().find(r => r._id === id) ?? null,
      patch: async (id: string, data: any) => {
        Object.assign(Object.values(rows).flat().find(r => r._id === id)!, data);
        writes.push({ id, data });
      },
      delete: async () => { throw new Error("Consolidation must not delete records"); },
      insert: async () => { throw new Error("Consolidation must not create accounts"); },
    },
  };
  const args = {
    source: "source", batchId: "explicit-approval", dryRun: false,
    groups: [{ email: "common@example.test", primaryRosterKey: "first",
      members: rows.userProfiles.map(p => ({ rosterKey: p.rosterKey,
        expectedName: p.displayName, expectedHoldings: structuredClone(p.rosterHoldings) })) }],
  };
  return { rows, writes, ctx, args };
}

describe("explicit shared-owner consolidation", () => {
  test("internal only; dry run validates without writing or sending", async () => {
    const f = fixture(), before = JSON.stringify(f.rows);
    expect((consolidate as any).isInternal).toBe(true);
    expect(await run(consolidate, f.ctx, { ...f.args, dryRun: true })).toEqual({
      dryRun: true, groups: 1, consolidated: 1, unchanged: 0, archivedProfiles: 1, activeHoldingRows: 3,
    });
    expect(f.writes).toEqual([]);
    expect(JSON.stringify(f.rows)).toBe(before);
  });

  test("first listed identity gets common email and every holding; sources stay reversible", async () => {
    const f = fixture(), secondaryBefore = structuredClone(f.rows.userProfiles[1]);
    const immutableBefore = JSON.stringify(Object.fromEntries(Object.entries(f.rows).filter(([k]) => k !== "userProfiles")));
    await run(consolidate, f.ctx, f.args);
    const [primary, archived] = f.rows.userProfiles;
    expect(primary.displayName).toBe("Synthetic First");
    expect(primary.homeAddress).toBe("First contact");
    expect(primary.importNotes).toBe("Phone missing in source; Shared-email account grouping approved; per-unit/week owner-of-record labels preserved");
    expect(primary.email).toBe("common@example.test");
    expect(primary.rosterHoldings).toHaveLength(3);
    expect(primary.rosterHoldings.find((h: any) => h.unitNumber === "2001")).toMatchObject({
      weekNumber: 14, ownerOfRecord: "Synthetic Trust", sourceRosterKey: "second",
    });
    expect(archived).toMatchObject({ ...secondaryBefore, rosterConsolidatedInto: "primary" });
    expect(primary.userId).toBeUndefined();
    expect(JSON.stringify(Object.fromEntries(Object.entries(f.rows).filter(([k]) => k !== "userProfiles")))).toBe(immutableBefore);
    await assertUniqueOwnerLogin(f.ctx, primary);
    await expect(assertUniqueOwnerLogin(f.ctx, archived)).rejects.toThrow("primary shared");
  });

  test("identical unit/week under different legal owners retains both labels", () => {
    const holdings = uniqueHoldings([
      { ...holding(), ownerOfRecord: "Synthetic Joint Owners", sourceRosterKey: "one" },
      { ...holding(), ownerOfRecord: "Synthetic Family Trust", sourceRosterKey: "two" },
    ]);
    expect(holdings).toHaveLength(2);
    expect(ownerOfRecordGroups(holdings).map(g => g.ownerOfRecord).sort()).toEqual([
      "Synthetic Family Trust", "Synthetic Joint Owners",
    ]);
  });

  test("repeat is unchanged, even after database key ordering changes", async () => {
    const f = fixture();
    await run(consolidate, f.ctx, f.args);
    for (const p of f.rows.userProfiles)
      p.rosterHoldings = p.rosterHoldings.map((h: any) => Object.fromEntries(Object.entries(h).sort(([a],[b]) => a.localeCompare(b))));
    f.writes.length = 0;
    expect(await run(consolidate, f.ctx, f.args)).toMatchObject({ consolidated: 0, unchanged: 1, archivedProfiles: 0 });
    expect(f.writes).toEqual([]);
  });

  for (const dependency of ["weeks", "properties", "ownerInvites", "marketplaceListings", "marketplaceMatches", "saleRequests", "storeCharges", "inquiryReplies", "reviewResponseHistory", "amenitySettings"]) {
    test(`refuses ${dependency} dependencies before any write`, async () => {
      const f = fixture();
      (f.rows[dependency] ??= []).push({ [dependency === "ownerInvites" ? "profileId" :
        dependency.startsWith("marketplace") || dependency === "storeCharges" ? "ownerProfileId" :
        dependency === "inquiryReplies" || dependency === "reviewResponseHistory" ? "authorProfileId" :
        dependency === "amenitySettings" ? "updatedBy" : "ownerId"]: "secondary" });
      await expect(run(consolidate, f.ctx, f.args)).rejects.toThrow("dependencies");
      expect(f.writes).toEqual([]);
    });
  }

  for (const [label, mutate, message] of [
    ["linked profile", (f: any) => { f.rows.userProfiles[1].userId = "someone"; }, "Protected"],
    ["different import source", (f: any) => { f.rows.userProfiles[1].rosterSource = "other"; }, "Protected"],
    ["changed name", (f: any) => { f.rows.userProfiles[1].displayName = "Changed"; }, "name changed"],
    ["changed holdings", (f: any) => { f.rows.userProfiles[1].rosterHoldings.pop(); }, "holdings changed"],
    ["changed email", (f: any) => { f.rows.userProfiles[1].contactEmail = "other@example.test"; }, "email no longer"],
    ["different login email", (f: any) => { f.rows.userProfiles[1].email = "other@example.test"; }, "email no longer"],
    ["outside source identity", (f: any) => { f.rows.userProfiles.push({ _id: "outside", contactEmail: "common@example.test" }); }, "outside"],
    ["existing password account", (f: any) => { f.rows.authAccounts.push({ providerAccountId: "common@example.test" }); }, "authentication"],
    ["existing auth user", (f: any) => { f.rows.users.push({ email: "common@example.test" }); }, "authentication"],
    ["reordered primary", (f: any) => { f.args.groups[0].primaryRosterKey = "second"; }, "first approved"],
    ["already archived source", (f: any) => { f.rows.userProfiles[1].rosterConsolidatedInto = "other"; }, "another or incomplete"],
  ] as const) {
    test(`refuses ${label} before any write`, async () => {
      const f = fixture(); mutate(f);
      await expect(run(consolidate, f.ctx, f.args)).rejects.toThrow(message);
      expect(f.writes).toEqual([]);
    });
  }

  test("valid earlier group is not applied if any later group fails validation", async () => {
    const f = fixture();
    f.args.groups.push({ ...structuredClone(f.args.groups[0]), email: "invalid" });
    await expect(run(consolidate, f.ctx, f.args)).rejects.toThrow("Invalid");
    expect(f.writes).toEqual([]);
  });

  test("archived sources do not bypass independent email conflict checks", async () => {
    const f = fixture();
    await run(consolidate, f.ctx, f.args);
    f.rows.userProfiles.push({ _id: "outside", role: "owner", contactEmail: "common@example.test" });
    await expect(assertUniqueOwnerLogin(f.ctx, f.rows.userProfiles[0])).rejects.toThrow("Ambiguous");
  });

  test("stale roster imports cannot undo shared primary or revive an archived source", async () => {
    const f = fixture();
    await run(consolidate, f.ctx, f.args);
    for (const p of f.rows.userProfiles) {
      await expect(run(importBatch, f.ctx, { source: "source", dryRun: false,
        profiles: [{ rosterKey: p.rosterKey, displayName: p.displayName, rosterHoldings: p.rosterHoldings }] }))
        .rejects.toThrow("Protected profile");
    }
  });
});

describe("shared-owner management and portal projection", () => {
  test("one searchable admin account; archived records cannot be edited, deleted or selected", async () => {
    const f = fixture();
    await run(consolidate, f.ctx, f.args);
    f.rows.userProfiles.push({ _id: "admin", userId: "user-a", role: "admin" });
    const listed = await run(listOwners, f.ctx);
    expect(listed).toHaveLength(1);
    expect(listed[0].fullName).toBe("Synthetic First");
    expect(listed[0].ownerOfRecordGroups).toHaveLength(3);
    expect(listed[0].isSharedAccount).toBe(true);
    expect(matchesOwnerSearch(listed[0], "Synthetic Trust")).toBe(true);
    expect(matchesOwnerSearch(listed[0], "spicebush unit 2001 week 14")).toBe(true);
    expect((await run(searchOwners, f.ctx, { search: "Synthetic Trust" })).map((p: any) => p._id)).toEqual(["primary"]);
    const detail = await run(getOwner, f.ctx, { ownerId: "primary" });
    expect(detail.ownerOfRecordGroups).toHaveLength(3);
    await expect(run(getOwner, f.ctx, { ownerId: "secondary" })).rejects.toThrow("consolidated");
    await expect(run(updateOwner, f.ctx, { ownerId: "secondary", firstName: "No", lastName: "Change" })).rejects.toThrow("consolidated");
    await expect(run(deleteOwner, f.ctx, { ownerId: "primary" })).rejects.toThrow("separate or remove");
  });

  test("owner query includes both portal resorts but not other resorts or stable import keys", async () => {
    const f = fixture();
    await run(consolidate, f.ctx, f.args);
    f.rows.userProfiles[0].userId = "user-a";
    const result = await run(myHoldings, f.ctx);
    expect(result.isSharedAccount).toBe(true);
    expect(result.holdings).toHaveLength(2);
    expect(result.ownerOfRecordGroups).toHaveLength(2);
    expect(result.ownerOfRecordGroups.map((g: any) => g.sourceResort).sort()).toEqual(["Spicebush", "Swallowtail"]);
    expect(result.holdings.every((h: any) => !h.sourceRosterKey)).toBe(true);
    const account = await run(currentUser, f.ctx);
    expect(account.rosterSharedAccount).toBeUndefined();
    expect(account.rosterHoldings).toBeUndefined();
    expect(account.rosterKey).toBeUndefined();
  });

  test("uninvited shared-email user still cannot claim imported source or primary", async () => {
    const f = fixture();
    await run(consolidate, f.ctx, f.args);
    f.rows.users.push({ _id: "user-a", email: "common@example.test" });
    expect(await run(currentUser, f.ctx)).toBeNull();
    await expect(run(myHoldings, f.ctx)).rejects.toThrow("Owner access");
  });
});
