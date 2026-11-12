/**
 * Hostaway IDs are identifiers, not quantities. Starting November 23, 2026,
 * payment endpoints return text IDs; other endpoints will follow.
 * Preserve text verbatim and accept only lossless legacy JSON numbers.
 */
export type HostawayId = string | number;

export function hostawayId(value: unknown): string | null {
  if (typeof value === "string" && /^[0-9]+$/.test(value) && /[1-9]/.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  return null;
}

export function requireHostawayId(value: unknown): string {
  const id = hostawayId(value);
  if (id === null) throw new Error("Hostaway returned a missing, invalid, or unsafe numeric ID");
  return id;
}

export function sameHostawayId(left: unknown, right: unknown): boolean {
  const id = hostawayId(left);
  return id !== null && id === hostawayId(right);
}

/** Only for finding existing numeric rows, never for storing new API IDs. */
export function legacyHostawayId(value: string): number | null {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 && String(numeric) === value ? numeric : null;
}
