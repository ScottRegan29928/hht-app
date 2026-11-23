/** Website Visits public loader, v1.0.0 (2026-11-23).
 * Independent explicit opt-in. Never lifts the GA4/Page Actions/identity privacy hold.
 * Canonical owner: Intent master. Consumers provide their own sitemap paths and exact hosts.
 */
export interface WebsiteVisitsConfig {
  enabled: boolean;
  key: string;
  hosts: readonly string[];
  publicPaths: readonly string[];
}

export const WEBSITE_VISITS_LOADER_VERSION = "1.0.0";
const PRIVATE_PATH = /(?:^|\/)(?:admin|wp-admin|wp-login|account|my-account|checkout|cart|login|portal|dashboard|search|classroom|signup|my-plan|assessment|clarity-map|api|preview|reset-password|unsubscribe)(?:\/|$)/i;
const PRIVATE_QUERY = /^(?:s|q|query|search|search_query|preview|draft|token|key|reset|email|contact|password|code|__crashtest|__viktor_auto_sign_in)$/i;
const normalizePath = (path: string) => path === "/" ? "/" : path.replace(/\/+$/, "");

export function websiteVisitsPublicPath(path: string): boolean {
  return !PRIVATE_PATH.test(path) && !/(?:assessment|quiz)/i.test(path) && !/[\\@]/.test(path);
}

export function websiteVisitsEligible(config: WebsiteVisitsConfig, href: string): boolean {
  if (!config.enabled || !/^[a-f0-9]{64}$/.test(config.key)) return false;
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" || url.port || !config.hosts.includes(url.hostname)) return false;
    // A source-provided sitemap allowlist, not a wildcard public-route assumption.
    const path = decodeURIComponent(url.pathname);
    if (!websiteVisitsPublicPath(path)) return false;
    if ([...url.searchParams.keys()].some((key) => PRIVATE_QUERY.test(key))) return false;
    return config.publicPaths.some((publicPath) => normalizePath(publicPath) === normalizePath(path));
  } catch {
    return false;
  }
}

export function scheduleWebsiteVisits(config: WebsiteVisitsConfig): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const state = window as Window & { __LW_PRERENDER__?: boolean; __intentWebsiteVisitsScheduled?: boolean };
  const doc = document as Document & { prerendering?: boolean };
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  const safe = () => !state.__LW_PRERENDER__ && !nav.webdriver &&
    nav.globalPrivacyControl !== true && websiteVisitsEligible(config, location.href);
  if (!safe() || state.__intentWebsiteVisitsScheduled) return;
  state.__intentWebsiteVisitsScheduled = true;
  let loaded = false;
  let scheduled = false;
  let paintReady = false;
  const visible = () => document.visibilityState === "visible" && !doc.prerendering;
  const load = () => {
    if (loaded || !safe() || !visible()) return;
    loaded = true;
    if (document.getElementById("lw-visits-script")) return;
    const script = document.createElement("script");
    script.id = "lw-visits-script";
    script.src = `https://api.lead-works.com/v.js?k=${encodeURIComponent(config.key)}`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.referrerPolicy = "no-referrer";
    script.dataset.websiteVisitsVersion = WEBSITE_VISITS_LOADER_VERSION;
    script.dataset.publicPaths = JSON.stringify(config.publicPaths.filter(websiteVisitsPublicPath));
    document.body.appendChild(script);
  };
  const painted = () => {
    paintReady = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if ("requestIdleCallback" in window) window.requestIdleCallback(load, { timeout: 2000 });
      else setTimeout(load, 0);
    }));
  };
  const afterPaint = () => {
    if (!safe() || !visible() || scheduled) return;
    scheduled = true;
    try {
      if (performance.getEntriesByName("first-contentful-paint").length) return painted();
      if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("paint")) {
        const observer = new PerformanceObserver((list) => {
          if (list.getEntriesByName("first-contentful-paint").length) {
            observer.disconnect();
            painted();
          }
        });
        observer.observe({ type: "paint", buffered: true });
        return;
      }
    } catch { /* Older browser: load then two animation frames. */ }
    if (document.readyState === "complete") painted();
    else window.addEventListener("load", painted, { once: true });
  };
  document.addEventListener("visibilitychange", () => {
    if (!scheduled) afterPaint();
    else if (paintReady && !loaded && visible()) painted();
  });
  document.addEventListener("prerenderingchange", afterPaint, { once: true });
  afterPaint();
}
