import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { isResort } from "../src/lib/resort";

describe("beach-day homepage availability", () => {
  test("both Sea Pines resorts receive the shared section", () => {
    expect(isResort("spicebush")).toBe(true);
    expect(isResort("swallowtail")).toBe(true);
    const home = readFileSync(new URL("../src/pages/HomePage.tsx", import.meta.url), "utf8");
    expect(home).toContain("{isResort(siteSlug) && <BeachDayLazy />}");
  });
  test("the flagship sites do not receive the resort section", () => {
    expect(isResort("heritage")).toBe(false);
    expect(isResort("mhht")).toBe(false);
    expect(isResort(undefined)).toBe(false);
  });
});
