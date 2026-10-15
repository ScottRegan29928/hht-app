/**
 * Shipped hero JPGs have a same-name .webp sibling (~55% smaller). Swap only
 * for these known local paths; backend-uploaded images pass through untouched.
 * The per-site HTML shell preloads the same .webp (scripts/per_site_index.py).
 */
const WEBP = new Set([
  "/brand/spicebush/hero.jpg",
  "/brand/swallowtail/hero.jpg",
  "/hero/hv/slide1-lighthouse.jpg",
  "/hero/hv/slide2-bedroom.jpg",
  "/hero/hv/slide3-beach.jpg",
  "/hero/hv/slide4-pool.jpg",
  "/hero/hv/slide5-golf.jpg",
  "/hero/hv/slide6-villa.jpg",
]);

export function heroWebp(src: string): string {
  return WEBP.has(src) ? src.replace(/\.jpg$/, ".webp") : src;
}
