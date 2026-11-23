import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import {
  SharedOwnershipNotice,
  type OwnerOfRecordGroup,
} from "../src/components/owner/SharedOwnershipNotice";

const exactNotice = "If you would like to separate these units into individual accounts, please contact The Club Group. A secondary email will be required to separate the accounts.";
// Entirely synthetic: never copy production owner/contact records into UI tests.
const groups: OwnerOfRecordGroup[] = [
  { ownerOfRecord: "Synthetic First Owner", sourceResort: "Swallowtail", communitySlug: "swallowtail",
    unitNumber: "TEST-A", weeks: [12, 13], unresolvedWeeks: [] },
  { ownerOfRecord: "Synthetic Second Trust", sourceResort: "Swallowtail", communitySlug: "swallowtail",
    unitNumber: "TEST-A", weeks: [12], unresolvedWeeks: [] },
  { ownerOfRecord: "Synthetic Third Owner", sourceResort: "Spicebush", communitySlug: "spicebush",
    unitNumber: "TEST-B", weeks: [53], unresolvedWeeks: ["TEST-B-unresolved"] },
];
const render = (isSharedAccount = true, ownerOfRecordGroups = groups) =>
  renderToStaticMarkup(createElement(SharedOwnershipNotice, { isSharedAccount, ownerOfRecordGroups }));

describe("shared ownership notice (synthetic render)", () => {
  test("uses explicit red text on a light background with a labeled semantic panel", () => {
    const html = render();
    expect(html).toContain('aria-label="Shared account ownership"');
    expect(html).toContain("text-red-800");
    expect(html).toContain("bg-red-50");
    expect(html).not.toContain("text-foreground");
    expect(html).not.toContain("text-muted-foreground");
    expect(html).toContain("Owner of record:");
  });

  test("renders the exact approved separation notice once per panel", () => {
    expect(render().split(exactNotice)).toHaveLength(2);
  });

  test("keeps distinct owner labels for overlapping resort/unit/weeks without collapsing them", () => {
    const lines = render().match(/<li>.*?<\/li>/g) ?? [];
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Synthetic First Owner · Swallowtail · Unit TEST-A · Weeks: 12, 13");
    expect(lines[0]).not.toContain("Synthetic Second Trust");
    expect(lines[1]).toContain("Synthetic Second Trust · Swallowtail · Unit TEST-A · Weeks: 12");
    expect(lines[1]).not.toContain("12, 13");
    expect(lines[2]).toContain("Synthetic Third Owner · Spicebush · Unit TEST-B · Weeks: 53");
    expect(lines[2]).toContain("Source records (week not specified): TEST-B-unresolved");
  });

  test("retains unknown week evidence without guessing", () => {
    const html = render(true, [{ ...groups[0], weeks: [], unresolvedWeeks: ["TEST-A-unknown"] }]);
    expect(html).toContain("Weeks: Not specified");
    expect(html).toContain("TEST-A-unknown");
  });

  test("ordinary profiles show no panel even if groups are present", () => {
    expect(render(false)).toBe("");
    expect(renderToStaticMarkup(createElement(SharedOwnershipNotice, {}))).toBe("");
  });

  test("a flagged account still shows the separation instruction if no groups have arrived", () => {
    expect(render(true, [])).toContain(exactNotice);
  });

  test("owner labels are rendered as text, not HTML", () => {
    const html = render(true, [{ ...groups[0], ownerOfRecord: "<script>synthetic</script>" }]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("signed-in ownership notice integration", () => {
  for (const path of ["owner/PropertiesPage.tsx", "owner/AccountPage.tsx", "admin/OwnersPage.tsx", "admin/OwnerDetailPage.tsx"]) {
    test(`notice is wired into ${path}`, () => {
      const source = readFileSync(new URL(`../src/pages/${path}`, import.meta.url), "utf8");
      expect(source).toContain("<SharedOwnershipNotice");
      if (path.startsWith("owner/")) expect(source).toContain("api.ownerRoster.myHoldings");
    });
  }
  test("dashboard points to the full unit/week notice without duplicating account copy", () => {
    const source = readFileSync(new URL("../src/pages/owner/DashboardPage.tsx", import.meta.url), "utf8");
    expect(source).toContain('to="/owner/properties"');
    expect(source).toContain("View owners of record for each unit and week");
    expect(source).toContain("?.isSharedAccount");
    expect(source).not.toContain(exactNotice);
  });
});
