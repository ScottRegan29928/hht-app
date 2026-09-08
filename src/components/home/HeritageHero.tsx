import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

/**
 * Heritage Vacations hero banner.
 *
 * A deliberate, measured recreation of the hero on heritagevacations.com —
 * Scott asked for it to look "exactly like" the live site, with the CTA
 * buttons as the only change (two buttons instead of one).
 *
 * Values below were read off the live site's computed styles rather than
 * eyeballed, so don't "tidy" them into round numbers:
 *   section height  900px
 *   scrim           rgba(0,0,0,0.4) flat
 *   container       matches the site header, so hero copy aligns with the logo
 *   copy column     640px for the headline, 458px for the paragraph
 *   h1              Bodoni Moda 400, 32px / 38.4px, shadow 2px 2px 5px #014e6c
 *   body            Quicksand 400, 17px / 20.4px, shadow 2px 2px 3px #014e6c
 *   button          #968751, 1px solid #fff, radius 0, padding 17px 40px
 */

const SLIDES = [
  { src: "/hero/hv/slide1-lighthouse.jpg", alt: "The Harbour Town lighthouse against a blue sky" },
  { src: "/hero/hv/slide2-bedroom.jpg", alt: "A villa bedroom with a coastal quilt and a view to the marsh" },
  { src: "/hero/hv/slide3-beach.jpg", alt: "Sea oats on the dunes above the beach at Hilton Head Island" },
  { src: "/hero/hv/slide4-pool.jpg", alt: "A resort swimming pool framed by palms and live oaks" },
  { src: "/hero/hv/slide5-golf.jpg", alt: "A villa balcony overlooking the golf course and lagoon" },
  { src: "/hero/hv/slide6-villa.jpg", alt: "A Plantation Club villa on a bright Sea Pines morning" },
];

const SLIDE_MS = 6000;
const SHADOW_H1 = "2px 2px 5px #014e6c";
const SHADOW_BODY = "2px 2px 3px #014e6c";
const GOLD = "#968751";

export function HeritageHero() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Respect a user's reduced-motion preference: hold on the first slide.
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <section
      className="relative w-full overflow-hidden min-h-[560px] h-[70vh] lg:h-[900px] lg:max-h-[900px]"
      aria-label="Heritage Vacations"
    >
      {/* Slides — cross-faded. The first is eager so the hero paints immediately. */}
      {SLIDES.map((s, i) => (
        <img
          key={s.src}
          src={s.src}
          alt={i === index ? s.alt : ""}
          aria-hidden={i === index ? undefined : true}
          loading={i === 0 ? "eager" : "lazy"}
          fetchPriority={i === 0 ? "high" : "low"}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out motion-reduce:transition-none"
          style={{ opacity: i === index ? 1 : 0 }}
        />
      ))}

      {/* Flat 40% scrim, as on the live site. */}
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      {/* Extra darkening behind the header so the white nav stays legible. */}
      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{ background: "linear-gradient(to bottom, rgba(1,78,108,0.55), rgba(1,78,108,0))" }}
        aria-hidden="true"
      />

      {/* Copy */}
      <div className="relative h-full flex items-center">
        {/* Same container as the Header, so the hero copy lines up with the
            logo above it [scott, 2026-09-08]. */}
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[640px]">
            <h1
              className="text-white text-[26px] leading-[1.2] sm:text-[32px] sm:leading-[38.4px] lg:whitespace-nowrap"
              style={{ fontFamily: '"Bodoni Moda", ui-serif, Georgia, serif', fontWeight: 400, textShadow: SHADOW_H1 }}
            >
              Extraordinary Vacation Rentals
              <br />
              in Hilton Head Island&rsquo;s
              <br />
              Luxurious Sea Pines Community
            </h1>

            <p
              className="mt-5 max-w-[458px] text-white text-[16px] leading-[1.25] sm:text-[17px] sm:leading-[20.4px]"
              style={{ fontFamily: "Quicksand, ui-sans-serif, system-ui, sans-serif", fontWeight: 400, textShadow: SHADOW_BODY }}
            >
              Discover Sea Pines&rsquo; most coveted vacation rentals on Hilton Head
              Island. From the iconic Harbour Town lighthouse to championship golf
              and sugar-sand beaches, your perfect coastal retreat awaits you.
            </p>

            {/* Two CTAs per Scott: rentals first, sales second. */}
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/search?type=rent"
                className="inline-flex items-center justify-center border border-white text-white transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: GOLD,
                  fontFamily: "Quicksand, ui-sans-serif, system-ui, sans-serif",
                  fontWeight: 400,
                  fontSize: "16px",
                  padding: "17px 40px",
                  borderRadius: 0,
                }}
              >
                Find Your Perfect Rental
              </Link>
              <Link
                to="/search?type=buy"
                className="inline-flex items-center justify-center border border-white text-white bg-white/10 backdrop-blur-[2px] transition-colors hover:bg-white/20"
                style={{
                  fontFamily: "Quicksand, ui-sans-serif, system-ui, sans-serif",
                  fontWeight: 400,
                  fontSize: "16px",
                  padding: "17px 40px",
                  borderRadius: 0,
                }}
              >
                Buy a Week
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Slide dots */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.src}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show slide ${i + 1} of ${SLIDES.length}`}
            aria-current={i === index}
            className="h-2 w-2 rounded-full border border-white/70 transition-colors"
            style={{ backgroundColor: i === index ? "#ffffff" : "transparent" }}
          />
        ))}
      </div>
    </section>
  );
}
