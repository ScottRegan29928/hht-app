import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { finalizeCheckout } from "../convex/rentalCheckout";

/** Fully mocked transport: never contacts Hostaway or Stripe. */
async function runCheckout(createResponse: any, httpStatus = 200) {
  const oldFetch = globalThis.fetch;
  const oldSk = process.env.STRIPE_HERITAGE_SECRET_KEY;
  const oldPk = process.env.STRIPE_HERITAGE_PUBLISHABLE_KEY;
  process.env.STRIPE_HERITAGE_SECRET_KEY = "sk_test_fixture";
  process.env.STRIPE_HERITAGE_PUBLISHABLE_KEY = "pk_test_fixture";
  const mutations: any[] = [], calls: { url: string; method: string }[] = [];
  const s: any = {
    status: "awaiting_payment", chargeMode: "card_on_file", account: "heritage",
    stripeMode: "live", stripeIntentId: "seti_fixture", propertyId: "p",
    checkIn: "2027-01-24", checkOut: "2027-01-25", phone: "8435550100",
  };
  globalThis.fetch = (async (url: any, init: any) => {
    const path = String(url);
    calls.push({ url: path, method: init?.method ?? "GET" });
    if (path === "https://api.stripe.com/v1/setup_intents/seti_fixture")
      return Response.json({ status: "succeeded", payment_method: "pm_fixture" });
    if (path.includes("/calendar?"))
      return Response.json({ result: [{ date: s.checkIn, isAvailable: 1 }] });
    if (path.includes("/reservations?")) return Response.json(createResponse, { status: httpStatus });
    if (path.includes("/paymentCards/")) return Response.json({ status: "success", result: { id: "9007199254740995" } });
    throw new Error("Unexpected transport call: " + path);
  }) as typeof fetch;
  try {
    const ctx = {
      runQuery: async (ref: any) => {
        const name = getFunctionName(ref);
        if (name === "rentalCheckout:getSession") return s;
        if (name === "rentalCheckout:loadContext") return { property: { hostawayId: "392457" } };
        if (name === "hostawayApi:readState")
          return { value: "fixture-token", expiresAt: Date.now() + 30 * 86400000 };
        throw new Error(name);
      },
      runMutation: async (ref: any, args: any) => {
        const name = getFunctionName(ref);
        mutations.push({ name, args });
        if (name === "rentalCheckout:claimDates") return { ok: true, bookingId: "b" };
        if (name === "rentalCheckout:patchSession") Object.assign(s, args.patch);
      },
    };
    const result = await (finalizeCheckout as any)._handler(ctx, { sessionId: "s" });
    const callCount = calls.length;
    const repeated = s.status === "failed"
      ? await (finalizeCheckout as any)._handler(ctx, { sessionId: "s" }) : null;
    return { result, repeated, mutations, calls, callCount };
  } finally {
    globalThis.fetch = oldFetch;
    if (oldSk === undefined) delete process.env.STRIPE_HERITAGE_SECRET_KEY;
    else process.env.STRIPE_HERITAGE_SECRET_KEY = oldSk;
    if (oldPk === undefined) delete process.env.STRIPE_HERITAGE_PUBLISHABLE_KEY;
    else process.env.STRIPE_HERITAGE_PUBLISHABLE_KEY = oldPk;
  }
}

describe("Finalization preserves identity and holds", () => {
  for (const id of [123, "123", "9007199254740993"]) {
    test(`card-on-file completion with ${JSON.stringify(id)} never captures a charge`, async () => {
      const { result, mutations, calls } = await runCheckout({ status: "success", result: { id } });
      expect(result.status).toBe("confirmed");
      expect(mutations.find(m => m.name === "rentalCheckout:markConfirmed").args.hostawayReservationId).toBe(String(id));
      expect(calls.some(c => c.url === `https://api.hostaway.com/v1/paymentCards/${id}/addPaymentMethodId`)).toBe(true);
      expect(calls.filter(c => c.url.includes("api.stripe.com") && c.method !== "GET")).toHaveLength(0);
      expect(mutations.some(m => m.name === "rentalCheckout:releaseDates")).toBe(false);
    });
  }
  for (const id of [9007199254740992, undefined, null]) {
    test(`successful create with unusable ${JSON.stringify(id)} retains hold and cannot be retried`, async () => {
      const { result, repeated, mutations, calls, callCount } = await runCheckout({ status: "success", result: { id } });
      expect(result.status).toBe("failed");
      expect(result.error).toContain("dates remain held");
      expect(mutations.some(m => m.name === "rentalCheckout:releaseDates")).toBe(false);
      expect(mutations.some(m => m.name === "rentalCheckout:markConfirmed")).toBe(false);
      expect(mutations.find(m => m.name === "rentalCheckout:patchSession").args.patch)
        .toMatchObject({ status: "failed", hostawayWrite: "created" });
      expect(calls.some(c => c.url.includes("/paymentCards/"))).toBe(false);
      expect(calls.filter(c => c.url.includes("api.stripe.com") && c.method !== "GET")).toHaveLength(0);
      expect(calls.length).toBe(callCount);
      expect(repeated).toEqual(result);
    });
  }
  test("an explicitly rejected reservation still releases the local hold", async () => {
    const { result, mutations } = await runCheckout({ status: "fail", message: "Rejected" }, 400);
    expect(result.status).toBe("failed");
    expect(mutations.some(m => m.name === "rentalCheckout:releaseDates")).toBe(true);
  });
});
