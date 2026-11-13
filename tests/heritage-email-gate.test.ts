import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { GO_LIVE, HOSTAWAY_WRITES_ENABLED, isEmailHeld, type EmailKind } from "../convex/goLive";

const kinds: EmailKind[] = ["inquiry", "inquiry_reply", "marketplace_match", "owner_invite", "password_reset"];
const sites = ["heritage", "mhht", "swallowtail", "spicebush", "unknown", "", undefined, "Heritage", "heritagevacations.com"];
describe("Heritage-only notification launch", () => {
  for (const kind of kinds) {
    for (const site of sites) {
      test(`${kind} for ${String(site)}`, () => {
        const authMail = kind === "owner_invite" || kind === "password_reset";
        const launchedNotification = site === "heritage" && (kind === "inquiry" || kind === "inquiry_reply");
        expect(isEmailHeld(kind, site)).toBe(!(authMail || launchedNotification));
      });
    }
  }
  test("does not flip global email or Hostaway write configuration", () => {
    expect(GO_LIVE).toBe(false);
    expect(HOSTAWAY_WRITES_ENABLED).toBe(true);
  });
  test("notification sender forwards site scope and reply scope comes from stored inquiry", () => {
    const source = (name: string) => readFileSync(new URL(`../convex/${name}.ts`, import.meta.url), "utf8");
    expect(source("inquiries")).toContain('isEmailHeld("inquiry", args.siteSlug)');
    expect(source("inquiryReplies")).toContain("siteSlug: inquiry.siteSlug");
    expect(source("inquiryReplies")).toContain('isEmailHeld("inquiry_reply", args.siteSlug)');
    expect(source("rentalCheckout")).toContain('chargeMode: "card_on_file"');
  });
});
