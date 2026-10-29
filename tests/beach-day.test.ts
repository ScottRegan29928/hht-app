import { describe, expect, test } from "bun:test";
import { dogRule, eventTime, islandDate, isTurtleSeason, parseTides, tideSummary } from "../src/lib/beachDay";

describe("island-local beach planning", () => {
  test("turtle season is May 1 through October 31 in island time", () => {
    expect(isTurtleSeason(new Date("2026-05-01T03:59:00Z"))).toBe(false);
    expect(isTurtleSeason(new Date("2026-05-01T04:00:00Z"))).toBe(true);
    expect(isTurtleSeason(new Date("2026-11-01T03:59:00Z"))).toBe(true);
    expect(isTurtleSeason(new Date("2026-11-01T04:00:00Z"))).toBe(false);
  });
  test("dates are island-local, including UTC midnight and DST", () => {
    expect(islandDate(new Date("2026-10-30T01:00:00Z"))).toBe("2026-10-29");
    expect(islandDate(new Date("2026-11-02T04:30:00Z"))).toBe("2026-11-01");
  });
  test("May and September boundaries use the actual holidays", () => {
    expect(dogRule(new Date("2026-05-21T16:00:00Z")).title).toBe("Leashes on until 5 PM");
    expect(dogRule(new Date("2026-05-22T16:00:00Z")).title).toBe("Dogs return after 5 PM");
    expect(dogRule(new Date("2026-09-07T16:00:00Z")).title).toBe("Dogs return after 5 PM");
    expect(dogRule(new Date("2026-09-08T16:00:00Z")).title).toBe("Leashes on until 5 PM");
    expect(dogRule(new Date("2027-05-28T16:00:00Z")).title).toBe("Dogs return after 5 PM");
  });
  test("10 AM and 5 PM boundaries, winter, and early morning", () => {
    expect(dogRule(new Date("2026-07-01T13:59:00Z")).title).toBe("Leash or voice control");
    expect(dogRule(new Date("2026-07-01T14:00:00Z")).title).toBe("Dogs return after 5 PM");
    expect(dogRule(new Date("2026-07-01T21:00:00Z")).title).toBe("Leash or voice control");
    expect(dogRule(new Date("2026-10-29T18:00:00Z")).title).toBe("Leash or voice control");
    expect(dogRule(new Date("2026-04-01T16:00:00Z")).title).toBe("Leashes on until 5 PM");
  });
  test("NOAA UTC parsing, predicted direction, tomorrow labels, and stale data", () => {
    const now = new Date("2026-10-29T23:00:00Z");
    const tides = parseTides([
      { t: "2026-10-30 05:30", type: "H" },
      { t: "2026-10-29 22:00", type: "L" },
      { t: "bad", type: "L" },
    ]);
    expect(tides).toHaveLength(2);
    expect(tideSummary(tides, now).direction).toBe("Water on the way in");
    expect(eventTime(tides[1].at, now)).toBe("Tomorrow, 1:30 AM");
    expect(tideSummary([], now).direction).toBeNull();
    expect(tideSummary(tides, new Date("2026-11-01")).high).toBeUndefined();
  });
});


import { parseWeather } from "../src/lib/beachDay";
describe("current weather observations", () => {
  const now = new Date("2026-10-29T22:00:00Z");
  const observation = {
    timestamp: "2026-10-29T21:50:00+00:00", textDescription: "Clear",
    temperature: { value: 21 }, windSpeed: { value: 12.96 },
    windDirection: { value: 80 }, relativeHumidity: { value: 82.99 },
  };
  test("converts official metric observations to guest-friendly units", () => {
    const weather = parseWeather(observation, now);
    expect(weather?.temperature).toBe(70);
    expect(weather?.wind).toBe("E 8 mph");
    expect(weather?.humidity).toBe(83);
  });
  test("rejects stale, future, missing, and invalid temperatures", () => {
    expect(parseWeather(observation, new Date("2026-10-30T00:00:00Z"))).toBeNull();
    expect(parseWeather(observation, new Date("2026-10-29T20:00:00Z"))).toBeNull();
    expect(parseWeather(undefined, now)).toBeNull();
    expect(parseWeather({ ...observation, temperature: { value: null } }, now)).toBeNull();
    expect(parseWeather({ ...observation, timestamp: "bad" }, now)).toBeNull();
  });
  test("keeps zero readings and does not invent missing measurements", () => {
    const weather = parseWeather({ ...observation, temperature: { value: 0 },
      windSpeed: { value: 0 }, relativeHumidity: { value: null } }, now);
    expect(weather?.temperature).toBe(32);
    expect(weather?.wind).toBe("Calm");
    expect(weather?.humidity).toBeNull();
  });
});


test("tide rows follow the next actual event, whether incoming or outgoing", () => {
  const tides = parseTides([
    { t: "2026-10-29 18:00", type: "L" },
    { t: "2026-10-30 00:00", type: "H" },
    { t: "2026-10-30 06:00", type: "L" },
    { t: "2026-10-30 12:00", type: "H" },
  ]);
  const incoming = tideSummary(tides, new Date("2026-10-29T23:00:00Z"));
  expect(incoming.events.map((event) => event.type)).toEqual(["H", "L"]);
  expect(incoming.events[0].at?.toISOString()).toBe("2026-10-30T00:00:00.000Z");
  const outgoing = tideSummary(tides, new Date("2026-10-30T01:00:00Z"));
  expect(outgoing.events.map((event) => event.type)).toEqual(["L", "H"]);
  expect(outgoing.events[0].at?.toISOString()).toBe("2026-10-30T06:00:00.000Z");
});
