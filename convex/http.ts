import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

// ── iCal export endpoint ──
// GET /api/calendar/:weekId.ics
// ── SEO: sitemap.xml and robots.txt ──
// Served from Convex rather than rendered in the client: this app is a
// client-rendered SPA, so a crawler asking for /sitemap.xml would otherwise
// get the empty HTML shell. Vercel rewrites the two public paths here.
// The ?site= param picks which of the four sister sites to describe.

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

http.route({
  path: "/api/sitemap.xml",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const siteSlug = url.searchParams.get("site") || "mhht";
    const data = await ctx.runQuery(api.content.sitemapData, { siteSlug });
    if (!data.domain) {
      return new Response("Unknown site", { status: 404 });
    }
    const base = `https://${data.domain}`;
    const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

    const urls: Array<{ loc: string; lastmod?: string; priority: string }> = [
      { loc: base + "/", priority: "1.0" },
      { loc: base + "/search", priority: "0.8" },
    ];
    for (const c of data.communities) {
      urls.push({ loc: `${base}/community/${c.slug}`, priority: "0.7" });
    }
    for (const p of data.properties) {
      urls.push({
        loc: `${base}/property/${p.slug}`,
        lastmod: iso(p.updatedAt),
        priority: "0.6",
      });
    }
    for (const p of data.pages) {
      urls.push({ loc: `${base}/${p.slug}`, lastmod: iso(p.updatedAt), priority: "0.7" });
    }
    if (data.posts.length > 0) {
      urls.push({ loc: base + "/blog", priority: "0.6" });
    }
    for (const p of data.posts) {
      urls.push({
        loc: `${base}/blog/${p.slug}`,
        lastmod: iso(p.updatedAt),
        priority: "0.5",
      });
    }

    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls
        .map(
          (u) =>
            "  <url><loc>" +
            xmlEscape(u.loc) +
            "</loc>" +
            (u.lastmod ? "<lastmod>" + u.lastmod + "</lastmod>" : "") +
            "<priority>" +
            u.priority +
            "</priority></url>"
        )
        .join("\n") +
      "\n</urlset>\n";

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

http.route({
  path: "/api/robots.txt",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const siteSlug = url.searchParams.get("site") || "mhht";
    const data = await ctx.runQuery(api.content.sitemapData, { siteSlug });
    const lines = [
      "User-agent: *",
      "Allow: /",
      // Gated surfaces. These require a login and hold owner PII, so they must
      // never be crawled or indexed.
      "Disallow: /owner",
      "Disallow: /management",
      "Disallow: /checkout",
      "",
    ];
    if (data.domain) {
      lines.push(`Sitemap: https://${data.domain}/sitemap.xml`, "");
    }
    return new Response(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

http.route({
  path: "/api/calendar",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const weekId = url.searchParams.get("weekId");

    if (!weekId) {
      return new Response("Missing weekId parameter", { status: 400 });
    }

    try {
      const icalContent = await ctx.runQuery(api.calendar.generateIcal, {
        weekId: weekId as any,
      });

      if (!icalContent) {
        return new Response("Week not found", { status: 404 });
      }

      return new Response(icalContent, {
        status: 200,
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": `attachment; filename="week-${weekId}.ics"`,
          "Cache-Control": "no-cache, max-age=0",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err: any) {
      return new Response("Error generating calendar", { status: 500 });
    }
  }),
});

export default http;
