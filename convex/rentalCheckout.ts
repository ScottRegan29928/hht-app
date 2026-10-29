/**
 * Pay-first rental checkout (Heritage Vacations / all rental sites).
 *
 * Flow agreed with The Club Group (Go-Live task list v4, 2026-10-07):
 *   1. Guest picks dates → startCheckout(): live HostAway availability +
 *      HostAway's own price quote (taxes, weekly discount, cleaning) →
 *      Stripe PaymentIntent (manual capture) on the property's account.
 *      NOTHING is held yet (D1: unpaid reservations must not hold dates).
 *   2. Browser confirms the card with Stripe's Payment Element.
 *   3. finalizeCheckout(): re-check availability → atomically claim the dates
 *      locally → create the HostAway reservation (gated) → capture. If the
 *      dates were lost in between, the authorization is voided, never charged.
 *
 * Gates:
 *   - Keys come from Convex env (STRIPE_{HERITAGE|SEAPINES}_{SECRET|PUBLISHABLE}_KEY).
 *     No key → checkout reports "not connected" and the page falls back.
 *   - Live keys refuse to run until the payment schedule is marked confirmed.
 *   - HostAway writes need HOSTAWAY_WRITES_ENABLED (goLive.ts) AND a live key.
 *
 * Stripe is called over plain fetch (node_modules is read-only here; no SDK).
 * A restricted key needs: PaymentIntents write, SetupIntents write,
 * Customers write, PaymentMethods read.
 */
import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getToken, getWithRetry } from "./hostawayApi";
import { HOSTAWAY_WRITES_ENABLED } from "./goLive";
import {
  DEFAULT_SCHEDULE,
  STRIPE_ACCOUNTS,
  cancellationPolicyText,
  defaultAccountFor,
  planCharges,
  stripeModeFromKey,
  validateSchedule,
  type ChargeMode,
  type Installment,
  type StripeAccountKey,
} from "./paymentConfig";

const HOSTAWAY_API = "https://api.hostaway.com/v1";

function env(): Record<string, string | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>;
}

function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function accountKeys(account: StripeAccountKey) {
  const e = env();
  const secret = e[STRIPE_ACCOUNTS[account].secretEnv];
  const publishable = e[STRIPE_ACCOUNTS[account].publishableEnv];
  const mode = stripeModeFromKey(secret);
  return { secret, publishable, mode, configured: !!(secret && publishable && mode) };
}

// ───────────────────────── settings ─────────────────────────

type Settings = {
  schedule: Installment[];
  scheduleConfirmed: boolean;
  chargeMode: ChargeMode;
  accountOverrides: { propertyId: Id<"properties">; account: StripeAccountKey }[];
};

async function readSettings(ctx: any): Promise<Settings> {
  const row = await ctx.db
    .query("paymentSettings")
    .withIndex("by_key", (q: any) => q.eq("key", "default"))
    .unique();
  return row
    ? {
        schedule: row.schedule,
        scheduleConfirmed: row.scheduleConfirmed,
        chargeMode: row.chargeMode,
        accountOverrides: row.accountOverrides,
      }
    : {
        schedule: DEFAULT_SCHEDULE,
        scheduleConfirmed: true, // confirmed by Justin 2026-10-10
        // HostAway charges installment 1 itself the moment a card is attached,
        // so website capture double-charged Justin's live test [hostaway, 2026-10-17].
        chargeMode: "card_on_file",
        accountOverrides: [],
      };
}

async function communitySlugOf(ctx: any, property: any): Promise<string | null> {
  if (property.communityId) {
    const c = await ctx.db.get(property.communityId);
    if (c?.slug) return c.slug;
  }
  return property.communitySlug ?? null;
}

async function accountForProperty(ctx: any, property: any, settings: Settings) {
  const override = settings.accountOverrides.find((o) => o.propertyId === property._id);
  if (override) return override.account;
  return defaultAccountFor(await communitySlugOf(ctx, property));
}

async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not signed in");
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();
  const adminRoles = ["admin", "admin_user", "admin_rental"];
  if (!profile || !adminRoles.includes(profile.role)) {
    throw new Error("Admin access required");
  }
  return profile;
}

// ───────────────────────── public: readiness ─────────────────────────

/** What the checkout page needs before showing a card form. */
export const checkoutConfig = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    const property = await ctx.db.get(propertyId);
    if (!property) return null;
    const settings = await readSettings(ctx);
    const account = await accountForProperty(ctx, property, settings);
    const keys = accountKeys(account);
    let reason: string | null = null;
    if (!property.hostawayId) reason = "This property is not connected to HostAway.";
    else if (!keys.configured) reason = "Online payment is not connected yet.";
    else if (keys.mode === "live" && !settings.scheduleConfirmed)
      reason = "The payment schedule has not been confirmed yet.";
    return {
      ready: reason === null,
      reason,
      mode: keys.mode,
      maxGuests: property.sleeps ?? null,
    };
  },
});

// ───────────────────────── internal helpers ─────────────────────────

export const loadContext = internalQuery({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    const property = await ctx.db.get(propertyId);
    if (!property) return null;
    const settings = await readSettings(ctx);
    const account = await accountForProperty(ctx, property, settings);
    return {
      property: {
        _id: property._id,
        hostawayId: property.hostawayId ?? null,
        address: property.address ?? property.slug,
        sleeps: property.sleeps ?? null,
      },
      settings,
      account,
    };
  },
});

export const hasLocalConflict = internalQuery({
  args: { propertyId: v.id("properties"), checkIn: v.string(), checkOut: v.string() },
  handler: async (ctx, { propertyId, checkIn, checkOut }) => {
    const rows = await ctx.db
      .query("calendarBookings")
      .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
      .collect();
    return rows.some((b) => b.startDate < checkOut && b.endDate > checkIn);
  },
});

export const insertSession = internalMutation({
  args: { doc: v.any() },
  handler: async (ctx, { doc }) => await ctx.db.insert("checkoutSessions", doc),
});

export const patchSession = internalMutation({
  args: { sessionId: v.id("checkoutSessions"), patch: v.any() },
  handler: async (ctx, { sessionId, patch }) => {
    await ctx.db.patch(sessionId, { ...patch, updatedAt: Date.now() });
  },
});

export const getSession = internalQuery({
  args: { sessionId: v.id("checkoutSessions") },
  handler: async (ctx, { sessionId }) => await ctx.db.get(sessionId),
});

/**
 * The only place dates get held. Runs as one transaction, so two guests who
 * both paid for the same week cannot both win: the second sees the first's
 * calendar row and gets voided.
 */
export const claimDates = internalMutation({
  args: { sessionId: v.id("checkoutSessions") },
  handler: async (ctx, { sessionId }) => {
    const s = await ctx.db.get(sessionId);
    if (!s) throw new Error("Checkout session not found");
    if (s.bookingId) return { ok: true, bookingId: s.bookingId };
    const rows = await ctx.db
      .query("calendarBookings")
      .withIndex("by_property", (q) => q.eq("propertyId", s.propertyId))
      .collect();
    if (rows.some((b) => b.startDate < s.checkOut && b.endDate > s.checkIn)) {
      return { ok: false as const };
    }
    const nights = Math.round(
      (Date.parse(s.checkOut + "T12:00:00Z") - Date.parse(s.checkIn + "T12:00:00Z")) / 86400000
    );
    const bookingId = await ctx.db.insert("bookings", {
      bookingType: "rental",
      propertyId: s.propertyId,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      phone: s.phone,
      startDate: s.checkIn,
      endDate: s.checkOut,
      price: s.totalCents / 100,
      nights,
      guests: s.guests,
      status: "pending",
      notes: s.notes,
      checkoutSessionId: sessionId,
      stripeAccount: s.account,
      paymentMethod: "stripe",
      paymentId: s.stripeIntentId,
      createdAt: Date.now(),
    });
    const calendarBookingId = await ctx.db.insert("calendarBookings", {
      propertyId: s.propertyId,
      startDate: s.checkIn,
      endDate: s.checkOut,
      source: "hht",
      summary: `Rental (paid online): ${s.firstName} ${s.lastName}`,
      guestName: `${s.firstName} ${s.lastName}`,
      createdAt: Date.now(),
    });
    await ctx.db.patch(sessionId, { bookingId, calendarBookingId, updatedAt: Date.now() });
    return { ok: true as const, bookingId };
  },
});

/** Undo claimDates when a later step fails, so the dates go back on sale. */
export const releaseDates = internalMutation({
  args: { sessionId: v.id("checkoutSessions"), status: v.string(), error: v.string() },
  handler: async (ctx, { sessionId, status, error }) => {
    const s = await ctx.db.get(sessionId);
    if (!s) return;
    if (s.calendarBookingId) await ctx.db.delete(s.calendarBookingId);
    if (s.bookingId) await ctx.db.patch(s.bookingId, { status: "cancelled" });
    await ctx.db.patch(sessionId, {
      status: status as any,
      error,
      calendarBookingId: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const markConfirmed = internalMutation({
  args: {
    sessionId: v.id("checkoutSessions"),
    hostawayWrite: v.string(),
    hostawayReservationId: v.optional(v.number()),
  },
  handler: async (ctx, { sessionId, hostawayWrite, hostawayReservationId }) => {
    const s = await ctx.db.get(sessionId);
    if (!s?.bookingId) throw new Error("No claimed booking for this session");
    await ctx.db.patch(s.bookingId, {
      status: "confirmed",
      amountPaid: s.chargeMode === "card_capture" ? s.dueNowCents / 100 : 0,
      hostawayReservationId,
    });
    await ctx.db.patch(sessionId, {
      status: "confirmed",
      hostawayWrite: hostawayWrite as any,
      hostawayReservationId,
      error: undefined,
      updatedAt: Date.now(),
    });
  },
});

// ───────────────────────── Stripe over fetch ─────────────────────────

function formEncode(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, val] of Object.entries(obj)) {
    if (val === undefined || val === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof val === "object" && !Array.isArray(val)) {
      out.push(...formEncode(val as Record<string, unknown>, key));
    } else if (Array.isArray(val)) {
      val.forEach((item, i) => {
        if (typeof item === "object") out.push(...formEncode(item, `${key}[${i}]`));
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`);
    }
  }
  return out;
}

async function stripe(
  secret: string,
  method: "GET" | "POST",
  path: string,
  params?: Record<string, unknown>,
  idempotencyKey?: string
): Promise<any> {
  const headers: Record<string, string> = { Authorization: `Bearer ${secret}` };
  let body: string | undefined;
  if (method === "POST") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    body = formEncode(params ?? {}).join("&");
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, { method, headers, body });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${path}: ${data?.error?.message ?? res.status}`);
  }
  return data;
}

// ───────────────────────── HostAway reads ─────────────────────────

async function hostawayAvailable(
  token: string,
  listingId: number,
  checkIn: string,
  checkOut: string
): Promise<{ ok: boolean; reason?: string }> {
  const lastNight = new Date(Date.parse(checkOut + "T12:00:00Z") - 86400000)
    .toISOString()
    .slice(0, 10);
  const res = await getWithRetry(
    `${HOSTAWAY_API}/listings/${listingId}/calendar?startDate=${checkIn}&endDate=${lastNight}`,
    token
  );
  if (!res.ok) return { ok: false, reason: `Could not check availability (${res.status}).` };
  const days: any[] = (await res.json())?.result ?? [];
  const nights = Math.round(
    (Date.parse(checkOut + "T12:00:00Z") - Date.parse(checkIn + "T12:00:00Z")) / 86400000
  );
  if (days.length < nights) return { ok: false, reason: "Availability is incomplete for these dates." };
  if (days.some((d) => d.isAvailable !== 1)) {
    return { ok: false, reason: "These dates are no longer available." };
  }
  const first = days.find((d) => d.date === checkIn);
  if (first?.closedOnArrival) return { ok: false, reason: "Check-in is not allowed on this date." };
  if (first?.minimumStay && nights < first.minimumStay) {
    return { ok: false, reason: `This villa requires a minimum stay of ${first.minimumStay} nights for these dates.` };
  }
  return { ok: true };
}

/** HostAway's own price calculation (read-only POST; creates nothing). */
async function hostawayQuote(token: string, listingId: number, checkIn: string, checkOut: string, guests: number) {
  const res = await fetch(`${HOSTAWAY_API}/listings/${listingId}/calendar/priceDetails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startingDate: checkIn, endingDate: checkOut, numberOfGuests: guests }),
  });
  if (!res.ok) throw new Error(`Could not price these dates (${res.status}).`);
  const r = (await res.json())?.result;
  const total = Number(r?.totalPrice);
  if (!(total > 0)) throw new Error("HostAway returned no price for these dates.");
  const components = (r.components ?? [])
    .filter((c: any) => c.isIncludedInTotalPrice === 1 && c.total)
    .map((c: any) => ({ title: c.title ?? c.name, type: c.type, total: Number(c.total) }));
  return { totalCents: Math.round(total * 100), components };
}

async function hostawayPolicyId(token: string, listingId: number): Promise<number | null> {
  const res = await getWithRetry(`${HOSTAWAY_API}/listings/${listingId}`, token);
  if (!res.ok) return null;
  return (await res.json())?.result?.cancellationPolicyId ?? null;
}

// ───────────────────────── public: quote ─────────────────────────

/**
 * Live HostAway price for a stay — what property pages and the checkout
 * sidebar show, so the displayed price always equals what is charged.
 * Read-only; never throws for ordinary "unavailable" cases.
 */
export const quoteStay = action({
  args: {
    propertyId: v.id("properties"),
    checkIn: v.string(),
    checkOut: v.string(),
    guests: v.optional(v.number()),
  },
  handler: async (ctx, a): Promise<any> => {
    const c = await ctx.runQuery(internal.rentalCheckout.loadContext, { propertyId: a.propertyId });
    const listingId = c?.property.hostawayId;
    if (!listingId) return { ok: false, reason: "Pricing is not available for this villa." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(a.checkOut) || a.checkOut <= a.checkIn)
      return { ok: false, reason: "Choose valid dates." };
    const token = await getToken(ctx);
    const avail = await hostawayAvailable(token, listingId, a.checkIn, a.checkOut);
    if (!avail.ok) return { ok: false, reason: avail.reason };
    const guests = Math.max(1, Math.min(a.guests ?? 2, c.property.sleeps ?? 99));
    try {
      const q = await hostawayQuote(token, listingId, a.checkIn, a.checkOut, guests);
      return { ok: true, ...q };
    } catch (e: any) {
      return { ok: false, reason: e?.message ?? "Could not price these dates." };
    }
  },
});

// ───────────────────────── public: start ─────────────────────────

export const startCheckout = action({
  args: {
    propertyId: v.id("properties"),
    checkIn: v.string(),
    checkOut: v.string(),
    guests: v.number(),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, a): Promise<any> => {
    const c = await ctx.runQuery(internal.rentalCheckout.loadContext, { propertyId: a.propertyId });
    if (!c) throw new Error("Property not found.");
    const listingId = c.property.hostawayId;
    if (!listingId) throw new Error("This property is not connected to HostAway.");
    const keys = accountKeys(c.account);
    if (!keys.configured) throw new Error("Online payment is not connected yet.");
    if (keys.mode === "live" && !c.settings.scheduleConfirmed) {
      throw new Error("The payment schedule has not been confirmed yet.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(a.checkOut))
      throw new Error("Invalid dates.");
    if (a.checkIn < todayET()) throw new Error("Check-in date has passed.");
    if (a.checkOut <= a.checkIn) throw new Error("Check-out must be after check-in.");
    if (!(a.guests >= 1) || (c.property.sleeps && a.guests > c.property.sleeps))
      throw new Error(`This villa sleeps up to ${c.property.sleeps} guests.`);
    if (!/^\S+@\S+\.\S+$/.test(a.email)) throw new Error("Enter a valid email address.");

    if (await ctx.runQuery(internal.rentalCheckout.hasLocalConflict, {
        propertyId: a.propertyId,
        checkIn: a.checkIn,
        checkOut: a.checkOut,
      })) {
      throw new Error("These dates are no longer available.");
    }
    const token = await getToken(ctx);
    const avail = await hostawayAvailable(token, listingId, a.checkIn, a.checkOut);
    if (!avail.ok) throw new Error(avail.reason);
    const quote = await hostawayQuote(token, listingId, a.checkIn, a.checkOut, a.guests);
    const policyId = await hostawayPolicyId(token, listingId);
    const plan = planCharges(quote.totalCents, a.checkIn, todayET(), c.settings.schedule);
    const chargeMode = c.settings.chargeMode;

    const now = Date.now();
    const sessionId: Id<"checkoutSessions"> = await ctx.runMutation(
      internal.rentalCheckout.insertSession,
      {
        doc: {
          propertyId: a.propertyId,
          checkIn: a.checkIn,
          checkOut: a.checkOut,
          guests: a.guests,
          firstName: a.firstName.trim(),
          lastName: a.lastName.trim(),
          email: a.email.trim().toLowerCase(),
          phone: a.phone,
          notes: a.notes,
          account: c.account,
          stripeMode: keys.mode,
          chargeMode,
          totalCents: quote.totalCents,
          dueNowCents: plan.dueNowCents,
          quote: quote.components,
          charges: plan.charges,
          cancellationPolicyId: policyId ?? undefined,
          status: "awaiting_payment",
          createdAt: now,
          updatedAt: now,
        },
      }
    );

    const metadata = {
      checkout_session: sessionId,
      property: c.property.address,
      hostaway_listing: String(listingId),
      check_in: a.checkIn,
      check_out: a.checkOut,
      guests: String(a.guests),
      source: "website",
    };
    const customer = await stripe(keys.secret!, "POST", "/customers", {
      email: a.email.trim().toLowerCase(),
      name: `${a.firstName.trim()} ${a.lastName.trim()}`,
      phone: a.phone,
      metadata,
    }, `cus-${sessionId}`);

    const description = `${c.property.address}, ${a.checkIn} to ${a.checkOut}`;
    let intent: any;
    if (chargeMode === "card_capture") {
      intent = await stripe(keys.secret!, "POST", "/payment_intents", {
        amount: plan.dueNowCents,
        currency: "usd",
        customer: customer.id,
        capture_method: "manual",
        // Saved for the later installments.
        setup_future_usage: plan.charges.length > 1 ? "off_session" : undefined,
        payment_method_types: ["card"],
        description,
        receipt_email: a.email.trim().toLowerCase(),
        metadata,
      }, `pi-${sessionId}`);
    } else {
      intent = await stripe(keys.secret!, "POST", "/setup_intents", {
        customer: customer.id,
        usage: "off_session",
        payment_method_types: ["card"],
        description,
        metadata,
      }, `si-${sessionId}`);
    }
    await ctx.runMutation(internal.rentalCheckout.patchSession, {
      sessionId,
      patch: { stripeCustomerId: customer.id, stripeIntentId: intent.id },
    });

    return {
      sessionId,
      clientSecret: intent.client_secret as string,
      publishableKey: keys.publishable!,
      intentType: chargeMode === "card_capture" ? "payment" : "setup",
      mode: keys.mode,
      totalCents: quote.totalCents,
      dueNowCents: plan.dueNowCents,
      components: quote.components,
      charges: plan.charges,
      policy: cancellationPolicyText(policyId),
    };
  },
});

// ───────────────────────── public: finalize ─────────────────────────

/**
 * HostAway reservation create. ⚠ Gated (HOSTAWAY_WRITES_ENABLED + live key).
 *
 * channelId: HostAway only accepts 2000 (direct), 2002 (homeaway) or 2020
 * (partner) on create — 2013 (bookingengine) is rejected with "Wrong channel
 * ID". That bug failed Justin's first live test on 2026-10-16. We use 2000.
 *
 * Card hand-off: there is no card field on the reservation object. The
 * documented route is POST /v1/paymentCards/{reservationId}/addPaymentMethodId
 * with the Stripe PaymentMethod id (saved to the customer via
 * setup_future_usage=off_session, same Stripe account HostAway charges from).
 */
/**
 * HostAway parses phones as international. "(843) 298-2494" went in as
 * +8432982494 and showed as a Vietnam (+84) number [justin, 2026-10-16].
 * Send E.164; bare 10-digit (or 1+10) numbers are US/Canada.
 */
export function toE164(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return undefined;
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

/** Exported for transport-level tests; not a callable Convex function. */
export async function createHostawayReservation(token: string, s: any, listingId: number) {
  const res = await fetch(`${HOSTAWAY_API}/reservations?forceOverbooking=0`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      channelId: 2000, // direct — the only sensible create channel for our own site
      listingMapId: listingId,
      arrivalDate: s.checkIn,
      departureDate: s.checkOut,
      guestFirstName: s.firstName,
      guestLastName: s.lastName,
      guestName: `${s.firstName} ${s.lastName}`,
      guestEmail: s.email,
      phone: toE164(s.phone),
      numberOfGuests: s.guests,
      totalPrice: s.totalCents / 100,
      currency: "USD",
      // Special Requests belongs in Guest Notes. Hostaway's generic comment
      // field is not the reservation note or an Inbox conversation.
      guestNote: s.notes?.trim() || undefined,
      comment: `Booked online at ${s.site ?? "our website"}; ${s.chargeMode === "card_on_file" ? "card saved via website; Hostaway manages installment charges." : "first installment charged via website Stripe checkout."}${s.notes ? " Guest note: " + s.notes : ""}`,
      stripeGuestId: s.stripeCustomerId,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.status !== "success") {
    throw new Error(`HostAway reservation failed: ${data?.message ?? res.status}`);
  }
  return Number(data.result?.id);
}

/** Attach the saved Stripe card to the HostAway reservation. Never throws. */
async function attachHostawayCard(token: string, reservationId: number, paymentMethodId: string | null) {
  if (!paymentMethodId) return "no payment method on the intent";
  try {
    const res = await fetch(`${HOSTAWAY_API}/paymentCards/${reservationId}/addPaymentMethodId`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethodId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.status !== "success") return `card attach failed: ${data?.message ?? res.status}`;
    return null;
  } catch (e: any) {
    return `card attach failed: ${String(e?.message ?? e)}`;
  }
}

export const finalizeCheckout = action({
  args: { sessionId: v.id("checkoutSessions") },
  handler: async (ctx, { sessionId }): Promise<any> => {
    const s: any = await ctx.runQuery(internal.rentalCheckout.getSession, { sessionId });
    if (!s) throw new Error("Checkout session not found.");
    if (s.status === "confirmed") return { status: "confirmed", bookingId: s.bookingId };
    if (s.status !== "awaiting_payment") return { status: s.status, error: s.error };

    const keys = accountKeys(s.account);
    if (!keys.configured) throw new Error("Online payment is not connected.");
    const isPayment = s.chargeMode === "card_capture";

    // 1. The card step really happened (never trust the browser's word).
    const intent = await stripe(
      keys.secret!,
      "GET",
      `/${isPayment ? "payment_intents" : "setup_intents"}/${s.stripeIntentId}`
    );
    const authorized = isPayment
      ? intent.status === "requires_capture" && intent.amount === s.dueNowCents
      : intent.status === "succeeded";
    if (!authorized) {
      return { status: "awaiting_payment", error: "Payment has not been authorized yet." };
    }
    const paymentMethodId: string | null =
      typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id ?? null;

    const voidAuth = async () => {
      if (isPayment) {
        await stripe(keys.secret!, "POST", `/payment_intents/${s.stripeIntentId}/cancel`, {
          cancellation_reason: "abandoned",
        }).catch(() => null);
      }
    };

    // 2. Still available in HostAway (another channel may have booked it).
    const ctxProp = await ctx.runQuery(internal.rentalCheckout.loadContext, { propertyId: s.propertyId });
    const listingId = ctxProp?.property.hostawayId;
    const token = await getToken(ctx);
    const avail = listingId
      ? await hostawayAvailable(token, listingId, s.checkIn, s.checkOut)
      : { ok: false, reason: "Property is not connected to HostAway." };
    if (!avail.ok) {
      await voidAuth();
      await ctx.runMutation(internal.rentalCheckout.patchSession, {
        sessionId,
        patch: { status: "dates_lost", error: avail.reason },
      });
      return { status: "dates_lost", error: avail.reason };
    }

    // 3. Hold the dates (atomic; loses to anyone who claimed first).
    const claim: any = await ctx.runMutation(internal.rentalCheckout.claimDates, { sessionId });
    if (!claim.ok) {
      await voidAuth();
      const error = "Someone else just booked these dates.";
      await ctx.runMutation(internal.rentalCheckout.patchSession, {
        sessionId,
        patch: { status: "dates_lost", error },
      });
      return { status: "dates_lost", error };
    }

    // 4. HostAway reservation (gated until go-live; never in test mode).
    let hostawayWrite: "held_prelaunch" | "created" = "held_prelaunch";
    let reservationId: number | undefined;
    if (HOSTAWAY_WRITES_ENABLED && s.stripeMode === "live") {
      try {
        reservationId = await createHostawayReservation(token, s, listingId!);
        hostawayWrite = "created";
        const attachErr = await attachHostawayCard(token, reservationId, paymentMethodId);
        if (attachErr) {
          console.error(`[checkout ${sessionId}] HostAway reservation ${reservationId}: ${attachErr}`);
          await ctx.runMutation(internal.rentalCheckout.patchSession, {
            sessionId,
            patch: { error: `Reservation ${reservationId} created; ${attachErr} — add card in HostAway manually` },
          });
        }
      } catch (e: any) {
        await voidAuth();
        await ctx.runMutation(internal.rentalCheckout.releaseDates, {
          sessionId,
          status: "failed",
          error: String(e?.message ?? e),
        });
        return { status: "failed", error: "We could not complete the reservation. Your card was not charged." };
      }
    }

    // 5. Capture the first installment.
    if (isPayment) {
      try {
        await stripe(keys.secret!, "POST", `/payment_intents/${s.stripeIntentId}/capture`, {}, `cap-${sessionId}`);
      } catch (e: any) {
        await ctx.runMutation(internal.rentalCheckout.releaseDates, {
          sessionId,
          status: "failed",
          error:
            `Capture failed: ${String(e?.message ?? e)}` +
            (reservationId ? ` — HostAway reservation ${reservationId} needs manual cancel` : ""),
        });
        return { status: "failed", error: "Your card could not be charged. Please try another card." };
      }
    }

    await ctx.runMutation(internal.rentalCheckout.markConfirmed, {
      sessionId,
      hostawayWrite,
      hostawayReservationId: reservationId,
    });
    return { status: "confirmed", bookingId: claim.bookingId };
  },
});

// ───────────────────────── admin ─────────────────────────

export const adminOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const settings = await readSettings(ctx);
    const accounts = (Object.keys(STRIPE_ACCOUNTS) as StripeAccountKey[]).map((k) => {
      const keys = accountKeys(k);
      return {
        key: k,
        label: STRIPE_ACCOUNTS[k].label,
        configured: keys.configured,
        mode: keys.mode,
        hasSecret: !!keys.secret,
        hasPublishable: !!keys.publishable,
      };
    });
    const props = (await ctx.db.query("properties").collect()).filter(
      (p: any) => p.hostawayId && p.isActive !== false
    );
    const routing = [];
    for (const p of props) {
      const slug = await communitySlugOf(ctx, p);
      const def = defaultAccountFor(slug);
      const override = settings.accountOverrides.find((o) => o.propertyId === p._id);
      routing.push({
        propertyId: p._id,
        address: p.address ?? p.slug,
        community: (p as any).communityName ?? slug ?? "",
        defaultAccount: def,
        account: override?.account ?? def,
        overridden: !!override,
      });
    }
    routing.sort((a, b) => a.address.localeCompare(b.address));
    const sessions = (await ctx.db.query("checkoutSessions").order("desc").take(25)).map((s: any) => ({
      _id: s._id,
      createdAt: s.createdAt,
      guest: `${s.firstName} ${s.lastName}`,
      email: s.email,
      propertyAddress: props.find((p: any) => p._id === s.propertyId)?.address ?? "",
      checkIn: s.checkIn,
      checkOut: s.checkOut,
      totalCents: s.totalCents,
      dueNowCents: s.dueNowCents,
      account: s.account,
      stripeMode: s.stripeMode,
      status: s.status,
      hostawayWrite: s.hostawayWrite ?? null,
      error: s.error ?? null,
    }));
    return {
      settings: {
        schedule: settings.schedule,
        scheduleConfirmed: settings.scheduleConfirmed,
        chargeMode: settings.chargeMode,
      },
      scheduleError: validateSchedule(settings.schedule),
      accounts,
      hostawayWritesEnabled: HOSTAWAY_WRITES_ENABLED,
      routing,
      sessions,
    };
  },
});

const installmentV = v.object({
  label: v.string(),
  pct: v.number(),
  daysBefore: v.union(v.number(), v.null()),
});

async function upsertSettings(ctx: any, patch: Partial<Settings>, who?: string) {
  const row = await ctx.db
    .query("paymentSettings")
    .withIndex("by_key", (q: any) => q.eq("key", "default"))
    .unique();
  const current = await readSettings(ctx);
  const next = { ...current, ...patch, updatedAt: Date.now(), updatedBy: who };
  if (row) await ctx.db.patch(row._id, next);
  else await ctx.db.insert("paymentSettings", { key: "default", ...next });
}

export const saveSchedule = mutation({
  args: {
    schedule: v.array(installmentV),
    scheduleConfirmed: v.boolean(),
    chargeMode: v.union(v.literal("card_capture"), v.literal("card_on_file")),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const err = validateSchedule(args.schedule);
    if (err) throw new Error(err);
    await upsertSettings(ctx, args, admin.email ?? admin.displayName);
  },
});

export const setAccountOverride = mutation({
  args: {
    propertyId: v.id("properties"),
    account: v.union(v.literal("heritage"), v.literal("seapines"), v.null()),
  },
  handler: async (ctx, { propertyId, account }) => {
    const admin = await requireAdmin(ctx);
    const current = await readSettings(ctx);
    const rest = current.accountOverrides.filter((o) => o.propertyId !== propertyId);
    const property = await ctx.db.get(propertyId);
    if (!property) throw new Error("Property not found");
    const def = defaultAccountFor(await communitySlugOf(ctx, property));
    const accountOverrides =
      account && account !== def ? [...rest, { propertyId, account }] : rest;
    await upsertSettings(ctx, { accountOverrides }, admin.email ?? admin.displayName);
  },
});

/** Dry-run the math for the admin screen / CLI checks (no Stripe, no HostAway). */
export const previewPlan = query({
  args: { totalCents: v.number(), checkIn: v.string(), today: v.optional(v.string()) },
  handler: async (ctx, { totalCents, checkIn, today }) => {
    const settings = await readSettings(ctx);
    return planCharges(totalCents, checkIn, today ?? todayET(), settings.schedule);
  },
});

/**
 * CLI check of everything before Stripe: live availability, HostAway quote,
 * policy and the installment plan. `npx convex run rentalCheckout:dryRun '{...}'`
 */
export const dryRun = internalAction({
  args: { propertyId: v.id("properties"), checkIn: v.string(), checkOut: v.string(), guests: v.number() },
  handler: async (ctx, a): Promise<any> => {
    const c = await ctx.runQuery(internal.rentalCheckout.loadContext, { propertyId: a.propertyId });
    if (!c?.property.hostawayId) return { error: "no hostawayId" };
    const token = await getToken(ctx);
    const avail = await hostawayAvailable(token, c.property.hostawayId, a.checkIn, a.checkOut);
    const quote = avail.ok
      ? await hostawayQuote(token, c.property.hostawayId, a.checkIn, a.checkOut, a.guests)
      : null;
    const policyId = await hostawayPolicyId(token, c.property.hostawayId);
    return {
      property: c.property.address,
      account: c.account,
      keys: accountKeys(c.account).configured,
      avail,
      quote,
      policy: cancellationPolicyText(policyId),
      plan: quote ? planCharges(quote.totalCents, a.checkIn, todayET(), c.settings.schedule) : null,
    };
  },
});

/** One-off ops switch (CLI only): `npx convex run rentalCheckout:setChargeMode '{"chargeMode":"card_on_file"}'`. */
export const setChargeMode = internalMutation({
  args: { chargeMode: v.union(v.literal("card_capture"), v.literal("card_on_file")) },
  handler: async (ctx, { chargeMode }) => {
    await upsertSettings(ctx, { chargeMode }, "viktor (cli)");
  },
});
