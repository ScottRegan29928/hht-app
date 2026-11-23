import { describe, expect, test } from "bun:test";
import { websiteVisitsEligible, websiteVisitsPublicPath, scheduleWebsiteVisits } from "./websiteVisits";

const config = {
  enabled: true, key: "a".repeat(64), hosts: ["public.example.com"],
  publicPaths: ["/", "/about/", "/contact/", "/classroom/", "/clarity-map/"],
};
describe("Website Visits explicit public-only scope", () => {
  test("only explicit hosts and sitemap paths", () => {
    expect(websiteVisitsPublicPath("/style-assessment/")).toBe(false);
    expect(websiteVisitsEligible(config, "https://public.example.com/")).toBe(true);
    expect(websiteVisitsEligible(config, "https://public.example.com/about")).toBe(true);
    expect(websiteVisitsEligible(config, "https://public.example.com/contact/?utm_source=newsletter")).toBe(true);
    for (const url of ["https://portal.public.example.com/", "https://preview.example.com/", "http://public.example.com/", "https://public.example.com:444/", "https://public.example.com/not-in-sitemap/", "https://public.example.com/classroom/", "https://public.example.com/clarity-map/", "https://public.example.com/%70ortal/", "https://public.example.com/?preview=1", "https://public.example.com/?q=private", "https://public.example.com/?email=private", "https://public.example.com/?token=private"]) {
      expect(websiteVisitsEligible(config, url)).toBe(false);
    }
  });
  test("off and missing key fail closed", () => {
    expect(websiteVisitsEligible({ ...config, enabled: false }, "https://public.example.com/")).toBe(false);
    expect(websiteVisitsEligible({ ...config, key: "" }, "https://public.example.com/")).toBe(false);
  });
  test("SSR does not create a browser or send anything", () => {
    expect(() => scheduleWebsiteVisits(config)).not.toThrow();
  });
  test("paint gate, anonymous script attributes, GPC, and build guards", () => {
    const names = ["window", "document", "navigator", "location", "performance", "requestAnimationFrame"];
    const original = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
    let scripts: Record<string, unknown>[] = [];
    const set = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    const reset = (gpc = false, prerender = false) => {
      scripts = [];
      set("window", { __LW_PRERENDER__: prerender, requestIdleCallback: (fn: () => void) => fn() });
      set("navigator", { globalPrivacyControl: gpc, webdriver: false });
      set("location", { href: "https://public.example.com/" });
      set("performance", { getEntriesByName: () => [{}] });
      set("requestAnimationFrame", (fn: () => void) => fn());
      set("document", {
        visibilityState: "visible", prerendering: false, readyState: "complete",
        addEventListener() {}, getElementById: () => null,
        createElement: () => ({ dataset: {} }),
        body: { appendChild: (script: Record<string, unknown>) => scripts.push(script) },
      });
    };
    try {
      reset(true); scheduleWebsiteVisits(config); expect(scripts.length).toBe(0);
      reset(false, true); scheduleWebsiteVisits(config); expect(scripts.length).toBe(0);
      reset(); scheduleWebsiteVisits(config); scheduleWebsiteVisits(config);
      expect(scripts.length).toBe(1);
      expect(scripts[0].crossOrigin).toBe("anonymous");
      expect(scripts[0].referrerPolicy).toBe("no-referrer");
      expect(scripts[0].src).toBe(`https://api.lead-works.com/v.js?k=${config.key}`);
      expect(scripts[0].dataset).toEqual({ websiteVisitsVersion: "1.0.0", publicPaths: JSON.stringify(config.publicPaths.filter(websiteVisitsPublicPath)) });
    } finally {
      names.forEach((name, index) => {
        if (original[index]) Object.defineProperty(globalThis, name, original[index]!);
        else Reflect.deleteProperty(globalThis, name);
      });
    }
  });
});
