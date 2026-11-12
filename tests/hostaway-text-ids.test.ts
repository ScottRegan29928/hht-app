import { afterEach, describe, expect, test } from "bun:test";
import { createHostawayReservation, markConfirmed, attachHostawayCard } from "../convex/rentalCheckout";
import { cancellationMatches } from "../convex/bookingReconciliation";
import { cancellationPolicyText, POLICY_STRICT } from "../convex/paymentConfig";
import { importBatch } from "../convex/guestReviews";
import { upsertProperty } from "../convex/hostawaySync";
import schema from "../convex/schema";
import { hostawayId, sameHostawayId, legacyHostawayId } from "../convex/hostawayIds";
import { syncPhotos } from "../convex/hostawayApi";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const large = "9007199254740993";
const session = {
  _id: "s", status: "confirmed", propertyId: "p", checkIn: "2027-01-24",
  checkOut: "2027-01-25", calendarBookingId: "h", bookingId: "b",
  hostawayReservationId: large, firstName: "Test", lastName: "Guest",
  email: "test@example.com", phone: "(843) 555-0100", guests: 2,
  totalCents: 37700, chargeMode: "card_on_file", stripeCustomerId: "cus_test",
};
const property = { hostawayId: "392457" };
const reservation = { id: large, status: "cancelled", listingMapId: 392457,
  arrivalDate: session.checkIn, departureDate: session.checkOut };
const hold = { _id: "h", source: "hht", propertyId: "p", startDate: session.checkIn, endDate: session.checkOut };
const booking = { _id: "b", checkoutSessionId: "s", hostawayReservationId: large };

function database(initial: any[]) {
  const rows = new Map(initial.map(r => [r._id, structuredClone(r)]));
  return { rows, get: async (id: string) => rows.get(id) ?? null,
    patch: async (id: string, patch: any) => { Object.assign(rows.get(id), patch); },
    insert: async (table: string, doc: any) => {
      const id = table + rows.size; rows.set(id, { _id: id, _table: table, ...doc }); return id;
    },
    query: (table: string) => ({
      collect: async () => [...rows.values()].filter(r => r._table === table),
      withIndex: (_index: string, fn: any) => {
        let field = "", value: any;
        fn({ eq: (f: string, v: any) => { field = f; value = v; } });
        return { unique: async () => [...rows.values()].find(r => r._table === table && r[field] === value) ?? null };
      },
    }),
  };
}

describe("Hostaway text-ID transport and persistence", () => {
  for (const id of [123, "123", large]) {
    test(`reservation-create preserves ID ${JSON.stringify(id)} as text`, async () => {
      globalThis.fetch = (async () => Response.json({ status: "success", result: { id } })) as typeof fetch;
      expect(await createHostawayReservation("mock-token", session, 392457)).toBe(String(id));
    });
  }
  for (const id of [undefined, null, "", 0, -1, 1.5, 9007199254740992]) {
    test(`reservation-create rejects invalid/unsafe ID ${JSON.stringify(id)}`, async () => {
      globalThis.fetch = (async () => Response.json({ status: "success", result: { id } })) as typeof fetch;
      await expect(createHostawayReservation("mock-token", session, 392457)).rejects.toThrow("Hostaway");
    });
  }
  test("confirmation stores the same exact ID on both linked records", async () => {
    const db = database([session, booking]);
    await (markConfirmed as any)._handler({ db }, { sessionId: "s", hostawayWrite: "created", hostawayReservationId: large });
    expect(db.rows.get("s").hostawayReservationId).toBe(large);
    expect(db.rows.get("b").hostawayReservationId).toBe(large);
  });
  for (const id of [123, "123", large]) {
    test(`payment-card response ${JSON.stringify(id)} does not alter the reservation path or Stripe method`, async () => {
      const calls: any[] = [];
      globalThis.fetch = (async (url: any, init: any) => {
        calls.push({ url: String(url), method: init.method, body: JSON.parse(init.body) });
        return Response.json({ status: "success", result: { id } });
      }) as typeof fetch;
      expect(await attachHostawayCard("mock-token", large, "pm_mock")).toBeNull();
      expect(calls).toEqual([{
        url: `https://api.hostaway.com/v1/paymentCards/${large}/addPaymentMethodId`,
        method: "POST", body: { paymentMethodId: "pm_mock" },
      }]);
    });
  }
  test("property importer stores new IDs as text without converting old data in bulk", async () => {
    const db = database([{ _id: "p", _table: "properties", hostawayId: 392457 }]);
    await (upsertProperty as any)._handler({ db }, { existingId: "p", hostawayId: large,
      address: "Test", slug: "test", unitNumber: "1", communityId: "c", bedrooms: 2, bathrooms: 2 });
    expect(db.rows.get("p").hostawayId).toBe(large);
    expect(db.rows.size).toBe(1);
  });
  for (const [table, field] of [
    ["properties", "hostawayId"], ["bookings", "hostawayReservationId"],
    ["checkoutSessions", "hostawayReservationId"], ["checkoutSessions", "cancellationPolicyId"],
    ["guestReviews", "hostawayReviewId"],
  ]) {
    test(`database accepts legacy numbers and new text in ${table}.${field}`, () => {
      const validator = (schema.tables as any)[table].validator.json.value[field].fieldType;
      expect(validator.type).toBe("union");
      expect(validator.value.map((v: any) => v.type).sort()).toEqual(["number", "string"]);
    });
  }
});

describe("Lossless identity normalization", () => {
  test("large strings retain all digits, legacy numbers normalize, missing identities never match", () => {
    expect(hostawayId(large)).toBe(large);
    expect(hostawayId(123)).toBe("123");
    expect(sameHostawayId(123, "123")).toBe(true);
    expect(sameHostawayId(undefined, undefined)).toBe(false);
    expect(legacyHostawayId(large)).toBeNull();
    expect(legacyHostawayId("123")).toBe(123);
    expect(legacyHostawayId("00123")).toBeNull();
  });
  for (const value of [null, undefined, "", " ", "1e3", "12.5", true, {}, 0, -1, 1.5, Infinity, NaN, 9007199254740992]) {
    test(`rejects malformed ID ${String(value)}`, () => expect(hostawayId(value)).toBeNull());
  }
});

describe("Exact cancellation identity across old and new formats", () => {
  test("mixed-format listing and large reservation IDs match", () =>
    expect(cancellationMatches(session, property, reservation, hold, booking)).toBe(true));
  test("legacy numeric booking matches the same textual reservation", () =>
    expect(cancellationMatches({ ...session, hostawayReservationId: "123" }, property,
      { ...reservation, id: 123 }, hold, { ...booking, hostawayReservationId: 123 })).toBe(true));
  test("adjacent large IDs must never compare equal", () =>
    expect(cancellationMatches(session, property, { ...reservation, id: "9007199254740992" }, hold, booking)).toBe(false));
  test("unsafe numeric input must not release a hold", () =>
    expect(cancellationMatches({ ...session, hostawayReservationId: 9007199254740992 }, property,
      { ...reservation, id: "9007199254740993" }, hold,
      { ...booking, hostawayReservationId: 9007199254740992 })).toBe(false));
  test("missing IDs do not match each other", () =>
    expect(cancellationMatches({ ...session, hostawayReservationId: undefined }, property,
      { ...reservation, id: undefined }, hold, { ...booking, hostawayReservationId: undefined })).toBe(false));
});

test("Strict cancellation-policy text is identical for number and text ID", () => {
  expect(cancellationPolicyText(String(POLICY_STRICT) as any)).toEqual(cancellationPolicyText(POLICY_STRICT));
});

describe("Review import identity and moderation", () => {
  const review = { type: "guest-to-host", status: "published", isHidden: 0, isCancelled: 0,
    bookingEngineVisibility: 1, publicReview: "Updated review", reviewerName: "Jane Doe" };
  test("text ID refresh updates a legacy review without losing the local reply", async () => {
    const db = database([{ _id: "p", _table: "properties", hostawayId: "392457" },
      { _id: "r", _table: "guestReviews", hostawayReviewId: 12, response: "Thanks", hiddenOnSite: true }]);
    await (importBatch as any)._handler({ db }, { syncedAt: 100, rows: [
      { ...review, id: "12", listingMapId: 392457 },
      { ...review, id: 12, listingMapId: "392457" },
    ] });
    expect(db.rows.size).toBe(2);
    expect(db.rows.get("r")).toMatchObject({ body: "Updated review", response: "Thanks", hiddenOnSite: true, hostawayReviewId: "12" });
  });
  test("distinct large review IDs stay distinct and repeated sync is idempotent", async () => {
    const db = database([{ _id: "p", _table: "properties", hostawayId: 392457 }]);
    const rows = ["9007199254740992", large].map(id => ({ ...review, id, listingMapId: "392457" }));
    await (importBatch as any)._handler({ db }, { syncedAt: 100, rows });
    await (importBatch as any)._handler({ db }, { syncedAt: 101, rows });
    expect(db.rows.size).toBe(3);
    expect([...db.rows.values()].filter(r => r._table === "guestReviews").map(r => r.hostawayReviewId).sort())
      .toEqual(["9007199254740992", large]);
  });
});

test("photo sync joins mixed-format IDs without collisions between adjacent large IDs", async () => {
  const props = [
    { _id: "p1", hostawayId: 392457, photoUrls: [] },
    { _id: "p2", hostawayId: large, photoUrls: [] },
    { _id: "p3", hostawayId: "9007199254740992", photoUrls: [] },
  ];
  const listings = [
    { id: "392457", listingImages: [{ url: "https://example.com/one.webp" }] },
    { id: large, listingImages: [{ url: "https://example.com/two.webp" }] },
    { id: "9007199254740992", listingImages: [{ url: "https://example.com/three.webp" }] },
  ];
  const writes: any[] = [];
  globalThis.fetch = (async (_url: any, init: any) => {
    expect(init?.method ?? "GET").toBe("GET");
    return Response.json({ status: "success", result: listings });
  }) as typeof fetch;
  const ctx = {
    runQuery: async (_fn: any, args: any) => args.key
      ? { value: "mock-token", expiresAt: Date.now() + 30 * 86400000 } : props,
    runMutation: async (_fn: any, args: any) => { writes.push(args); },
  };
  expect(await (syncPhotos as any)._handler(ctx, {})).toMatchObject({ updated: 3 });
  expect(writes).toEqual([
    { propertyId: "p1", photoUrls: ["https://example.com/one.webp"] },
    { propertyId: "p2", photoUrls: ["https://example.com/two.webp"] },
    { propertyId: "p3", photoUrls: ["https://example.com/three.webp"] },
  ]);
});
