import { afterEach, describe, expect, test } from "bun:test";
import { createHostawayReservation } from "../convex/rentalCheckout";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const session = {
  checkIn: "2027-01-24", checkOut: "2027-01-25", firstName: "Test",
  lastName: "Guest", email: "test@example.com", phone: "(843) 555-0100",
  guests: 2, totalCents: 37700, chargeMode: "card_on_file",
  stripeCustomerId: "cus_test", notes: "Testing Reservation",
};

function transport(result: any = { status: "success", result: { id: 123 } }, status = 200) {
  const requests: { url: string; init: RequestInit; payload: any }[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    requests.push({ url: String(url), init, payload: JSON.parse(init.body) });
    return new Response(JSON.stringify(result), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return requests;
}

describe("Hostaway special-request handoff", () => {
  test("sends the guest request to Guest Notes on the existing reservation-create call", async () => {
    const calls = transport();
    expect(await createHostawayReservation("test-token", session, 392457)).toBe(123);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.hostaway.com/v1/reservations?forceOverbooking=0");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toEqual({ Authorization: "Bearer test-token", "Content-Type": "application/json" });
    expect(calls[0].payload).toMatchObject({
      guestNote: "Testing Reservation", channelId: 2000, listingMapId: 392457,
      arrivalDate: session.checkIn, departureDate: session.checkOut,
      guestFirstName: "Test", guestLastName: "Guest", guestName: "Test Guest",
      guestEmail: session.email, phone: "+18435550100", numberOfGuests: 2,
      totalPrice: 377, currency: "USD", stripeGuestId: "cus_test",
    });
    // The request is not sent as an outbound chat or written over private host notes.
    expect(calls[0].payload.hostNote).toBeUndefined();
  });

  for (const notes of [undefined, "", "  \n  "]) {
    test(`omits empty Guest Notes: ${JSON.stringify(notes)}`, async () => {
      const calls = transport();
      await createHostawayReservation("test-token", { ...session, notes }, 392457);
      expect(calls[0].payload).not.toHaveProperty("guestNote");
    });
  }

  test("preserves multiline requests, punctuation, and Unicode", async () => {
    const calls = transport();
    const notes = 'Early check-in?\nWe’re arriving at 2 p.m. & bringing a crib. 🧳';
    await createHostawayReservation("test-token", { ...session, notes: `  ${notes}\n ` }, 392457);
    expect(calls[0].payload.guestNote).toBe(notes);
  });

  test("card-on-file comment does not falsely claim the website charged the installment", async () => {
    const calls = transport();
    await createHostawayReservation("test-token", session, 392457);
    expect(calls[0].payload.comment).toContain("Hostaway manages installment charges");
    expect(calls[0].payload.comment).not.toContain("first installment charged via website");
  });

  test("capture mode retains existing payment-context wording", async () => {
    const calls = transport();
    await createHostawayReservation("test-token", { ...session, chargeMode: "card_capture" }, 392457);
    expect(calls[0].payload.comment).toContain("first installment charged via website Stripe checkout");
    expect(calls[0].payload.guestNote).toBe(session.notes);
  });

  test("an API rejection still follows the existing error path, without retrying the create", async () => {
    const calls = transport({ status: "fail", message: "Rejected" }, 400);
    await expect(createHostawayReservation("test-token", session, 392457)).rejects.toThrow("HostAway reservation failed: Rejected");
    expect(calls).toHaveLength(1);
  });
});
