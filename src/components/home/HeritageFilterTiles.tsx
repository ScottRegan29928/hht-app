import { Link } from "react-router-dom";
import type { HomeContent } from "@/lib/homeContent";

/**
 * "Pursue the Extraordinary" — the amenity shortcut tiles from
 * heritagevacations.com, plus a fourth for On Golf Course [scott, 2026-09-08].
 *
 * On the live WordPress site these tiles are decorative images that don't
 * click. Scott called them filters, so ours actually filter: each one links
 * into the rental search pre-filtered on that amenity.
 *
 * Note the live site's heading reads "Persue the Extraordinary". That's a
 * typo, so it is spelled correctly here.
 *
 * Tile labels, images and links are editable in the backend; the defaults
 * (including the amenity links) live in src/lib/homeContent.ts.
 *
 * Amenity keys are a mix of normalized community-level keys (water_views,
 * pool, tennis, on_golf_course) and raw HostAway tags (Waterview, Oceanview…).
 * Water Views needs the raw tags OR-ed in or it matches only 3 of 82
 * properties instead of 37 — the search page defaults amenityMode to "or".
 */

export function HeritageFilterTiles({ content }: { content: HomeContent }) {
  const { heading, subheading, items } = content.tiles;
  if (items.length === 0) return null;
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2
            className="text-[28px] sm:text-[34px] leading-tight text-[#014e6c]"
            style={{ fontFamily: '"Bodoni Moda", ui-serif, Georgia, serif', fontWeight: 400 }}
          >
            {heading}
          </h2>
          <p
            className="mt-3 text-[14px] sm:text-[16px] font-bold uppercase tracking-wide text-[#014e6c]"
            style={{ fontFamily: "Montserrat, Quicksand, ui-sans-serif, system-ui, sans-serif" }}
          >
            {subheading}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((t) => (
            <Link
              key={t.label}
              to={t.href}
              className="group relative block overflow-hidden aspect-[279/239] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#968751] focus-visible:ring-offset-2"
            >
              <img
                src={t.imageUrl}
                alt={t.label}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              {/* Gradient keeps the white label readable over any photo. */}
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0) 70%)" }}
                aria-hidden="true"
              />
              <span
                className="absolute bottom-4 left-4 right-4 text-white text-[16px] font-bold uppercase"
                style={{ fontFamily: "Montserrat, Quicksand, ui-sans-serif, system-ui, sans-serif" }}
              >
                {t.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
