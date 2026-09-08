import { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { brandForSlug } from "./siteBrand";

/**
 * Resolves "which of the four sister sites am I?" from the browser hostname
 * and makes it available app-wide.
 *
 * Local dev and Vercel previews fall through to the MHHT site (the full
 * inventory) so nothing renders empty while developing.
 *
 * Override for local testing:  ?site=spicebush
 */

export type SiteScope = {
  site: {
    _id: string;
    slug: string;
    name: string;
    domain: string;
    tagline?: string;
    scopeMode: "all" | "communities";
    communitySlugs?: string[];
    ownerPortalEnabled: boolean;
    marketplaceEnabled: boolean;
    rentalsEnabled: boolean;
    marketplacePool?: string;
    paymentMode?: "none" | "external" | "square_link";
    paymentUrl?: string;
    paymentNote?: string;
    theme?: { primary?: string; accent?: string };
    seoDefaults?: {
      titleSuffix?: string;
      metaDescription?: string;
      ogImageUrl?: string;
      twitterHandle?: string;
    };
  };
  /** null means "show everything" */
  communityIds: string[] | null;
} | null;

const SiteContext = createContext<{ scope: SiteScope; loading: boolean }>({
  scope: null,
  loading: true,
});

const SLUG_TO_DOMAIN: Record<string, string> = {
  heritage: "heritagevacations.com",
  mhht: "myhiltonheadtimeshare.com",
  swallowtail: "swallowtailatseapines.com",
  spicebush: "spicebushatseapines.com",
};

/**
 * Capture the ?site= testing override ONCE at module load and persist it.
 *
 * Pages such as SearchPage rewrite the query string from their own filter
 * state, which strips ?site= within a second of load — so reading it lazily
 * on each render silently loses the override. Real hostnames are unaffected;
 * this exists only so the four sites can be tested before their domains
 * point here.
 */
const OVERRIDE_KEY = "hht:siteOverride";

const initialOverride: string | null = (() => {
  if (typeof window === "undefined") return null;
  const fromUrl = new URLSearchParams(window.location.search).get("site");
  if (fromUrl && SLUG_TO_DOMAIN[fromUrl]) {
    try {
      window.sessionStorage.setItem(OVERRIDE_KEY, fromUrl);
    } catch {
      /* private mode — in-memory value still applies for this page */
    }
    return fromUrl;
  }
  try {
    const stored = window.sessionStorage.getItem(OVERRIDE_KEY);
    return stored && SLUG_TO_DOMAIN[stored] ? stored : null;
  } catch {
    return null;
  }
})();

function resolveHostname(): string {
  if (typeof window === "undefined") return "";
  if (initialOverride) return SLUG_TO_DOMAIN[initialOverride];
  return window.location.hostname;
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const hostname = resolveHostname();
  const scope = useQuery(api.sites.scopeForHostname, { hostname }) as SiteScope;

  // Keep the browser tab title on the resolved site rather than the build's
  // static index.html title, which would otherwise say "Hilton Head" on all four.
  useEffect(() => {
    if (scope?.site?.name) document.title = scope.site.name;
  }, [scope?.site?.name]);

  return (
    <SiteContext.Provider
      value={{ scope: scope ?? null, loading: scope === undefined }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  return useContext(SiteContext);
}

/** Convenience: the community IDs this site may show, or null for all. */
export function useSiteCommunityIds(): string[] | null {
  const { scope } = useSite();
  return scope?.communityIds ?? null;
}

/** Convenience: feature flags with safe defaults before the query resolves. */
export function useSiteFlags() {
  const { scope } = useSite();
  return {
    ownerPortalEnabled: scope?.site.ownerPortalEnabled ?? false,
    marketplaceEnabled: scope?.site.marketplaceEnabled ?? false,
    rentalsEnabled: scope?.site.rentalsEnabled ?? true,
    siteName: scope?.site.name ?? "Hilton Head Timeshares",
    siteSlug: scope?.site.slug ?? "mhht",
  };
}

/**
 * Maintenance-fee payment config. Swallowtail redirects owners to its
 * management company; Spicebush collects on site via Square [scott, 2026-09-08].
 * `ready` is false when a mode needs a URL that has not been supplied yet, so
 * the UI can say so instead of rendering a button that goes nowhere.
 */
export function useSitePayment() {
  const { scope } = useSite();
  const mode = scope?.site.paymentMode ?? "none";
  const url = scope?.site.paymentUrl;
  return {
    mode,
    url,
    note: scope?.site.paymentNote,
    enabled: mode !== "none",
    ready: mode === "external" || mode === "square_link" ? !!url : false,
  };
}

/** Convenience: brand copy (wordmark, hero, footer) for the current site. */
export function useSiteBrand() {
  const { scope } = useSite();
  return brandForSlug(scope?.site.slug);
}
