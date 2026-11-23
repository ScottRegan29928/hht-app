import { describe, expect, test } from "bun:test";
import * as communities from "../convex/communities";
import * as properties from "../convex/properties";
import * as weeks from "../convex/weeks";
import * as migrations from "../convex/migrations";
import { createBooking, createRentalBooking } from "../convex/booking";
import { startCheckout, finalizeCheckout } from "../convex/rentalCheckout";

// The legacy import/maintenance tools have no browser callers. Convex must
// enforce internal visibility, not merely hide links in the management UI.
const internalWriters: Record<string, any> = {
  "communities.seed": communities.seed,
  "communities.updateName": communities.updateName,
  "communities.updateCoords": communities.updateCoords,
  "properties.seed": properties.seed,
  "properties.updateLinks": properties.updateLinks,
  "properties.updateFeatureCategories": properties.updateFeatureCategories,
  "properties.updateCoords": properties.updateCoords,
  "weeks.seed": weeks.seed,
  ...Object.fromEntries(Object.entries(migrations)
    .filter(([, fn]) => (fn as any).isMutation)
    .map(([name, fn]) => [`migrations.${name}`, fn])),
};

describe("maintenance/import write visibility", () => {
  test("covers all fifteen identified maintenance/import writers", () => {
    expect(Object.keys(internalWriters)).toHaveLength(15);
  });
  for (const [name, fn] of Object.entries(internalWriters)) {
    test(`${name} is internal-only`, () => {
      expect(fn.isInternal).toBe(true);
      expect(fn.isPublic).toBeUndefined();
    });
  }
});

function fixture(role?: string, signedIn = true, weekBased = false) {
  const reads: string[] = [], writes: string[] = [];
  const property = { _id: "property", nightlyRate: 100 };
  const week = {
    _id: "week", propertyId: "property", listingType: "rent", rented: false,
    weekNumber: 4, startDate: "2027-01-22", endDate: "2027-01-29", rentPrice: 700,
  };
  const ctx = {
    auth: { getUserIdentity: async () => signedIn ? { subject: "user|session" } : null },
    db: {
      query(table: string) {
        reads.push(table);
        return {
          withIndex(_name: string, select: any) {
            select({ eq: () => undefined });
            return {
              first: async () => role === undefined ? null : { _id: "profile", userId: "user", role },
              collect: async () => [],
              filter: () => ({ first: async () => null }),
            };
          },
        };
      },
      get: async (id: string) => { reads.push(id); return id === "week" ? week : property; },
      insert: async (table: string) => { writes.push(table); return "booking"; },
      patch: async (id: string) => { writes.push(id); },
    },
  };
  const args = {
    ...(weekBased ? { weekId: "week" } : {
      propertyId: "property", checkIn: "2027-01-22", checkOut: "2027-01-29",
    }),
    firstName: "Test", lastName: "Guest", email: "test@example.com", phone: "8435550100",
  };
  return { ctx, args, reads, writes };
}

for (const [name, fn, weekBased] of [
  ["booking.createBooking", createBooking, true],
  ["booking.createRentalBooking", createRentalBooking, false],
] as const) {
  describe(name, () => {
    test("rejects anonymous callers before any inventory read or write", async () => {
      const { ctx, args, reads, writes } = fixture(undefined, false, weekBased);
      await expect((fn as any)._handler(ctx, args)).rejects.toThrow("Not signed in");
      expect(reads).toEqual([]);
      expect(writes).toEqual([]);
    });
    for (const role of [undefined, "owner", "user", "guest", "ADMIN", "super_admin"]) {
      test(`rejects missing/non-admin profile: ${role}`, async () => {
        const { ctx, args, reads, writes } = fixture(role, true, weekBased);
        await expect((fn as any)._handler(ctx, args)).rejects.toThrow("Admin access required");
        expect(reads).toEqual(["userProfiles"]);
        expect(writes).toEqual([]);
      });
    }
    for (const role of ["admin", "admin_user", "admin_rental", "admin_sales"]) {
      test(`retains explicit staff access: ${role}`, async () => {
        const { ctx, args, writes } = fixture(role, true, weekBased);
        expect(await (fn as any)._handler(ctx, args)).toBe("booking");
        expect(writes).toEqual(weekBased
          ? ["bookings", "week", "calendarBookings"]
          : ["bookings", "calendarBookings"]);
      });
    }
  });
}

test("the verified Stripe checkout actions remain public for guests", () => {
  expect((startCheckout as any).isPublic).toBe(true);
  expect((finalizeCheckout as any).isPublic).toBe(true);
});
