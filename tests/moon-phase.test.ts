import { expect, test } from "bun:test";
import { currentMoonPhase, phaseName, moonIconPath } from "../src/lib/moonPhase";

test("all eight lunar phase names and wraparound", () => {
  expect([0,45,90,135,180,225,270,315].map(phaseName)).toEqual([
    "New moon","Waxing crescent","First quarter","Waxing gibbous",
    "Full moon","Waning gibbous","Last quarter","Waning crescent",
  ]);
  expect(phaseName(359)).toBe("New moon");
  expect(phaseName(360)).toBe("New moon");
  expect(phaseName(-45)).toBe("Waning crescent");
  expect(phaseName(22.49)).toBe("New moon");
  expect(phaseName(22.5)).toBe("Waxing crescent");
});

test("calculated angles agree with US Naval Observatory October 2026 phases", () => {
  // https://aa.usno.navy.mil/api/moon/phases/date?date=2026-10-01&nump=8
  for (const [at, target, name] of [
    ["2026-10-10T15:50:00Z", 0, "New moon"],
    ["2026-10-18T16:12:00Z", 90, "First quarter"],
    ["2026-10-26T04:12:00Z", 180, "Full moon"],
    ["2026-11-01T20:28:00Z", 270, "Last quarter"],
  ] as const) {
    const phase = currentMoonPhase(new Date(at));
    const error = Math.abs(((phase.angle - target + 540) % 360) - 180);
    expect(error).toBeLessThan(0.1);
    expect(phase.name).toBe(name);
  }
  expect(currentMoonPhase(new Date("2026-10-30T00:00:00Z")).name).toBe("Waning gibbous");
});

test("phase changes across the cycle and icons stay finite at quarter moons", () => {
  expect(currentMoonPhase(new Date("2026-10-14T12:00:00Z")).name).toBe("Waxing crescent");
  expect(currentMoonPhase(new Date("2026-11-05T12:00:00Z")).name).toBe("Waning crescent");
  for (const angle of [0,45,90,135,180,225,270,315,359]) {
    expect(moonIconPath(angle)).not.toContain("NaN");
    expect(moonIconPath(angle)).toEndWith("Z");
  }
});
