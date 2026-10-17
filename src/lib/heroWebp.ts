/**
 * Shipped JPG/PNG assets have a same-name .webp sibling. Swap only for these
 * known local paths; backend-uploaded images pass through untouched. The
 * originals stay on disk for og:image / email / any admin-saved reference.
 * The per-site HTML shell preloads the hero .webp (scripts/per_site_index.py).
 *
 * Intent speed rule 3 (images always WebP) [scott, 2026-10-17]: every shipped
 * raster that renders on a public page goes through `heroWebp()` / `webp()`.
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
  // Rule-3 pass [2026-10-17]
  "/brand/cgl/logo-color.png",
  "/brand/cgl/logo-white.png",
  "/brand/hv/airbnb-superhost-white.png",
  "/brand/hv/logo-horz-color.png",
  "/brand/hv/logo-horz-white.png",
  "/brand/hv/vrbo-premier-host.png",
  "/brand/hv/monogram-plaid.png",
  "/brand/spicebush/footer.jpg",
  "/brand/spicebush/golf.jpg",
  "/brand/spicebush/logo-green.png",
  "/brand/spicebush/logo-white.png",
  "/brand/spicebush/sand.jpg",
  "/brand/swallowtail/footer.jpg",
  "/brand/swallowtail/golf.jpg",
  "/brand/swallowtail/logo-color.png",
  "/brand/swallowtail/logo-white.png",
  "/brand/swallowtail/sand.jpg",
  "/lighthouse.jpg",
  "/tiles/hv/golf.jpg",
  "/tiles/hv/swimming-pool.jpg",
  "/tiles/hv/tennis.jpg",
  "/tiles/hv/water.jpg",
]);

export function heroWebp(src: string): string {
  return WEBP.has(src) ? src.replace(/\.(jpe?g|png)$/, ".webp") : src;
}

/** Same as heroWebp — general name for non-hero images. */
export const webp = heroWebp;
