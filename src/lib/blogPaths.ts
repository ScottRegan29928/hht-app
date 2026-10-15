import { isResort, resortInfo } from "@/lib/resort";
// Spicebush calls its blog "Articles" and serves it at /articles, matching
// spicebushatseapines.com/articles/ [zoe, 2026-10-01]. Other sites keep /blog.
// /blog and /articles are both routed on every site, so either URL resolves.
export function blogBase(siteSlug: string): string {
  return isResort(siteSlug) ? "/articles" : "/blog";
}

export function blogNavLabel(siteSlug: string): string {
  return isResort(siteSlug) ? "Articles" : "News";
}

export const ARTICLES_PER_PAGE = 15;
