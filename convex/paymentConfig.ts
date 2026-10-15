/**
 * Rental checkout configuration — pure helpers shared by queries, mutations
 * and actions. No Convex runtime imports here.
 *
 * Decisions this encodes (Club Group via Scott, #hilton-head-timeshare):
 *  - D1 pay-first: dates are held only once payment is authorized.
 *  - D2 cancellation: publish the 60/30 rule ("Firm" in HostAway, 81 of 82
 *    listings). 48 Night Heron keeps "Strict" on purpose [justin, 2026-10-07].
 *  - D3 deposits follow HostAway's payment schedule. Confirmed split
 *    [justin, 2026-10-10]: 55% at booking / 30% 14 days out / 15% 7 days out.
 *    Still an admin SETTING with a "confirmed" flag (default true now);
 *    live-mode checkout refuses to run if an admin un-confirms it.
 *  - Two Stripe accounts [justin, 2026-10-07]: Swallowtail + Spicebush in one,
 *    the other ("Saturday") properties in the other. Routing is by community
 *    with a per-property override.
 */

export type StripeAccountKey = "heritage" | "seapines";

export const STRIPE_ACCOUNTS: Record<
  StripeAccountKey,
  { label: string; secretEnv: string; publishableEnv: string }
> = {
  heritage: {
    label: "Heritage Vacations of Hilton Head (Saturday properties)",
    secretEnv: "STRIPE_HERITAGE_SECRET_KEY",
    publishableEnv: "STRIPE_HERITAGE_PUBLISHABLE_KEY",
  },
  seapines: {
    label: "Swallowtail & Spicebush",
    secretEnv: "STRIPE_SEAPINES_SECRET_KEY",
    publishableEnv: "STRIPE_SEAPINES_PUBLISHABLE_KEY",
  },
};

/** Community slugs whose rentals settle into the Swallowtail/Spicebush account. */
export const SEAPINES_COMMUNITY_SLUGS = new Set([
  "swallowtail-at-sea-pines",
  "swallowtail",
  "spicebush",
  "spicebush-at-sea-pines",
]);

export function defaultAccountFor(communitySlug?: string | null): StripeAccountKey {
  return communitySlug && SEAPINES_COMMUNITY_SLUGS.has(communitySlug)
    ? "seapines"
    : "heritage";
}

export type Installment = {
  label: string;
  pct: number;
  /** null = due at booking; N = due N days before check-in. */
  daysBefore: number | null;
};

/** Placeholder until Justin confirms — his figures summed to 110%. */
export const DEFAULT_SCHEDULE: Installment[] = [
  { label: "Due at booking", pct: 55, daysBefore: null },
  { label: "Due 14 days before check-in", pct: 30, daysBefore: 14 },
  { label: "Due 7 days before check-in", pct: 15, daysBefore: 7 },
];

/**
 * "card_capture": we authorize the first installment, capture it once the
 *   reservation exists, and save the card for the later installments.
 * "card_on_file": we only verify and save the card (SetupIntent); HostAway
 *   charges every installment itself. Use this if the test booking shows
 *   HostAway re-charges money we already took.
 */
export type ChargeMode = "card_capture" | "card_on_file";

export function validateSchedule(schedule: Installment[]): string | null {
  if (schedule.length === 0) return "Add at least one installment.";
  const atBooking = schedule.filter((s) => s.daysBefore === null);
  if (atBooking.length !== 1) return "Exactly one installment must be due at booking.";
  for (const s of schedule) {
    if (!(s.pct > 0 && s.pct <= 100)) return "Each installment must be between 1% and 100%.";
    if (s.daysBefore !== null && !(s.daysBefore >= 1 && s.daysBefore <= 365))
      return "Days before check-in must be between 1 and 365.";
  }
  const total = Math.round(schedule.reduce((a, s) => a + s.pct, 0) * 100) / 100;
  if (total !== 100) return `Installments add up to ${total}%, not 100%.`;
  return null;
}

export type PlannedCharge = {
  label: string;
  amountCents: number;
  /** ISO date (YYYY-MM-DD); null = charged now. */
  dueDate: string | null;
};

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Split a total into what is charged now and what HostAway charges later.
 * Any installment whose due date has already arrived (a booking made inside
 * 14 or 7 days) folds into "now", which is how HostAway handles late bookings.
 * The last charge absorbs rounding so the parts always sum to the total.
 */
export function planCharges(
  totalCents: number,
  checkIn: string,
  today: string,
  schedule: Installment[]
): { dueNowCents: number; charges: PlannedCharge[] } {
  const raw = schedule.map((s) => ({
    label: s.label,
    cents: Math.round((totalCents * s.pct) / 100),
    dueDate: s.daysBefore === null ? null : addDays(checkIn, -s.daysBefore),
  }));
  const drift = totalCents - raw.reduce((a, r) => a + r.cents, 0);
  raw[raw.length - 1].cents += drift;

  let dueNowCents = 0;
  const later: PlannedCharge[] = [];
  for (const r of raw) {
    if (r.dueDate === null || r.dueDate <= today) dueNowCents += r.cents;
    else later.push({ label: r.label, amountCents: r.cents, dueDate: r.dueDate });
  }
  later.sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
  return {
    dueNowCents,
    charges: [{ label: "Due today", amountCents: dueNowCents, dueDate: null }, ...later],
  };
}

/** HostAway cancellation policy ids on account 153173 [hostaway api, 2026-10-07]. */
export const POLICY_FIRM = 614465;
export const POLICY_STRICT = 614466;

export function cancellationPolicyText(policyId?: number | null): string[] {
  const common = [
    "All cancellations must be submitted in writing.",
    "Any refund issued will be less applicable payment processing fees.",
  ];
  if (policyId === POLICY_STRICT) {
    return [
      "100% refund if you cancel 60 days or more before arrival.",
      "No refund for cancellations made within 60 days of arrival.",
      ...common,
    ];
  }
  return [
    "100% refund if you cancel 60 days or more before arrival.",
    "50% refund if you cancel 30 to 59 days before arrival.",
    "No refund for cancellations made within 30 days of arrival.",
    ...common,
  ];
}

export function stripeModeFromKey(key?: string): "test" | "live" | null {
  if (!key) return null;
  if (/^(sk|rk)_test_/.test(key)) return "test";
  if (/^(sk|rk)_live_/.test(key)) return "live";
  return null;
}
