import { expect, test } from "bun:test";
import { linkForMode, resolveSearchHref, sisterSiteUrl } from "../src/lib/siteCapabilities";

test("production Heritage sales navigation uses the live legacy MHHT inventory homepage", () => {
  for (const host of ["heritagevacations.com", "www.heritagevacations.com", "HERITAGEVACATIONS.COM:443"]) {
    expect(linkForMode("heritage", "buy", host)).toEqual({
      href: "https://myhiltonheadtimeshare.com/", external: true,
    });
    expect(resolveSearchHref("heritage", "/search?type=buy&bedrooms=2", host).href)
      .toBe("https://myhiltonheadtimeshare.com/");
  }
});
test("staging and preview sales links retain the new HHT search route", () => {
  for (const host of ["hv.lead-works.com", "localhost", "preview.vercel.app"]) {
    expect(linkForMode("heritage", "buy", host).href)
      .toBe("https://hht.lead-works.com/search?type=buy");
  }
});
test("only the production MHHT search destination is replaced", () => {
  expect(sisterSiteUrl("mhht", "/search", "heritagevacations.com")).toBe("https://myhiltonheadtimeshare.com/");
  expect(sisterSiteUrl("mhht", "/contact", "heritagevacations.com")).toBe("https://myhiltonheadtimeshare.com/contact");
  expect(sisterSiteUrl("heritage", "/search?type=rent", "myhiltonheadtimeshare.com"))
    .toBe("https://heritagevacations.com/search?type=rent");
  expect(linkForMode("mhht", "buy", "myhiltonheadtimeshare.com"))
    .toEqual({href:"/search?type=buy", external:false});
});
