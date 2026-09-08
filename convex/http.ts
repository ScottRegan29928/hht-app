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

// ── Prerender for social crawlers ──
//
// Facebook, LinkedIn, Slack, iMessage, WhatsApp and X do not execute
// JavaScript, so a shared link into this SPA previewed as the generic
// index.html blurb whatever page was shared. Vercel routes those user-agents
// here; humans keep getting the normal React app untouched.
//
// The body below carries the SAME heading and text a visitor sees, not just
// meta tags. That matters: serving crawlers metadata that differs from the
// real page is cloaking. convex/prerender.ts is the single resolver, and it
// mirrors src/lib/seo.ts.
function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function metaTag(attr: "name" | "property", key: string, val?: string): string {
  // Omit rather than emit an empty tag — a blank og:description is worse than
  // none, because it stops the crawler falling back to anything sensible.
  if (!val) return "";
  return `    <meta ${attr}="${key}" content="${htmlEscape(val)}" />\n`;
}

http.route({
  path: "/api/prerender",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const siteSlug = url.searchParams.get("site") || "mhht";
    const path = url.searchParams.get("path") || "/";

    const m = await ctx.runQuery(api.prerender.metaForPath, { siteSlug, path });

    const head =
      metaTag("name", "description", m.description) +
      metaTag("property", "og:title", m.title) +
      metaTag("property", "og:description", m.description) +
      metaTag("property", "og:type", m.type) +
      metaTag("property", "og:url", m.canonical) +
      metaTag("property", "og:site_name", m.siteName) +
      metaTag("property", "og:image", m.image) +
      metaTag("property", "article:published_time", m.publishedTime) +
      metaTag("name", "twitter:card", m.image ? "summary_large_image" : "summary") +
      metaTag("name", "twitter:title", m.title) +
      metaTag("name", "twitter:description", m.description) +
      metaTag("name", "twitter:image", m.image) +
      (m.noindex ? '    <meta name="robots" content="noindex, nofollow" />\n' : "") +
      (m.canonical
        ? `    <link rel="canonical" href="${htmlEscape(m.canonical)}" />\n`
        : "");

    const body = m.body.map((p) => `      <p>${htmlEscape(p)}</p>`).join("\n");

    const html =
      "<!doctype html>\n" +
      '<html lang="en">\n' +
      "  <head>\n" +
      '    <meta charset="UTF-8" />\n' +
      `    <title>${htmlEscape(m.title)}</title>\n` +
      head +
      "  </head>\n" +
      "  <body>\n" +
      `    <h1>${htmlEscape(m.heading)}</h1>\n` +
      body +
      "\n" +
      // Humans should never land here, but if one does (a UA string that looks
      // like a bot, a link pasted from a crawler log) send them to the app
      // rather than leaving them on a bare page.
      (m.canonical
        ? `    <p><a href="${htmlEscape(m.canonical)}">Continue to ${htmlEscape(m.siteName)}</a></p>\n`
        : "") +
      "  </body>\n</html>\n";

    return new Response(html, {
      status: m.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Robots-Tag": m.noindex ? "noindex, nofollow" : "all",
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
