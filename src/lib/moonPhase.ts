import { MoonPhase } from "astronomy-engine";

const PHASE_NAMES = [
  "New moon", "Waxing crescent", "First quarter", "Waxing gibbous",
  "Full moon", "Waning gibbous", "Last quarter", "Waning crescent",
] as const;

/** Eight conventional phase names, centered on each principal lunar phase. */
export function phaseName(angle: number) {
  const normalized = ((angle % 360) + 360) % 360;
  return PHASE_NAMES[Math.floor((normalized + 22.5) / 45) % 8];
}

/** Geocentric Sun-Moon longitude angle; no network or browser-location dependency. */
export function currentMoonPhase(now: Date) {
  const angle = MoonPhase(now);
  return { angle, name: phaseName(angle) };
}

/** Northern Hemisphere view: waxing light is on the right, waning on the left. */
export function moonIconPath(angle: number) {
  const waxing = angle < 180;
  const cosine = Math.cos(angle * Math.PI / 180);
  const radius = Math.abs(cosine) * 10;
  const outer = waxing ? 1 : 0;
  const inner = cosine >= 0 ? 1 - outer : outer;
  return `M12 2 A10 10 0 0 ${outer} 12 22 A${Math.max(radius, 0.001)} 10 0 0 ${inner} 12 2 Z`;
}
