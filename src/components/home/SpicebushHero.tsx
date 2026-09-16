import { Link } from "react-router-dom";
import { ArrowRight, Calendar, Key, Waves } from "lucide-react";
import type { HomeContent } from "@/lib/homeContent";
import { useSiteBrand } from "@/lib/siteContext";

/**
 * Spicebush at Sea Pines hero.
 *
 * This is the SHARED hero's content — eyebrow, headline, intro, and both CTAs,
 * unchanged — laid over the hero photograph from spicebushatseapines.com.
 * Zoe asked for the background image and the logo from the old site and for
 * everything else in the hero to stay as it was [zoe, 2026-09-16], so do not
 * reintroduce the old site's headline or single button here.
 *
 * The image is `content.hero.images[0]`, so it stays editable in the backend.
 */
export function SpicebushHero({ content }: { content: HomeContent }) {
  const brand = useSiteBrand();
  const hero = content.hero;
  const image = hero.images[0] ?? "/brand/spicebush/hero.jpg";
  const lines = hero.headlineLines.length
    ? hero.headlineLines
    : [brand.headlineTop, brand.headlineAccent];

  return (
    <section
      className="relative w-full overflow-hidden"
      aria-label={brand.legalName}
      style={{
        backgroundImage: `url(${image})`,
        backgroundSize: "cover",
        backgroundPosition: "50% 0%",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Enough scrim to keep white copy readable on a bright beach photo,
          plus a little extra behind the transparent header. */}
      <div className="absolute inset-0 bg-black/35" aria-hidden="true" />
      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0))",
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 sm:pt-40 sm:pb-24">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-white/85 mb-4">
            <Waves className="w-5 h-5" />
            <span className="text-sm font-medium tracking-wide uppercase">
              {hero.eyebrow || brand.eyebrow}
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] font-[family-name:var(--font-display)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
            {lines.map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {/* The old site set the accent word of its hero lockup in the
                    client's Brushine script; here that is the first line,
                    "Spicebush" [zoe, 2026-09-16]. Script faces need more size
                    and no tracking to read at the same optical weight as
                    Cinzel. Brushine's ascenders and descenders are tall, so its
                    line box is pulled tight and lifted to sit close to line
                    two without clipping the swashes. */}
                {i === 0 ? (
                  <span className="block font-[family-name:Brushine] font-normal tracking-normal text-6xl sm:text-7xl lg:text-[5.5rem] leading-[0.9] pb-1 -mb-3 sm:-mb-4 lg:-mb-8">
                    {line}
                  </span>
                ) : (
                  line
                )}
              </span>
            ))}
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-white/90 max-w-xl leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]">
            {hero.intro || brand.intro}
          </p>

          {/* Both entry points, rentals first [scott, 2026-09-08]. */}
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to={hero.primaryHref}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-md"
            >
              <Calendar className="w-4 h-4" />
              {hero.primaryLabel}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to={hero.secondaryHref}
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-white text-white rounded-lg font-semibold hover:bg-white/15 transition-colors"
            >
              <Key className="w-4 h-4" />
              {hero.secondaryLabel}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
