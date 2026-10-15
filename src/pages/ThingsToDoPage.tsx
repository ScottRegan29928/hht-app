import { Link } from "react-router-dom";
import { Calendar, Key } from "lucide-react";
import { useSiteFlags } from "@/lib/siteContext";
import { useSeo } from "../lib/seo";
import { ContentPage } from "./ContentPage";
import { isResort, resortInfo } from "@/lib/resort";

/**
 * Spicebush "Things to Do" page, ported from spicebushatseapines.com/things-to-do/
 * [zoe, 2026-10-01]. Same structure as the old page: tennis-court banner, sand band
 * with the postcard collage and "Within 2 Miles of Spicebush" intro, then six
 * category cards (styled like the search/article cards). Other sites fall through
 * to the admin content page at /things-to-do.
 */

const IMG = "/brand/spicebush/things-to-do";

/** Per-resort banner, collage and intro, each from that resort's old /things-to-do/
 *  page; the six category cards are identical on both old sites [zoe, 2026-10-08]. */
const RESORT_TTD = {
  spicebush: {
    hero: `${IMG}/hero.webp`,
    heroPos: "50% 50%",
    collage: { src: `${IMG}/collage.webp`, w: 1200, h: 717, alt: "Postcards of a Hilton Head beach and the Harbour Town Lighthouse" },
    intro:
      "Your heart finds its rhythm at Spicebush. From emerald greens to sunlit courts to dancing with waves. Here, you can capture nature\u2019s whispers, savor gourmet delights, and bask in golden sands. At Spicebush, every moment is the start of something magical.",
  },
  swallowtail: {
    hero: "/brand/swallowtail/things-to-do/hero.webp",
    heroPos: "60% 40%",
    collage: { src: "/brand/swallowtail/things-to-do/collage.webp", w: 1200, h: 828, alt: "Postcards of a birdwatcher with binoculars and seashells held in sandy hands" },
    intro:
      "It\u2019s not just the variety, it\u2019s the quality. People pursue their passions at Swallowtail at Sea Pines from the center of the Hilton Head Island dream.",
  },
} as const;

const CATEGORIES: { key: string; title: string; image: string; alt: string; items: string[] }[] = [
  {
    key: "surf",
    title: "In the Surf",
    image: `${IMG}/surf-chair.webp`,
    alt: "Wooden beach chair under a blue umbrella facing the surf on a Hilton Head beach",
    items: [
      "Pristine Beaches",
      "Sea Pines Beach Club",
      "Ocean Swimming",
      "Kiteboarding",
      "Seashell Hunting",
      "Dolphin Watching",
      "Surf Fishing",
      "Crabbing",
      "Sunbathing",
    ],
  },
  {
    key: "water",
    title: "Water Sports",
    image: `${IMG}/water-kayak.webp`,
    alt: "Two people paddling yellow kayaks on clear blue water",
    items: [
      "Parasailing",
      "Kayaking",
      "Paddleboarding",
      "Jet Skiing",
      "Boating",
      "Dolphin Tours",
      "Sunset Cruises",
      "Sailing Charters",
      "Alligator Tours",
    ],
  },
  {
    key: "nature",
    title: "Nature\u2019s Playground",
    image: `${IMG}/nature-golf.webp`,
    alt: "Oceanfront golf green with palm trees and a sand bunker",
    items: [
      "3 Golf Courses (plus 30 more nearby)",
      "Tennis (clay courts)",
      "Pickleball",
      "Sea Pines Forest Preserve",
      "Horseback Riding at Lawton Stables",
      "Lawton Stables Animal Farm",
      "Fresh Water Fishing",
      "Biking (114 miles of paved paths)",
      "Carriage Rides",
      "Gregg Russell Playground",
    ],
  },
  {
    key: "dining",
    title: "Dining",
    image: `${IMG}/dining.webp`,
    alt: "Waterfront dining room with model sailboats overhead",
    items: [
      "Truffles Caf\u00e9",
      "Lowcountry Produce",
      "Giuseppi\u2019s",
      "C\u2019est Bon",
      "Beach Bar at Sea Pines Beach Club",
      "Coast, Oceanfront Dining",
      "Fraser\u2019s Tavern",
      "Harbour Town Bakery & Cafe",
      "Harbourside",
      "Links, an American Grill",
      "Ocean Lounge",
      "Quarterdeck",
      "CQ\u2019s Restaurant",
      "The Crazy Crab",
    ],
  },
  {
    key: "shopping",
    title: "Shopping",
    image: `${IMG}/shopping-center.webp`,
    alt: "Red rocking chairs outside the shops at Sea Pines Center",
    items: [
      "The Shops at Sea Pines Center",
      "The Shops at Harbour Town",
      "Sea Pines Farmers & Makers Market",
      "Sea Pines Beach Club",
      "Plantation Club House",
      "Harbour Town Golf Links Club House",
      "South Beach Marina",
      "Quarterdeck Market",
      "Surfside Market",
    ],
  },
  {
    key: "sightseeing",
    title: "Sightseeing",
    image: `${IMG}/sightseeing.webp`,
    alt: "Stoney-Baynard Ruins in Sea Pines",
    items: [
      "Harbour Town Pier",
      "Harbour Town Lighthouse",
      "Harbour Town Yacht Basin",
      "Stoney-Baynard Ruins (circa 1793)",
      "Indian Shell Ring (circa 2000BC)",
      "Old Lawton Rice Field (circa 1804)",
      "Warner W. Plahs Wildflower Field",
      "Vanishing Swamp",
      "Daufuskie Island",
      "The Artists of Sea Pines Gallery",
      "VIVID Gallery",
      "Heritage Farm",
    ],
  },
];

export default function ThingsToDoRoute() {
  const { siteSlug } = useSiteFlags();
  if (!isResort(siteSlug)) return <ContentPage />;
  return <ThingsToDoPage />;
}

function ThingsToDoPage() {
  const { siteSlug } = useSiteFlags();
  const resort = resortInfo(siteSlug);
  const ttd = RESORT_TTD[isResort(siteSlug) ? siteSlug : "spicebush"];
  useSeo({
    title: "Things to Do in Sea Pines, Hilton Head",
    description:
      `Beaches, water sports, golf, tennis, dining, shopping, and sightseeing, all within 2 miles of ${resort.fullName} on Hilton Head Island.`,
  });

  return (
    <div className="sb-things">
      {/* Banner: the old page's tennis-court photo with its script lockup. */}
      <section
        className="relative w-full overflow-hidden"
        style={{
          backgroundImage: `url(${ttd.hero})`,
          backgroundSize: "cover",
          backgroundPosition: ttd.heroPos,
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-black/35" aria-hidden="true" />
        <div className="relative max-w-4xl mx-auto px-4 py-24 sm:py-32 text-center">
          <h1 className="font-[family-name:var(--font-display)] font-medium text-4xl sm:text-5xl lg:text-6xl text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
            So Much to{" "}
            <span className="font-[family-name:Brushine] font-normal tracking-normal text-6xl sm:text-7xl lg:text-[5.25rem] leading-none">
              See &amp; Do
            </span>
          </h1>
          <div className="sb-closing mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
            <Link
              to="/search?type=rent"
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-6 py-3 bg-white text-primary rounded-lg font-semibold transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Find a Rental
            </Link>
            <Link
              to="/search?type=buy"
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-6 py-3 border-2 rounded-lg font-semibold transition-colors"
            >
              <Key className="w-4 h-4" />
              Buy a Week
            </Link>
          </div>
        </div>
      </section>

      {/* Sand band (blue wood bar on top) with the postcard collage and intro. */}
      <section className="sb-sand-fade pb-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <img
            src={ttd.collage.src}
            alt={ttd.collage.alt}
            width={ttd.collage.w}
            height={ttd.collage.h}
            className="mx-auto block w-full max-w-[760px] h-auto"
          />
          <h2 className="mt-10 font-[family-name:var(--font-display)] font-medium text-3xl sm:text-4xl text-[#222]">
            Within{" "}
            <span className="font-[family-name:Brushine] font-normal tracking-normal text-5xl sm:text-6xl leading-none">
              2 Miles
            </span>{" "}
            of {resort.name}
          </h2>
          <p className="mt-6 max-w-3xl mx-auto text-lg leading-relaxed text-[#333]">
            {ttd.intro}
          </p>
        </div>
      </section>

      {/* Category cards on the search/articles grey, same card style as those pages. */}
      <section className="bg-[#efefef] pt-12 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {CATEGORIES.map((c) => (
            <div
              key={c.key}
              className="rounded-xl overflow-hidden bg-card border border-border transition-all duration-300 hover:shadow-xl"
            >
              <img
                src={c.image}
                alt={c.alt}
                width={900}
                height={600}
                loading="lazy"
                className="block w-full aspect-[3/2] object-cover"
              />
              <div className="px-7 pt-5 pb-8">
                <h3 className="text-center font-[family-name:Brushine] font-normal text-[2.75rem] leading-tight text-[#222]">
                  {c.title}
                </h3>
                <ul className="mt-1 list-disc pl-5 space-y-1.5 text-[15px] text-[#333]">
                  {c.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
