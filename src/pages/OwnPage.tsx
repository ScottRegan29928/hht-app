import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck,
  Wallet,
  Globe2,
  Wrench,
  Repeat,
  Heart,
  Key,
  Mail,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
} from "lucide-react";
import { useSiteFlags } from "@/lib/siteContext";
import { useSeo } from "../lib/seo";
import { isResort, type ResortSlug } from "@/lib/resort";
import { ContentPage } from "./ContentPage";
import { ContactPanel } from "@/components/layout/ContactPanel";

/**
 * Resort "Why Own" page (Spicebush + Swallowtail; content in CONTENT below). Spicebush version ported from spicebushatseapines.com/own-at-spicebush/
 * [zoe, 2026-10-01]. Keeps the old page's hero, Ownership FAQs and Photo Gallery, and adds
 * a "why own instead of rent" section plus an expanded, schema-marked FAQ for SEO.
 *
 * Facts used here, and where they came from:
 * - 2 bed / 2 bath, sleeps 6, heated pool, fire pit, grills, lagoon views: Convex property
 *   records (24 Spicebush villas) [convex, 2026-10-01].
 * - RCI affiliation: RCI resort directory lists Spicebush as resort #0147 [web, 2026-10-01].
 *   RCI's own count changes, so the copy says "thousands" rather than a number.
 * - Distances: the old page's FAQ copy.
 * - Owner portal (sell, trade, weeks wanted, pay fees online): this app.
 * - Owner-held weeks are never rented by the company, so no rental-income claims.
 */

type GalleryItem = { n: string; alt: string };
type OwnContent = {
  name: string;
  img: string;
  floorPlan: string;
  heroPosition: string;
  seoTitle: string;
  seoDescription: string;
  intro: string;
  residencesImage: GalleryItem;
  residences: string;
  gallery: GalleryItem[];
  benefits: { icon: typeof Heart; title: string; body: string }[];
  compare: { label: string; rent: string; own: string }[];
  faqs: { q: string; a: string }[];
};

const GALLERY: { n: string; alt: string }[] = [
  { n: "01", alt: "Spicebush villas set among tall pines in Sea Pines" },
  { n: "02", alt: "Spicebush villa exterior with a private garage" },
  { n: "03", alt: "Front entry of a Spicebush villa" },
  { n: "04", alt: "Private entry courtyard at a Spicebush villa" },
  { n: "05", alt: "Entry foyer and staircase inside a Spicebush villa" },
  { n: "06", alt: "Bright living room with vaulted ceilings" },
  { n: "07", alt: "Stair landing looking into the kitchen" },
  { n: "08", alt: "Fully equipped villa kitchen" },
  { n: "09", alt: "Kitchen counters and appliances" },
  { n: "10", alt: "Kitchen with a window over the lagoon" },
  { n: "11", alt: "Stacked washer and dryer in the villa" },
  { n: "12", alt: "Kitchen sink and breakfast bar" },
  { n: "13", alt: "Living room with vaulted ceiling and sleeper sofa" },
  { n: "14", alt: "Living room with a flat screen TV" },
  { n: "15", alt: "Dining area with sliding doors to the deck" },
  { n: "16", alt: "Open dining and living area" },
  { n: "17", alt: "Kitchen seen from the breakfast bar" },
  { n: "18", alt: "Dining table set for six" },
  { n: "19", alt: "Private deck with patio table and chairs" },
  { n: "20", alt: "Deck overlooking the lagoon and trees" },
  { n: "21", alt: "Lagoon with a fountain at Spicebush" },
  { n: "22", alt: "Dining room with bar seating" },
  { n: "23", alt: "Living room under the open loft" },
  { n: "24", alt: "Second bedroom with an adjoining bathroom" },
  { n: "25", alt: "Second bedroom with twin beds" },
  { n: "26", alt: "Twin beds in the second bedroom" },
  { n: "27", alt: "Second bedroom with dresser and TV" },
  { n: "28", alt: "Second bedroom with a window seat chair" },
  { n: "29", alt: "Second bathroom with tub and shower" },
  { n: "30", alt: "Master bedroom with a king bed" },
  { n: "31", alt: "Master suite with skylight and ceiling fan" },
  { n: "32", alt: "Master suite sitting area" },
  { n: "33", alt: "Master bath with double vanity" },
  { n: "34", alt: "Master bath with tiled walk-in shower" },
  { n: "35", alt: "Master bedroom with vaulted ceiling" },
  { n: "36", alt: "Upstairs hallway and railing" },
  { n: "37", alt: "Heated community pool surrounded by palms" },
  { n: "38", alt: "Community court at Spicebush" },
  { n: "39", alt: "Picnic area with Adirondack chairs" },
  { n: "40", alt: "Picnic tables and grills by the lagoon" },
  { n: "41", alt: "Community pool on a sunny day" },
  { n: "42", alt: "Fire pit seating area" },
];

const GALLERY_PREVIEW = 8;

const BENEFITS = [
  {
    icon: CalendarCheck,
    title: "Your Week, Every Year",
    body: "No more hoping your dates are open. Your week is reserved for you year after year, Friday to Friday, in a villa you already know and love.",
  },
  {
    icon: Wallet,
    title: "Predictable Costs",
    body: "After a one-time purchase, owners pay an annual maintenance fee instead of nightly rates, cleaning fees, and booking fees that climb every peak season.",
  },
  {
    icon: Globe2,
    title: "Exchange the World",
    body: "Spicebush is an RCI-affiliated resort, so you can trade your week for a stay at thousands of resorts around the world when you want a change of scenery.",
  },
  {
    icon: Wrench,
    title: "No Second-Home Hassles",
    body: "Upkeep, furnishings, and grounds are cared for by the association, so you get the feel of a Sea Pines home without the work or the full cost of one.",
  },
  {
    icon: Repeat,
    title: "Sell or Trade With Ease",
    body: "Your private owner portal lets you list your week for sale, request a one-time trade, post the weeks you want, and pay your maintenance fee online.",
  },
  {
    icon: Heart,
    title: "A Tradition Worth Keeping",
    body: "Many Spicebush owners have been coming back for more than 20 years. A week here becomes the family vacation everyone plans around.",
  },
];

const COMPARE: { label: string; rent: string; own: string }[] = [
  { label: "Your dates", rent: "Subject to availability each year", own: "Your week is yours every year" },
  { label: "Yearly cost", rent: "Nightly rates plus cleaning and booking fees", own: "An annual maintenance fee after a one-time purchase" },
  { label: "Travel elsewhere", rent: "Book and pay for each trip separately", own: "Exchange your week through RCI" },
  { label: "Owner tools", rent: "None", own: "Owner portal to sell, trade, and pay fees online" },
  { label: "Long term", rent: "Nothing to keep", own: "A week you can keep, sell, trade, or share with family" },
];

/** Visible FAQ copy. The same text feeds the FAQPage JSON-LD below. */
const FAQS: { q: string; a: string }[] = [
  {
    q: "What does it mean to own a week at Spicebush?",
    a: "Owning at Spicebush means you own a specific week at a specific villa in Sea Pines. Your week runs Friday to Friday and comes back every year, so you always know where and when your vacation will be.",
  },
  {
    q: "Is owning at Spicebush affordable?",
    a: "Yes. Purchase prices on resale weeks are often lower than people expect, and the annual maintenance fee is competitive and predictable, so there are no surprises. Satisfaction is so high that many owners have been with us for more than 20 years, yet some weeks and choice villas are available today.",
  },
  {
    q: "How do I buy a week at Spicebush?",
    a: "Browse the weeks currently for sale on our Buy a Week page, where you can filter by week number and see each villa. When you find one you like, send an inquiry right from the listing or use the Request Ownership Information form, and our purchase partners at Lighthouse Realty will walk you through the rest.",
  },
  {
    q: "What does the annual maintenance fee cover?",
    a: "The annual maintenance fee covers the cost of operating and caring for the villas and grounds, including upkeep, furnishings, and the shared amenities like the heated pool. Owners can pay it online through the owner portal.",
  },
  {
    q: "Can I exchange my week to vacation somewhere else?",
    a: "Yes. Spicebush is an RCI-affiliated resort, so owners can exchange their week for stays at thousands of RCI resorts around the world, subject to RCI membership and availability.",
  },
  {
    q: "Can I sell or trade my week later?",
    a: "Yes. Every owner gets a private owner portal where you can list your week for sale, request a one-time trade with another owner, and post the weeks you are hoping to find. Our team handles the paperwork when a sale or trade goes through.",
  },
  {
    q: "What are the residences like?",
    a: "Each Spicebush villa has two bedrooms and two bathrooms and sleeps up to six. The open living and dining rooms have high vaulted ceilings and natural light, the master suite has a king bed, a double vanity, and a walk-in shower, and the second bedroom sits on its own level for privacy. Full kitchens, a washer and dryer, and a private deck round it out.",
  },
  {
    q: "What amenities does Spicebush offer?",
    a: "Owners and guests enjoy a heated community pool, a fire pit, picnic tables and grills, lagoon views, free WiFi, and free parking, all inside the gates of Sea Pines on Hilton Head Island.",
  },
  {
    q: "How close is Spicebush to the beach, golf, and shopping?",
    a: "Spicebush is in the heart of Sea Pines, about a quarter mile from the Sea Pines Beach Club, a half mile from The Shops at Sea Pines Center, and less than a mile and a half from Harbour Town. The first tees at Harbour Town Golf Links, Atlantic Dunes, and Heron Point are all within a mile.",
  },
  {
    q: "Are pets allowed at Spicebush?",
    a: "No. Spicebush is a pet-free community, so pets are not allowed in the villas or on the grounds.",
  },
  {
    q: "Will I need my car to get around?",
    a: "Most Spicebush visitors leave the car parked for much of their stay. The beach is a short walk, and the Sea Pines trolley and miles of bike paths connect you to Harbour Town, The Shops at Sea Pines Center, and South Beach.",
  },
  {
    q: "Which week should I buy?",
    a: "Choose the week that fits how you like to vacation. Summer weeks are perfect for families and beach days, spring brings the RBC Heritage golf tournament to Harbour Town, and fall offers warm water, quieter beaches, and great golf weather.",
  },
  {
    q: "Is Spicebush inside Sea Pines?",
    a: "Yes. Spicebush sits inside Sea Pines, the gated resort community at the south end of Hilton Head Island, surrounded by golf courses, nature preserves, and miles of beach.",
  },
];


const SPICEBUSH: OwnContent = {
  name: "Spicebush",
  img: "/brand/spicebush/own",
  floorPlan: "spicebush-floor-plan.pdf",
  heroPosition: "50% 60%",
  seoTitle: "Own a Timeshare Week at Spicebush at Sea Pines, Hilton Head",
  seoDescription:
    "Own your week at Spicebush at Sea Pines on Hilton Head Island. Two bedroom villas near the beach, golf, and Harbour Town, with RCI exchange, predictable costs, and an owner portal.",
  intro:
    "Owning a piece of paradise is easier than you think. Renting is a wonderful way to discover Sea Pines, but owning your week turns a great vacation into a tradition, with your villa, your dates, and a world of exchange options waiting for you every year.",
  residencesImage: { n: "01", alt: "Spicebush villas set among tall pines in Sea Pines" },
  residences:
    "Every Spicebush villa has two spacious bedrooms placed for privacy, two bathrooms, and an open living and dining room with high vaulted ceilings that fill the space with natural light. The master suite features a king bed, a double vanity, a walk-in shower, and a skylight, and the full kitchen comes stocked with everything you need, plus a washer and dryer.",
  gallery: GALLERY,
  benefits: BENEFITS,
  compare: COMPARE,
  faqs: FAQS,
};

/* ───────────────────────── Swallowtail ─────────────────────────
 * Ported from swallowtailatseapines.com/own-at-swallowtail/ [zoe, 2026-10-08].
 * Facts and sources:
 * - 2 bed / 2 bath, sleeps 8, main-floor twin suite, upstairs king master + loft, two sleeper
 *   sofas, private patio: Convex property records (37 Swallowtail villas) [convex, 2026-10-08].
 * - Heated pool, hot tub, covered pavilion, grills: old-site gallery photos + HostAway tags.
 * - Distances, Heron Point fairway, "original specific residence, specific week" history,
 *   recent kitchen/bath renovations, RCI affiliation: the old page's FAQ copy.
 * - Pet-free: confirmed by Zoe [zoe, 2026-10-08]. No rental-income claims (owner weeks never rent).
 */
const SWALLOWTAIL_GALLERY_ALTS = [
  "Swallowtail at Sea Pines entrance sign framed by flowers and pines",
  "Landscaped Swallowtail entrance sign under tall pines",
  "Swallowtail entrance and drive lined with palms",
  "Walkway to the pool pavilion with outdoor grills",
  "Lagoon with a fountain seen from a bench",
  "Fountain on the lagoon framed by palms",
  "Hot tub under the covered pavilion",
  "Heated community pool with lounge chairs and umbrellas",
  "Community pool surrounded by live oaks",
  "Pool deck with lounge chairs and the pavilion",
  "Swallowtail villas beside the community pool",
  "Covered pavilion with a ceiling fan beside the pool",
  "Pavilion seating and hot tub by the pool",
  "Two-story Swallowtail villa among the pines",
  "Villas tucked into the trees",
  "Swallowtail villas and landscaped drive",
  "Private entry courtyard of a Swallowtail villa",
  "Bright entry foyer",
  "Renovated kitchen with white appliances",
  "Kitchen with stone countertops and a breakfast bar",
  "Kitchen cabinets and tile backsplash",
  "Full-size washer and dryer",
  "Kitchen opening to the dining area and stairs",
  "Kitchen sink looking toward the dining room",
  "Kitchen and dining room with pendant light",
  "Dining table set for six beside the open staircase",
  "Living room with sleeper sofa and patio doors",
  "Dining area next to the breakfast bar",
  "Living room with a wall-mounted TV",
  "Living room seating and coffee table",
  "Private patio overlooking the golf course",
  "Patio table and chairs under the live oaks",
  "Patio with sliding doors into the living room",
  "Open living room with the staircase to the loft",
  "Dining and living area with breakfast bar seating",
  "Glass dining table under a lantern light",
  "Dining room looking into the living room",
  "Twin suite with an en-suite bathroom",
  "Twin bedroom on the main floor",
  "Twin bedroom with TV and dresser",
  "Twin beds with coastal bedding",
  "Twin suite bathroom with tub and shower",
  "Second bathroom with tub and shower",
  "Upstairs loft with a sleeper sofa and game table",
  "Loft sitting area with a TV",
  "Loft with game table and sofa",
  "Master suite with a king bed",
  "Master bedroom with ceiling fan and TV",
  "Master bedroom with windows to the trees",
  "Master bath entry",
  "Master bath with double vanity and skylight",
  "Tiled walk-in shower in the master bath",
  "Loft with sofa and game table",
  "Back of a Swallowtail villa facing the course",
  "Live oaks and palms between the villas and the fairway",
  "Grounds shaded by live oaks and palms",
];

const SWALLOWTAIL: OwnContent = {
  name: "Swallowtail",
  img: "/brand/swallowtail/own",
  floorPlan: "swallowtail-floor-plan.pdf",
  heroPosition: "50% 50%",
  seoTitle: "Own a Timeshare Week at Swallowtail at Sea Pines, Hilton Head",
  seoDescription:
    "Own your week at Swallowtail at Sea Pines on Hilton Head Island. Two-story, two-bedroom villas on the Heron Point course, across from The Shops at Sea Pines Center, with RCI exchange and an owner portal.",
  intro:
    "Owning a piece of paradise is easier than you think. Renting is a wonderful way to discover Sea Pines, but owning your week at Swallowtail turns a great vacation into a tradition, with your villa on the fairway, your dates, and a world of exchange options waiting for you every year.",
  residencesImage: { n: "34", alt: "Open living room with the staircase to the loft" },
  residences:
    "Swallowtail's two-story floor plan was a breakthrough in resort living, and recent kitchen and bathroom renovations keep it at the head of its class. A twin suite with its own bath sits on the main floor, the master suite upstairs has a king bed, a double vanity, and a tiled walk-in shower, and a loft with a second sleeper sofa gives everyone room to spread out. Live oaks, Spanish moss, and the Heron Point fairway are right outside your patio.",
  gallery: SWALLOWTAIL_GALLERY_ALTS.map((alt, i) => ({ n: String(i + 1).padStart(2, "0"), alt })),
  benefits: [
    { icon: CalendarCheck, title: "Your Week, Every Year", body: "No more hoping your dates are open. Your week is reserved for you year after year, Friday to Friday, in a villa you already know and love." },
    { icon: Wallet, title: "Predictable Costs", body: "After a one-time purchase, owners pay a competitive annual maintenance fee instead of nightly rates, cleaning fees, and booking fees that climb every peak season." },
    { icon: Globe2, title: "Exchange the World", body: "Swallowtail is an RCI-affiliated resort, so you can trade your week for a stay at thousands of resorts around the world when you want a change of scenery." },
    { icon: Wrench, title: "No Second-Home Hassles", body: "Upkeep, furnishings, and grounds are cared for by the association, so you get the feel of a Sea Pines home on the golf course without the work or the full cost of one." },
    { icon: Repeat, title: "Sell or Trade With Ease", body: "Your private owner portal lets you list your week for sale, request a one-time trade, post the weeks you want, and pay your maintenance fee online." },
    { icon: Heart, title: "A Tradition Worth Keeping", body: "Many Swallowtail owners have been coming back for more than 20 years. A week here becomes the family vacation everyone plans around." },
  ],
  compare: [
    { label: "Your dates", rent: "Subject to availability each year", own: "Your week is yours every year" },
    { label: "Yearly cost", rent: "Nightly rates plus cleaning and booking fees", own: "An annual maintenance fee after a one-time purchase" },
    { label: "Travel elsewhere", rent: "Book and pay for each trip separately", own: "Exchange your week through RCI" },
    { label: "Owner tools", rent: "None", own: "Owner portal to sell, trade, and pay fees online" },
    { label: "Long term", rent: "Nothing to keep", own: "A week you can keep, sell, trade, or share with family" },
  ],
  faqs: [
    { q: "What does it mean to own a week at Swallowtail?", a: "Owning at Swallowtail means you own a specific week at a specific villa in Sea Pines. Swallowtail was one of the original properties to offer specific residences on specific weeks, so you always know where and when your vacation will be. Your week runs Friday to Friday and comes back every year." },
    { q: "Is owning at Swallowtail affordable?", a: "Yes. Purchase prices on resale weeks are often lower than people expect, and the annual maintenance fee is competitive and predictable, so there are no surprises. Satisfaction is so high that many owners have been with us for more than 20 years, yet some weeks and choice villas are available today." },
    { q: "How do I buy a week at Swallowtail?", a: "Browse the weeks currently for sale on our Buy a Week page, where you can filter by week number and see each villa. When you find one you like, send an inquiry right from the listing or use the Request Ownership Information form, and our purchase partners at Lighthouse Realty will walk you through the rest." },
    { q: "What does the annual maintenance fee cover?", a: "The annual maintenance fee covers the cost of operating and caring for the villas and grounds, including upkeep, furnishings, and shared amenities like the heated pool and hot tub. Owners can pay it online through the owner portal." },
    { q: "Can I exchange my week to vacation somewhere else?", a: "Yes. Swallowtail is an RCI-affiliated resort, so owners can exchange their week for stays at thousands of RCI resorts around the world, subject to RCI membership and availability." },
    { q: "Can I sell or trade my week later?", a: "Yes. Every owner gets a private owner portal where you can list your week for sale, request a one-time trade with another owner, and post the weeks you are hoping to find. Our team handles the paperwork when a sale or trade goes through." },
    { q: "What are the residences like?", a: "Each Swallowtail villa is a two-story home with two bedrooms and two bathrooms that sleeps up to eight. A twin suite with its own bath is on the main floor, and the upstairs master suite has a king bed, a double vanity, and a tiled walk-in shower. A loft with a game table and a sleeper sofa, a second sleeper sofa in the living room, a full kitchen, a washer and dryer, and a private patio round it out." },
    { q: "What amenities does Swallowtail offer?", a: "Owners and guests enjoy a heated community pool, a hot tub under a covered pavilion, outdoor grills, a lagoon with a fountain, free WiFi, and free parking, all inside the gates of Sea Pines on Hilton Head Island." },
    { q: "How close is Swallowtail to the beach, golf, and shopping?", a: "Swallowtail sits on the Pete Dye Heron Point course, right between Harbour Town and the Sea Pines Beach Club, each a little more than a half mile away. The Shops at Sea Pines Center is across the street, and the first tees at Harbour Town Golf Links, Atlantic Dunes, and Heron Point are all within a half mile." },
    { q: "Are pets allowed at Swallowtail?", a: "No. Swallowtail is a pet-free community, so pets are not allowed in the villas or on the grounds." },
    { q: "Will I need my car to get around?", a: "Many Swallowtail visitors leave the car parked for most of their stay. The Shops at Sea Pines Center is a stroll across a tree-shaded street, and a short walk, bike ride, or trolley ride takes you to Harbour Town or the beach." },
    { q: "What else is nearby?", a: "The Sea Pines Forest Preserve, with its bridle paths, wetland boardwalks, fishing docks, and 4,000-year-old shell ring, is about two miles away. South Beach, South Beach Marina, and the Salty Dog Cafe are about three miles away by car or trolley." },
    { q: "Which week should I buy?", a: "Choose the week that fits how you like to vacation. Summer weeks are perfect for families and beach days, spring brings the RBC Heritage golf tournament to Harbour Town just down the road, and fall offers warm water, quieter beaches, and great golf weather." },
    { q: "Is Swallowtail inside Sea Pines?", a: "Yes. Swallowtail sits in the heart of Sea Pines, the gated resort community at the south end of Hilton Head Island, surrounded by golf courses, nature preserves, and miles of beach." },
  ],
};

const CONTENT: Record<ResortSlug, OwnContent> = { spicebush: SPICEBUSH, swallowtail: SWALLOWTAIL };

export default function OwnRoute() {
  const { siteSlug } = useSiteFlags();
  if (!isResort(siteSlug)) return <ContentPage />;
  return <OwnPage c={CONTENT[siteSlug]} />;
}

function FaqJsonLd({ faqs }: { faqs: OwnContent["faqs"] }) {
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = "sb-own-faq-ld";
    el.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, [faqs]);
  return null;
}

function OwnPage({ c }: { c: OwnContent }) {
  const IMG = c.img;
  const GALLERY = c.gallery;
  useSeo({
    title: c.seoTitle,
    description: c.seoDescription,
  });
  const [contactOpen, setContactOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const shown = showAll ? GALLERY : GALLERY.slice(0, GALLERY_PREVIEW);

  return (
    <div className="sb-own">
      <FaqJsonLd faqs={c.faqs} />

      {/* Hero: the old page's deck-over-the-lagoon photo. */}
      <section
        className="relative w-full overflow-hidden"
        style={{
          backgroundImage: `url(${IMG}/hero.webp)`,
          backgroundSize: "cover",
          backgroundPosition: c.heroPosition,
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-black/35" aria-hidden="true" />
        <div className="relative max-w-4xl mx-auto px-4 py-24 sm:py-32 text-center">
          <h1 className="font-[family-name:var(--font-display)] font-medium text-4xl sm:text-5xl lg:text-6xl text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
            Own a Piece of{" "}
            <span className="font-[family-name:Brushine] font-normal tracking-normal text-6xl sm:text-7xl lg:text-[5.25rem] leading-none">
              Paradise
            </span>
          </h1>
          <div className="sb-closing mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
            <Link
              to="/search?type=buy"
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-6 py-3 bg-white text-primary rounded-lg font-semibold transition-colors"
            >
              <Key className="w-4 h-4" />
              Browse Weeks for Sale
            </Link>
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-6 py-3 border-2 rounded-lg font-semibold transition-colors sb-own-blue"
            >
              <Mail className="w-4 h-4 shrink-0" />
              Request Ownership Information
            </button>
          </div>
        </div>
      </section>

      {/* Why own: sand band with the blue wood bar, intro and six benefits. */}
      <section className="sb-sand-fade pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="font-[family-name:var(--font-display)] font-medium text-[2rem] sm:text-[2.75rem] text-[#222]">
              Why Own at{" "}
              <span className="font-[family-name:Brushine] font-normal tracking-normal text-[3.25rem] sm:text-[4.25rem] leading-none">
                {c.name}
              </span>
            </h2>
            <p className="mt-[11px] text-lg leading-relaxed text-[#333]">
              {c.intro}
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {c.benefits.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-xl bg-card border border-border p-7 transition-all duration-300 hover:shadow-xl"
              >
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[#891f11] text-white">
                  <Icon className="w-6 h-6" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-[family-name:var(--font-display)] font-medium text-xl text-[#222]">
                  {title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#333]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Renting vs owning comparison. */}
      <section className="bg-[#efefef] pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-center font-[family-name:var(--font-display)] font-medium text-3xl sm:text-4xl text-[#222]">
            Renting vs.{" "}
            <span className="font-[family-name:Brushine] font-normal tracking-normal text-5xl sm:text-6xl leading-none">
              Owning
            </span>
          </h2>
          <div className="mt-[23px] overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-left text-[15px]">
              <thead>
                <tr className="bg-[oklch(0.3_0.07_220)] text-white">
                  <th scope="col" className="px-5 py-4 font-medium w-[26%]"><span className="sr-only">Compare</span></th>
                  <th scope="col" className="px-5 py-4 font-[family-name:var(--font-display)] font-medium tracking-wide">Renting</th>
                  <th scope="col" className="px-5 py-4 font-[family-name:var(--font-display)] font-medium tracking-wide">Owning at {c.name}</th>
                </tr>
              </thead>
              <tbody>
                {c.compare.map((r, i) => (
                  <tr key={r.label} className={i % 2 ? "bg-[#f7f7f7]" : ""}>
                    <th scope="row" className="px-5 py-4 font-semibold text-[#222] align-top">{r.label}</th>
                    <td className="px-5 py-4 text-[#555] align-top">{r.rent}</td>
                    <td className="px-5 py-4 text-[#222] align-top">{r.own}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* The residences + floor plan. */}
      <section className="bg-[#efefef] pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid gap-10 lg:grid-cols-2 items-center">
          <img
            src={`${IMG}/gallery/${c.residencesImage.n}.webp`}
            alt={c.residencesImage.alt}
            width={800}
            height={533}
            loading="lazy"
            className="w-full rounded-xl shadow-lg"
          />
          <div>
            <h2 className="font-[family-name:var(--font-display)] font-medium text-3xl sm:text-4xl text-[#222]">
              The{" "}
              <span className="font-[family-name:Brushine] font-normal tracking-normal text-5xl sm:text-6xl leading-none">
                Residences
              </span>
            </h2>
            <p className="mt-[11px] text-lg leading-relaxed text-[#333]">
              {c.residences}
            </p>
            <a
              href={`${IMG}/${c.floorPlan}`}
              target="_blank"
              rel="noopener"
              className="sb-btn-maroon mt-8 inline-flex gap-2 px-6 py-3"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              View the Floor Plan
            </a>
          </div>
        </div>
      </section>

      {/* Photo gallery on the old page's tree-canopy background. */}
      <section
        className="relative"
        style={{
          backgroundImage: `url(${IMG}/gallery-bg.webp)`,
          backgroundSize: "cover",
          backgroundPosition: "50% 50%",
        }}
      >
        <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="text-center font-[family-name:Brushine] font-normal tracking-normal text-6xl sm:text-7xl leading-none text-white">
            Photo Gallery
          </h2>
          <div className="mt-[23px] grid grid-cols-2 md:grid-cols-4 gap-3">
            {shown.map((g, i) => (
              <button
                key={g.n}
                type="button"
                onClick={() => setLightbox(i)}
                className="group block overflow-hidden rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label={`Open photo: ${g.alt}`}
              >
                <img
                  src={`${IMG}/gallery/${g.n}-thumb.webp`}
                  alt={g.alt}
                  width={640}
                  height={427}
                  loading="lazy"
                  className="block w-full aspect-[3/2] object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </button>
            ))}
          </div>
          {!showAll && (
            <div className="sb-closing mt-10 text-center">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="sb-btn-maroon inline-flex px-6 py-3"
              >
                View All {GALLERY.length} Photos
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Ownership FAQs: native <details> so every answer is in the HTML for search engines. */}
      <section className="sb-sand-fade pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="font-[family-name:var(--font-display)] font-medium text-3xl sm:text-4xl text-[#222]">
              Ownership{" "}
              <span className="font-[family-name:Brushine] font-normal tracking-normal text-5xl sm:text-6xl leading-none">
                FAQs
              </span>
            </h2>
            <p className="mt-[11px] text-lg leading-relaxed text-[#333]">
              Everything you need to know about owning a week at {c.name} at Sea Pines on Hilton Head Island.
            </p>
          </div>
          <div className="mt-10 space-y-3">
            {c.faqs.map((f) => (
              <details key={f.q} className="sb-faq group rounded-md bg-white/85 shadow-sm">
                <summary className="flex cursor-pointer list-none items-center gap-4 px-6 py-5 font-[family-name:var(--font-display)] font-medium text-lg text-[#222]">
                  <Plus className="w-4 h-4 shrink-0 transition-transform group-open:rotate-45" aria-hidden="true" />
                  <h3 className="m-0 text-lg font-medium">{f.q}</h3>
                </summary>
                <p className="px-6 pb-6 pl-14 text-[15px] leading-relaxed text-[#333]">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="sb-btn-maroon inline-flex gap-2 px-6 py-4"
            >
              <Mail className="w-4 h-4" aria-hidden="true" />
              Request Ownership Information
            </button>
          </div>
        </div>
      </section>

      {lightbox !== null && (
        <Lightbox
          items={GALLERY}
          img={IMG}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      )}
      <ContactPanel open={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
}

function Lightbox({
  img,
  items,
  index,
  onClose,
  onIndex,
}: {
  img: string;
  items: { n: string; alt: string }[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const prev = () => onIndex((index - 1 + items.length) % items.length);
  const next = () => onIndex((index + 1) % items.length);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = o;
    };
  });
  const g = items[index];
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Photo gallery"
      onClick={onClose}
    >
      <img
        src={`${img}/gallery/${g.n}.webp`}
        alt={g.alt}
        className="max-h-[85vh] max-w-full rounded-md object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25">
        <X className="w-5 h-5" />
      </button>
      <button type="button" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-3 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-sm bg-[#891f11] text-white hover:bg-[#6d190e]">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button type="button" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-3 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-sm bg-[#891f11] text-white hover:bg-[#6d190e]">
        <ChevronRight className="w-5 h-5" />
      </button>
      <p className="absolute bottom-4 left-0 right-0 text-center text-sm text-white/80">
        {index + 1} / {items.length} · {g.alt}
      </p>
    </div>
  );
}
