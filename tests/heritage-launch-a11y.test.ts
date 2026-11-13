import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { slugForHostname, publicSiteHrefForHostname } from "../src/lib/siteHosts";

const source = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
describe("Heritage portal hostname", () => {
  test("resolves Heritage synchronously, including normalized hosts", () => {
    for (const host of ["portal.heritagevacations.com", "PORTAL.HERITAGEVACATIONS.COM:443"]) {
      expect(slugForHostname(host)).toBe("heritage");
      expect(publicSiteHrefForHostname(host)).toBe("https://heritagevacations.com");
    }
    expect(source("convex/sites.ts")).toContain('"portal.heritagevacations.com"');
  });
  test("does not change public site links on other hosts", () => {
    for (const host of ["heritagevacations.com", "hv.lead-works.com", "swallowtail.lead-works.com", "localhost"]) {
      expect(publicSiteHrefForHostname(host)).toBe("/");
    }
  });
});
describe("launch accessibility regressions", () => {
  test("both reused date pickers have accessible names", () => {
    for (const path of ["src/components/search/SearchFilters.tsx", "src/pages/PropertyPage.tsx"]) {
      const text = source(path);
      expect(text).toContain('type="date"');
      expect(text).toContain('aria-label="Check-in"');
      expect(text).toContain('aria-label="Check-out"');
    }
  });
  test("login labels name their exact fields in all modes", () => {
    const text = source("src/pages/admin/LoginPage.tsx");
    for (const field of ["email", "password", "code", "newPassword"]) {
      expect(text).toContain(`htmlFor="admin-${field}"`);
      expect(text).toContain(`id="admin-${field}"`);
    }
  });
  test("checkout guest fields have connected labels without changing booking logic", () => {
    const text = source("src/pages/CheckoutPage.tsx");
    for (const field of ["firstName", "lastName", "email", "phone", "notes", "guests"]) {
      expect(text).toContain(`htmlFor="checkout-${field}"`);
      expect(text).toContain(`id="checkout-${field}"`);
    }
  });
  test("closed contact panel is inert and hidden from assistive technology", () => {
    const text = source("src/components/layout/ContactPanel.tsx");
    expect(text).toContain('inert={!open} aria-hidden={!open}');
    expect(text).toContain('previouslyFocused.focus()');
  });
  test("statement route precedes catch-all and has footer and sitemap homes", () => {
    const app = source("src/App.tsx");
    expect(app.indexOf('path="/accessibility"')).toBeLessThan(app.indexOf('path="/:slug"'));
    expect(source("src/components/layout/HeritageFooter.tsx")).toContain('to="/accessibility"');
    expect(source("convex/http.ts")).toContain('base + "/accessibility"');
    expect(source("src/pages/AccessibilityPage.tsx")).toContain("have not established full conformance");
  });
  test("Heritage CTA keeps brand gold and uses AA dark text", () => {
    const text = source("src/components/home/HeritageHero.tsx");
    const hex = text.match(/const GOLD = "#([a-f0-9]+)"/)![1];
    const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const linear = rgb.map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
    const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    const ink = [0x17, 0x1d, 0x24].map((n) => n / 255).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
    const inkLuminance = ink[0] * 0.2126 + ink[1] * 0.7152 + ink[2] * 0.0722;
    expect(hex).toBe("968751");
    expect(text).toContain('color: "#171d24"');
    expect((luminance + 0.05) / (inkLuminance + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
