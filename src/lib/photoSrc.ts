/**
 * Route HostAway photo URLs through our own origin [scott, 2026-09-16].
 *
 * HostAway serves property photos from `hostaway-platform.s3.us-west-2.
 * amazonaws.com`. Ad blockers and corporate DNS filters drop `*.amazonaws.com`
 * often enough that Scott saw scattered broken tiles in the admin photo grid
 * while every one of those URLs returned HTTP 200 when fetched directly.
 *
 * `photoSrc()` rewrites such URLs to the Convex `/api/photo` proxy, which is
 * first-party and therefore unblockable. Everything else — Convex storage URLs
 * for mirrored photos, local assets — is returned untouched.
 */

const HOSTAWAY_PHOTO_HOST = "hostaway-platform.s3.us-west-2.amazonaws.com";

/** Convex HTTP site origin, e.g. https://savory-heron-748.convex.site */
const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL as
  | string
  | undefined;

export function photoSrc(url: string | null | undefined): string {
  if (!url) return "";
  if (!url.includes(HOSTAWAY_PHOTO_HOST)) return url;
  // Without the site URL configured, hotlinking is still better than a
  // guaranteed-broken relative path.
  if (!CONVEX_SITE_URL) return url;
  return `${CONVEX_SITE_URL}/api/photo?u=${encodeURIComponent(url)}`;
}

/** Convenience for lists. */
export function photoSrcAll(
  urls: (string | null | undefined)[] | undefined,
): string[] {
  return (urls ?? []).map(photoSrc).filter((u) => u.length > 0);
}
