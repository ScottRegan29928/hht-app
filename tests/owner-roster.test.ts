import { describe, test, expect } from "bun:test";
import { importBatch, myHoldings } from "../convex/ownerRoster";
import { holdingSummary, assertUniqueOwnerLogin } from "../convex/ownerRosterData";
import { prepare, accept } from "../convex/ownerInvites";
import { listOwners, getOwner, updateOwner } from "../convex/admin";
import { currentUser, claimProfile } from "../convex/owner";
import { getAccount } from "../convex/ownerAccount";
import { myResorts } from "../convex/ownerPortal";
import { readFileSync } from "node:fs";

const run = (fn: any, ctx: any, args: any = {}) => fn._handler(ctx, args);
const holding = (sourceResort = "Swallowtail", communitySlug = "swallowtail-at-sea-pines", unitNumber = "1001") =>
  ({ sourceResort, communitySlug, unitNumber, weekNumber: 12, sourceUnitWeek: `${unitNumber}-12` });
const input = (rosterKey = "synthetic:a", extra: any = {}) => ({
  rosterKey, displayName: "Synthetic Owner A", firstName: "Synthetic", lastName: "Owner A",
  rosterHoldings: [holding()], ...extra,
});
const args = (profiles = [input()], dryRun = false) => ({ source: "synthetic-fixture", dryRun, profiles });

function fixture(signedIn = true, userId = "user-a") {
  const rows: Record<string, any[]> = {
    userProfiles: [], authAccounts: [], ownerInvites: [], weeks: [], properties: [],
    sites: [
      { _id: "site-a", slug: "swallowtail", name: "Swallowtail", ownerPortalEnabled: true,
        communitySlugs: ["swallowtail-at-sea-pines"] },
      { _id: "site-b", slug: "spicebush", name: "Spicebush", ownerPortalEnabled: true,
        communitySlugs: ["spicebush"] },
    ],
    users: [{ _id: userId, email: "a@example.test" }],
  };
  const writes: any[] = [];
  const reads: string[] = [];
  let serial = 0;
  const ctx = {
    auth: { getUserIdentity: async () => signedIn ? { subject: `${userId}|session` } : null },
    storage: { getUrl: async () => null },
    db: {
      query(table: string) {
        reads.push(table);
        let predicates: [string, unknown][] = [];
        const match = () => (rows[table] ?? []).filter(row => predicates.every(([k, v]) => row[k] === v));
        const chain: any = {
          withIndex(_name: string, fn: any) {
            const q: any = { eq(k: string, v: unknown) { predicates.push([k, v]); return q; } };
            fn(q); return chain;
          },
          collect: async () => match(),
          first: async () => match()[0] ?? null,
          unique: async () => {
            const found = match();
            if (found.length > 1) throw new Error("Not unique");
            return found[0] ?? null;
          },
        };
        return chain;
      },
      get: async (id: string) => Object.values(rows).flat().find(row => row._id === id) ?? null,
      insert: async (table: string, data: any) => {
        const id = `${table}-${++serial}`;
        (rows[table] ??= []).push({ ...data, _id: id });
        writes.push({ table, id, data }); return id;
      },
      patch: async (id: string, patch: any) => {
        const row = Object.values(rows).flat().find(row => row._id === id);
        if (!row) throw new Error(`Missing row: ${id}`);
        Object.assign(row, patch); writes.push({ id, patch });
      },
    },
  };
  return { ctx, rows, writes, reads };
}

describe("internal roster import", () => {
  test("registered mutation is internal only", () => {
    expect((importBatch as any).isInternal).toBe(true);
  });

  test("dry run validates and counts without any write", async () => {
    const f = fixture();
    const result = await run(importBatch, f.ctx, args([input()], true));
    expect(result).toEqual({ dryRun: true, created: 1, updated: 0, unchanged: 0, holdings: 1 });
    expect(f.writes).toEqual([]);
  });

  test("repeat import is idempotent and fills contacts without truncation", async () => {
    const f = fixture();
    const profile = input("synthetic:a", {
      contactEmail: "Contact@Example.Test", email: "a@example.test",
      phone: "+44 20 7000 0000 ext 123; +1 555 010 0000",
      homeAddress: "Synthetic street", homeCity: "Synthetic city", homeState: "SC",
      homePostalCode: "12345", homeCountry: "USA",
      rosterHoldings: [holding(), holding()],
    });
    await run(importBatch, f.ctx, args([profile]));
    const original = { ...f.rows.userProfiles[0] };
    expect(original.phone).toBe(profile.phone);
    expect(original.homeCity).toBe(profile.homeCity);
    expect(original.contactEmail).toBe("contact@example.test");
    expect(original.rosterHoldings).toHaveLength(1);
    const result = await run(importBatch, f.ctx, args([profile]));
    expect(result.unchanged).toBe(1);
    expect(f.writes).toHaveLength(1);
    expect(f.rows.userProfiles[0]).toEqual(original);
    expect(f.reads).not.toContain("weeks");
    expect(f.reads).not.toContain("properties");
    expect(f.reads).not.toContain("bookings");
  });

  test("re-import replaces complete holdings and only fills missing contact fields", async () => {
    const f = fixture();
    await run(importBatch, f.ctx, args());
    const p = f.rows.userProfiles[0];
    p.phone = "Preserve corrected phone";
    const next = input("synthetic:a", { phone: "Do not overwrite", homeCity: "New city",
      rosterHoldings: [holding("Spicebush", "spicebush", "2002")] });
    expect((await run(importBatch, f.ctx, args([next], true))).updated).toBe(1);
    expect(p.homeCity).toBeUndefined();
    await run(importBatch, f.ctx, args([next]));
    expect(p.phone).toBe("Preserve corrected phone");
    expect(p.homeCity).toBe("New city");
    expect(p.rosterHoldings[0].unitNumber).toBe("2002");
  });

  test("missing/invalid contact emails are retained without dummy login email", async () => {
    const f = fixture();
    await run(importBatch, f.ctx, args([input("synthetic:a", { contactEmail: "bad source text" }), input("synthetic:b")]));
    expect(f.rows.userProfiles.map(p => p.email)).toEqual([undefined, undefined]);
    expect(f.rows.userProfiles[0].contactEmail).toBe("bad source text");
  });

  test("shared contact emails keep distinct identities but shared sign-in email is rejected", async () => {
    const f = fixture();
    const profiles = [input("synthetic:a", { contactEmail: "shared@example.test" }),
      input("synthetic:b", { displayName: "Different Owner", contactEmail: "shared@example.test" })];
    await run(importBatch, f.ctx, args(profiles));
    expect(f.rows.userProfiles).toHaveLength(2);
    for (const p of profiles) p.email = "shared@example.test";
    await expect(run(importBatch, f.ctx, args(profiles))).rejects.toThrow("Ambiguous sign-in");
    expect(f.writes).toHaveLength(2);
  });

  test("rejects bad login email, invalid week, repeated keys before writes", async () => {
    for (const profiles of [
      [input("synthetic:a", { email: "invalid" })],
      [input("synthetic:a", { rosterHoldings: [{ ...holding(), weekNumber: 54 }] })],
      [input(), input()],
    ]) {
      const f = fixture();
      await expect(run(importBatch, f.ctx, args(profiles))).rejects.toThrow();
      expect(f.writes).toEqual([]);
    }
  });

  test("blank owner name requires review note and cannot receive a sign-in email", async () => {
    const f = fixture();
    await run(importBatch, f.ctx, args([input("blank", {
      firstName: undefined, lastName: undefined, displayName: "", importNotes: "Owner name missing in source",
    })]));
    expect(f.rows.userProfiles[0].email).toBeUndefined();
    await expect(run(importBatch, f.ctx, args([input("bad", { displayName: "" })]))).rejects.toThrow();
    await expect(run(importBatch, f.ctx, args([input("bad", { displayName: "", importNotes: "Review", email: "x@example.test" })]))).rejects.toThrow("Missing owner name");
    f.rows.userProfiles.push({ _id: "admin", userId: "user-a", role: "admin" });
    const listed = await run(listOwners, f.ctx);
    expect(listed[0].fullName).toBe("Name not supplied");
  });

  for (const protectedFields of [{ userId: "linked" }, { role: "admin" }, { rosterSource: "different" }]) {
    test(`refuses protected existing profile ${JSON.stringify(protectedFields)}`, async () => {
      const f = fixture();
      f.rows.userProfiles.push({ _id: "protected", role: "owner", rosterKey: "synthetic:a",
        rosterSource: "synthetic-fixture", ...protectedFields });
      await expect(run(importBatch, f.ctx, args([input("new"), input()]))).rejects.toThrow("Protected profile");
      expect(f.writes).toEqual([]);
    });
  }

  test("never merges by email or attaches an existing password identity", async () => {
    const f = fixture();
    f.rows.userProfiles.push({ _id: "legacy", email: "a@example.test", role: "owner" });
    await expect(run(importBatch, f.ctx, args([input("new", { email: "a@example.test" })]))).rejects.toThrow("Ambiguous sign-in");
    f.rows.userProfiles.length = 0;
    f.rows.authAccounts.push({ provider: "password", providerAccountId: "a@example.test" });
    await expect(run(importBatch, f.ctx, args([input("new", { email: "a@example.test" })]))).rejects.toThrow("authentication credentials");
    expect(f.writes).toEqual([]);
  });
});

describe("gated roster reads and contact details", () => {
  test("holdings summary counts actual resorts + unit, not filename", () => {
    expect(holdingSummary([holding(), holding("Spicebush", "spicebush", "1001")])).toEqual({
      rosterWeekCount: 2, rosterPropertyCount: 2, rosterResorts: ["Spicebush", "Swallowtail"],
    });
  });

  test("anonymous and non-owner cannot read holdings or master owner directory", async () => {
    for (const signedIn of [false, true]) {
      const f = fixture(signedIn);
      f.rows.userProfiles.push({ _id: "renter", userId: "user-a", role: "renter" });
      await expect(run(myHoldings, f.ctx)).rejects.toThrow();
      await expect(run(listOwners, f.ctx)).rejects.toThrow();
      await expect(run(getOwner, f.ctx, { ownerId: "renter" })).rejects.toThrow();
    }
  });

  test("owner sees only their linked portal holdings; currentUser does not leak master-only records", async () => {
    const f = fixture();
    f.rows.userProfiles.push({ _id: "mine", userId: "user-a", role: "owner", rosterKey: "mine",
      rosterHoldings: [holding(), holding("Spicebush", "spicebush"), holding("Other", "other")],
      phone: "+44 20 7000 0000", homeAddress: "Synthetic street", homeCity: "Synthetic city" });
    f.rows.userProfiles.push({ _id: "theirs", userId: "user-b", role: "owner", rosterHoldings: [holding()] });
    const result = await run(myHoldings, f.ctx);
    expect(result.holdings).toHaveLength(2);
    expect(result.rosterWeekCount).toBe(2);
    expect((await run(currentUser, f.ctx)).rosterHoldings).toBeUndefined();
    const account = await run(getAccount, f.ctx);
    expect(account.phone).toBe("+44 20 7000 0000");
    expect(account.homeCity).toBe("Synthetic city");
    const resorts = await run(myResorts, f.ctx, { siteSlug: "swallowtail" });
    expect(resorts.map((r: any) => r.siteSlug).sort()).toEqual(["spicebush", "swallowtail"]);
  });

  test("imported owners cannot claim or read data via email fallback before invite acceptance", async () => {
    const f = fixture();
    f.rows.userProfiles.push({ _id: "mine", role: "owner", rosterKey: "mine", email: "a@example.test" });
    expect(await run(currentUser, f.ctx)).toBeNull();
    await expect(run(myHoldings, f.ctx)).rejects.toThrow("Owner access");
    await expect(run(claimProfile, f.ctx, { profileId: "mine" })).rejects.toThrow("invitation");
  });

  test("admin list/detail preserve contactEmail, holdings and absent-login review state", async () => {
    const f = fixture();
    await run(importBatch, f.ctx, args([input("a", { contactEmail: "shared@example.test",
      phone: "+44 20 7000 0000 ext 123", homeCity: "Synthetic city" })]));
    f.rows.userProfiles.push({ _id: "admin", userId: "user-a", role: "admin" });
    const listed = await run(listOwners, f.ctx);
    expect(listed[0].rosterWeekCount).toBe(1);
    expect(listed[0].rosterPropertyCount).toBe(1);
    expect(listed[0].contactEmail).toBe("shared@example.test");
    const detail = await run(getOwner, f.ctx, { ownerId: listed[0]._id });
    expect(detail.homeCity).toBe("Synthetic city");
    await run(updateOwner, f.ctx, { ownerId: detail._id, firstName: "Synthetic",
      lastName: "", phone: "+44 20 7000 0000 ext 123", homeCity: "Corrected city" });
    expect(f.rows.userProfiles[0].email).toBeUndefined();
    expect(f.rows.userProfiles[0].phone).toBe("+44 20 7000 0000 ext 123");
  });
});

describe("invitations do not cross roster identities", () => {
  test("source contact email does not grant login and ambiguity blocks prepare", async () => {
    const f = fixture();
    f.rows.userProfiles.push({ _id: "a", role: "owner", email: "shared@example.test" },
      { _id: "b", role: "owner", contactEmail: "SHARED@example.test" });
    await expect(assertUniqueOwnerLogin(f.ctx, f.rows.userProfiles[0])).rejects.toThrow("Ambiguous email");
    await expect(run(prepare, f.ctx, { profileId: "b", siteSlug: "swallowtail" })).rejects.toThrow("reviewed sign-in");
    expect(f.writes).toEqual([]);
  });

  test("invite site comes from actual holding and master-only owners cannot force a portal", async () => {
    const f = fixture();
    f.rows.userProfiles.push({ _id: "a", role: "owner", rosterKey: "a",
      displayName: "Synthetic Owner", email: "unique@example.test", rosterHoldings: [holding("Spicebush", "spicebush")] });
    const invite = await run(prepare, f.ctx, { profileId: "a" });
    expect(invite.siteSlug).toBe("spicebush");
    f.rows.userProfiles[0].rosterHoldings = [holding("Other", "other")];
    await expect(run(prepare, f.ctx, { profileId: "a" })).rejects.toThrow("Could not tell");
    await expect(run(prepare, f.ctx, { profileId: "a", siteSlug: "swallowtail" })).rejects.toThrow("no holdings");
  });

  test("accept rechecks ambiguous address even for a previously valid token", async () => {
    const f = fixture();
    f.rows.userProfiles.push({ _id: "a", role: "owner", email: "a@example.test", displayName: "Synthetic Owner",
      rosterKey: "a", rosterHoldings: [holding()] });
    const invite = await run(prepare, f.ctx, { profileId: "a" });
    f.rows.userProfiles.push({ _id: "b", role: "owner", contactEmail: "a@example.test" });
    await expect(run(accept, f.ctx, { token: invite.token })).rejects.toThrow("Ambiguous email");
    expect(f.rows.userProfiles[0].userId).toBeUndefined();
    expect(f.rows.ownerInvites[0].acceptedAt).toBeUndefined();
  });

  test("unique imported owner activates only their profile and token is single-use", async () => {
    const f = fixture();
    f.rows.userProfiles.push({ _id: "a", role: "owner", displayName: "Synthetic Owner",
      email: "a@example.test", rosterKey: "a", rosterHoldings: [holding()] });
    const invite = await run(prepare, f.ctx, { profileId: "a" });
    await run(accept, f.ctx, { token: invite.token });
    expect(f.rows.userProfiles[0].userId).toBe("user-a");
    expect(f.rows.ownerInvites[0].acceptedAt).toBeNumber();
    expect((await run(myHoldings, f.ctx)).rosterWeekCount).toBe(1);
    await expect(run(accept, f.ctx, { token: invite.token })).rejects.toThrow("already used");
  });

  test("annotated nameless roster profiles cannot be invited even if given an email", async () => {
    const f = fixture();
    f.rows.userProfiles.push({ _id: "a", role: "owner", rosterKey: "a",
      email: "a@example.test", importNotes: "Owner name missing in source", rosterHoldings: [holding()] });
    await expect(run(prepare, f.ctx, { profileId: "a" })).rejects.toThrow("reviewed owner name");
    expect(f.writes).toEqual([]);
  });
});

test("read-only cards never provide inventory IDs or actionable sale forms", () => {
  const source = readFileSync(new URL("../src/pages/owner/PropertiesPage.tsx", import.meta.url), "utf8");
  const rosterSection = source.split('aria-label="Imported ownership records"')[1].split("</section>")[0];
  expect(rosterSection).not.toContain("weekId");
  expect(rosterSection).not.toContain("<button");
  expect(rosterSection).toContain("read-only");
  const importSource = readFileSync(new URL("../convex/ownerRoster.ts", import.meta.url), "utf8");
  expect(importSource).not.toContain("scheduler");
  expect(importSource).not.toContain('query("weeks")');
  expect(importSource).not.toContain('patch("weeks"');
  const adminSource = readFileSync(new URL("../src/pages/admin/OwnersPage.tsx", import.meta.url), "utf8");
  expect(adminSource).toContain("filteredOwners?.slice(0, visibleCount)");
  expect(adminSource).toContain("Show 50 more owners");
});
