import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { groupedOwnership, matchesOwnerSearch } from "../convex/ownerOwnership";
import { OwnerOwnershipSummary } from "../src/components/admin/OwnerOwnershipSummary";

const holding = (sourceResort = "Spicebush", unitNumber = "578", weekNumber: number | undefined = 44) => ({
  sourceResort, communitySlug: sourceResort.toLowerCase(), unitNumber, weekNumber,
  sourceUnitWeek: `${unitNumber}-${weekNumber ?? "unknown"}`,
});
const owner = (holdings = [holding()]) => ({ fullName: "Synthetic Example Owner", email: "synthetic@example.test",
  contactEmail: "source@example.test", phone: "+44 20 7000 0000 ext 123", ownershipGroups: groupedOwnership(holdings) });

describe("compact admin ownership projection", () => {
  test("keeps actual source resort, unit and every week associated without inventory inference", () => {
    const groups = groupedOwnership([holding(), holding("Spicebush", "578", 43), holding(), holding("Swallowtail", "578", 4)]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({ propertyName: "Spicebush", communityName: "Spicebush", communitySlug: "spicebush",
      unitNumber: "578", weeks: [43, 44], unresolvedWeeks: [] });
    expect(groups[1].weeks).toEqual([4]);
    expect(groups[0].propertyAddress).toBeUndefined();
  });
  test("legacy owned weeks use properties.address and DB community, deduping across years", () => {
    const groups = groupedOwnership([], [{ propertyId: "p1", weekNumber: 44 }, { propertyId: "p1", weekNumber: 44 },
      { propertyId: "p2", weekNumber: 4 }], [
      { _id: "p1", address: "Synthetic Villa Address", unitNumber: "578", communityId: "c1" },
      { _id: "p2", address: "Another Villa Address", unitNumber: "579", communityId: "c1" },
    ], [{ _id: "c1", name: "DB Resort Label", slug: "db-resort" }]);
    expect(groups[0].propertyName).toBe("Synthetic Villa Address");
    expect(groups[0].propertyAddress).toBe("Synthetic Villa Address");
    expect(groups[0].communityName).toBe("DB Resort Label");
    expect(groups[0].weeks).toEqual([44]);
    expect(matchesOwnerSearch({ fullName: "Legacy", ownershipGroups: groups }, "DB Resort 578 week44")).toBe(true);
    expect(matchesOwnerSearch({ fullName: "Legacy", ownershipGroups: groups }, "Villa Address week44")).toBe(true);
  });
  test("missing week preserves original evidence rather than guessing", () => {
    const h = { ...holding(), weekNumber: undefined, sourceUnitWeek: "578-unresolved" };
    expect(groupedOwnership([h])[0]).toMatchObject({ weeks: [], unresolvedWeeks: ["578-unresolved"] });
  });
});

describe("owner directory search", () => {
  for (const query of ["Spicebush", "SPICEBUSH", "578", "44", "week 44", "week44", "weeks 44", "unit578",
    "Spicebush 578 week 44", " spiceBUSH 578 WEEK44 ", "Synthetic Spicebush week44"]) {
    test(`matches ${query}`, () => expect(matchesOwnerSearch(owner(), query)).toBe(true));
  }
  for (const query of ["week 4", "week4", "unit57", "57", "week578", "Spicebush 578 week 4"]) {
    test(`rejects numeric partial/field mismatch ${query}`, () => expect(matchesOwnerSearch(owner(), query)).toBe(false));
  }
  test("explicit week does not match a unit or contact phone", () => {
    expect(matchesOwnerSearch(owner([holding("Spicebush", "44", 12)]), "week44")).toBe(false);
    expect(matchesOwnerSearch(owner([holding("Spicebush", "44", 12)]), "44")).toBe(true);
  });
  test("combined queries cannot borrow weeks or resort labels from another unit", () => {
    const o = owner([holding("Spicebush", "578", 43), holding("Spicebush", "579", 44), holding("Swallowtail", "800", 4)]);
    expect(matchesOwnerSearch(o, "578 week44")).toBe(false);
    expect(matchesOwnerSearch(o, "Swallowtail 579 week44")).toBe(false);
    expect(matchesOwnerSearch(o, "Spicebush 579 week44")).toBe(true);
  });
  test("existing contact substring searches are unchanged, including formatted phone", () => {
    for (const q of ["example own", "thetic@exam", "source@exam", "7000 0000", "+44 20", "ext 12", ""]) {
      expect(matchesOwnerSearch(owner(), q)).toBe(true);
    }
    expect(matchesOwnerSearch({ fullName: "Contact Only", email: "contact@example.test" }, "tact@")).toBe(true);
  });
  test("search covers every holding, including the last of more than 50 groups", () => {
    const groups = Array.from({ length: 75 }, (_, i) => holding("Spicebush", String(1000 + i), 44));
    expect(matchesOwnerSearch(owner(groups), "1074 week44")).toBe(true);
    const owners = Array.from({ length: 75 }, (_, i) => owner([holding("Spicebush", String(1000 + i))]));
    expect(owners.filter(o => matchesOwnerSearch(o, "1074 week44")).slice(0, 50)).toHaveLength(1);
  });
});

describe("owner-card UI regression (synthetic SSR)", () => {
  test("labels and full week lists render within each unit, including 53 weeks and unknown source records", () => {
    const holdings = Array.from({ length: 53 }, (_, i) => holding("Spicebush", "578", i + 1));
    holdings.push(holding("Swallowtail", "579", 12));
    const groups = groupedOwnership(holdings);
    groups[1].unresolvedWeeks.push("579-unknown");
    const html = renderToStaticMarkup(createElement(OwnerOwnershipSummary, { groups }));
    expect(html).toContain('aria-label="Ownership details"');
    const panels = html.split("<dl").slice(1);
    expect(panels).toHaveLength(2);
    expect(panels[0]).toContain("Property / resort:");
    expect(panels[0]).toContain("Spicebush");
    expect(panels[0]).toContain("578");
    expect(panels[0]).toContain(Array.from({ length: 53 }, (_, i) => i + 1).join(", "));
    expect(panels[0]).not.toContain("579");
    expect(panels[1]).toContain("Swallowtail");
    expect(panels[1]).toContain("579-unknown");
    expect(html).toContain("Weeks owned:");
  });
  test("empty panels explicitly show no records", () => {
    expect(renderToStaticMarkup(createElement(OwnerOwnershipSummary, { groups: [] }))).toContain("No ownership records supplied");
  });
  test("directory filters before pagination, preserves review states and all resort filters", () => {
    const source = readFileSync(new URL("../src/pages/admin/OwnersPage.tsx", import.meta.url), "utf8");
    expect(source).toContain("return matchesOwnerSearch(o, search)");
    expect(source).toContain("<OwnerOwnershipSummary groups={owner.ownershipGroups ?? []} />");
    expect(source).toContain("filteredOwners?.slice(0, visibleCount)");
    expect(source).toContain("!o.rosterResorts.includes(resortFilter)");
    expect(source).toContain("Invitations disabled.");
    expect(source).toContain("Source contact:");
    expect(source).toContain("Show 50 more owners");
  });
});

test("source-style numeric unit-week pairs remain scoped to the same group", () => {
  expect(matchesOwnerSearch(owner(), "578-44")).toBe(true);
  expect(matchesOwnerSearch(owner([holding("Spicebush", "578", 43), holding("Spicebush", "579", 44)]), "578-44")).toBe(false);
  expect(matchesOwnerSearch(owner(), "unit 578 week 44")).toBe(true);
});

test("combined ownership numbers cannot borrow contact phone digits", () => {
  const o = { ...owner([holding("Spicebush", "579", 44)]), phone: "578 555 0100" };
  expect(matchesOwnerSearch(o, "578 week44")).toBe(false);
  expect(matchesOwnerSearch(o, "578-44")).toBe(false);
  expect(matchesOwnerSearch(o, "578 555")).toBe(true);
});
