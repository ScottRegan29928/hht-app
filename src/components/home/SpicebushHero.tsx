import { Link } from "react-router-dom";
import {
  currentHostname,
  resolveSearchHref,
} from "@/lib/siteCapabilities";
import type { HomeContent } from "@/lib/homeContent";
import { useSiteFlags } from "@/lib/siteContext";

/**
 * Spicebush at Sea Pines hero banner.
 *
 * A measured recreation of the hero on spicebushatseapines.com [zoe,
 * 2026-09-16] — the client's existing brand, applied to the new build without
 * changing any functionality.
 *
 * Values below come from the live site's computed styles, not from eyeballing,
 * so don't "tidy" them into round numbers:
 *   section        min-height 550px, padding 0 30px 60px, content centered
 *   background     Hero-Background.jpg, cover, 50% 0%, NO scrim
 *   h1             Cinzel 400, 40px / 1.2, letter-spacing 2px, white
 *   accent         "the Dream" in Brushine 70px, same color
 *   button         #891F11, Cinzel 500, 18px, ls 2px, padding 17px 40px,
 *                  radius 2px, text-transform capitalize
 *   button target  /vacation-rentals/ on the old site → the new rental search
 */

const MAROON = "#891F11";
const CINZEL = 'Cinzel, ui-serif, Georgia, serif';
/**
 * The phrase the old site sets in the script face. Kept as a constant so the
 * headline stays editable in the backend: whatever text an admin saves, this
 * phrase is scripted if it appears and the headline renders plainly if it
 * doesn't.
 */
const SCRIPT_PHRASE = "the Dream";

/** Splits a headline line into plain/script/plain runs. */
function renderLine(line: string, key: number) {
  const i = line.indexOf(SCRIPT_PHRASE);
  if (i === -1) return <span key={key}>{line}</span>;
  return (
    <span key={key}>
      {line.slice(0, i)}
      <span
        className="text-[52px] sm:text-[70px]"
        style={{ fontFamily: "Brushine, cursive" }}
      >
        {SCRIPT_PHRASE}
      </span>
      {line.slice(i + SCRIPT_PHRASE.length)}
    </span>
  );
}

/**
 * A hero CTA that may point at a sister site. Spicebush handles both rentals
 * and sales, so today this resolves in-app, but going through the same helper
 * as the other sites keeps it correct if that ever changes.
 */
function CtaLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const { siteSlug } = useSiteFlags();
  const link = resolveSearchHref(siteSlug, href, currentHostname());
  const className =
    "inline-flex items-center justify-center text-white transition-opacity hover:opacity-90";
  const style: React.CSSProperties = {
    backgroundColor: MAROON,
    fontFamily: CINZEL,
    fontWeight: 500,
    fontSize: "18px",
    letterSpacing: "2px",
    textTransform: "capitalize",
    padding: "17px 40px",
    borderRadius: "2px",
  };
  if (link.external) {
    return (
      <a href={link.href} className={className} style={style}>
        {children}
      </a>
    );
  }
  return (
    <Link to={link.href} className={className} style={style}>
      {children}
    </Link>
  );
}

export function SpicebushHero({ content }: { content: HomeContent }) {
  const hero = content.hero;
  const image = hero.images[0] ?? "/brand/spicebush/hero.jpg";

  return (
    <section
      className="relative w-full overflow-hidden min-h-[550px] flex items-center justify-center px-[30px] pb-[60px] pt-[150px] sm:pt-[190px]"
      aria-label="Spicebush at Sea Pines"
      style={{
        backgroundImage: `url(${image})`,
        backgroundSize: "cover",
        backgroundPosition: "50% 0%",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* The live site runs no scrim over this photo. A soft top gradient keeps
          the white nav legible without darkening the picture the client picked. */}
      <div
        className="absolute inset-x-0 top-0 h-48 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.28), rgba(0,0,0,0))",
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-[900px] text-center">
        <h1
          className="text-white text-[28px] leading-[1.2] sm:text-[40px]"
          style={{ fontFamily: CINZEL, fontWeight: 400, letterSpacing: "2px" }}
        >
          {(hero.headlineLines.length
            ? hero.headlineLines
            : ["Live the Dream You\u2019ve Only Imagined"]
          ).map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {renderLine(line, i)}
            </span>
          ))}
        </h1>

        <div className="mt-8 flex justify-center">
          <CtaLink href={hero.primaryHref}>{hero.primaryLabel}</CtaLink>
        </div>
      </div>
    </section>
  );
}
