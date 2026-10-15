import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Key, X } from "lucide-react";
import { useSiteFlags } from "@/lib/siteContext";
import { useSeo } from "../lib/seo";
import { ContentPage } from "./ContentPage";
import { isResort, resortInfo, type ResortSlug } from "@/lib/resort";

/**
 * Resort "Resource Guides" page (Spicebush + Swallowtail), ported from spicebushatseapines.com/resources/
 * [zoe, 2026-10-01]. Two lead-magnet e-books; each button opens a slide-in panel
 * holding the SAME LeadWorks Connect form the old site uses, so leads land in the
 * same CRM form and the form's own redirect hands over the PDF.
 *
 * ⚠ The forms' redirect URLs point at PDFs on spicebushatseapines.com. Those
 * must be moved (and the forms' redirectUrl updated in Connect) before that
 * domain is cut over to this app, or the downloads 404.
 *
 * Other sites fall through to the admin content page at /resources.
 */

type Guide = {
  key: string;
  title: string;
  cover: string;
  panelImage: string;
  buttonLabel: string;
  formToken: string;
};

// Each resort embeds ITS OWN Connect forms (copied from its old site's
// /resources/ off-canvas panels), so leads stay attributed per resort.
const GUIDES: Record<ResortSlug, Guide[]> = {
  spicebush: [
    {
      key: "timeshares",
      title: "The 4 Secrets to Buying Hilton Head Island Timeshares",
      cover: "/brand/spicebush/resources/cover-timeshares.webp",
      panelImage: "/brand/spicebush/resources/panel-timeshares.webp",
      buttonLabel: "Get The 4 Secrets To Buying Hilton Head Island Timeshares",
      formToken: "ezcryp2c8pq3x3vegdtdfctw",
    },
    {
      key: "vacation",
      title: "How to Get the Most from Your Hilton Head Island Vacation",
      cover: "/brand/spicebush/resources/cover-vacation.webp",
      panelImage: "/brand/spicebush/resources/panel-vacation.webp",
      buttonLabel: "Get How To Get The Most From Your Hilton Head Island Vacation",
      formToken: "wubp3y2lnzf5rlcqi0fj6ewd",
    },
  ],
  // swallowtailatseapines.com/resources/ [zoe, 2026-10-08]
  swallowtail: [
    {
      key: "timeshares",
      title: "The Insider\u2019s Guide to Hilton Head Island Timeshares",
      cover: "/brand/swallowtail/resources/cover-timeshares.webp",
      panelImage: "/brand/swallowtail/resources/panel-timeshares.webp",
      buttonLabel: "Get the Insider's Guide to Hilton Head Island Timeshares",
      formToken: "6c3ritjh2yh1rzx06qh4ulsd",
    },
    {
      key: "vacation",
      title: "The Ultimate Guide to Vacationing on Hilton Head Island",
      cover: "/brand/swallowtail/resources/cover-vacation.webp",
      panelImage: "/brand/swallowtail/resources/panel-vacation.webp",
      buttonLabel: "Get The Ultimate Guide to Vacationing on Hilton Head Island",
      formToken: "008vq8d4s5fdu5172x7wt47o",
    },
  ],
};

// Hero photo framing per resort (Spicebush: living room anchored low to keep
// the sofa; Swallowtail: its old page's sea-turtle beach banner).
const HERO_POS: Record<ResortSlug, string> = {
  spicebush: "50% 72%",
  swallowtail: "50% 55%",
};

const LW_FORM_SRC = "https://connect.lead-works.com/lw-form.js?ver=1.0.0";

declare global {
  interface Window {
    lwFormScan?: () => void;
  }
}

/** Load the Connect renderer once; on later visits just re-scan the DOM. */
function useLwForms() {
  useEffect(() => {
    if (window.lwFormScan) {
      window.lwFormScan();
      return;
    }
    if (document.getElementById("lw-forms-js")) return;
    const s = document.createElement("script");
    s.id = "lw-forms-js";
    s.src = LW_FORM_SRC;
    s.async = true;
    document.body.appendChild(s);
  }, []);
}

export default function ResourcesRoute() {
  const { siteSlug } = useSiteFlags();
  if (!isResort(siteSlug)) return <ContentPage />;
  return <ResourcesPage slug={siteSlug} />;
}

function ResourcesPage({ slug }: { slug: ResortSlug }) {
  const guides = GUIDES[slug];
  const info = resortInfo(slug);
  const [openKey, setOpenKey] = useState<string | null>(null);
  useLwForms();

  useSeo({
    title: "Hilton Head Vacation & Timeshare Guides",
    description:
      `Free guides from ${info.fullName}: ${guides[0].title.replace(/^The /, "the ")} and ${guides[1].title.replace(/^The /, "the ")}.`,
  });

  return (
    <div className="sb-resources">
      {/* Banner: the old page's living-room photo with its script lockup. */}
      <section
        className="relative w-full overflow-hidden"
        style={{
          // Not parallax: a fixed background is sized to the viewport, which
          // crops this photo to the ceiling. Anchored low to keep the sofa.
          backgroundImage: `url(${info.assets}/resources/hero.webp)`,
          backgroundSize: "cover",
          backgroundPosition: HERO_POS[slug],
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-black/35" aria-hidden="true" />
        <div className="relative max-w-4xl mx-auto px-4 py-24 sm:py-32 text-center">
          <h1 className="font-[family-name:var(--font-display)] font-medium text-4xl sm:text-5xl lg:text-6xl text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
            Explore Our{" "}
            <span className="font-[family-name:Brushine] font-normal tracking-normal text-6xl sm:text-7xl lg:text-[5.25rem] leading-none">
              Guides
            </span>
          </h1>
          {/* Same rent/buy pair as the article-end CTA [zoe, 2026-10-01]; the
              sb-closing wrapper supplies the maroon/blue button styling. */}
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

      {/* Covers carry their own drop shadow in the PNG. Guides on the sand band, blue wood bar on top. */}
      <section className="sb-sand-fade pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="-mt-2 sm:mt-0 leading-[1.15] sm:leading-[2.5rem] font-[family-name:var(--font-display)] font-medium text-[2.125rem] sm:text-4xl text-[#222]">
            For a{" "}
            <span className="font-[family-name:Brushine] font-normal tracking-normal text-[3.25rem] sm:text-6xl leading-none">
              Vacation
            </span>{" "}
            to Remember
          </h2>

          <div className="mt-12 grid gap-12 sm:grid-cols-2 sm:gap-10 max-w-3xl mx-auto">
            {guides.map((g) => (
              <div key={g.key} className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setOpenKey(g.key)}
                  className="block w-full max-w-[320px] transition-transform hover:-translate-y-1"
                  aria-label={`Get the ebook: ${g.title}`}
                >
                  <img
                    src={g.cover}
                    alt={`${g.title} ebook cover`}
                    width={732}
                    height={938}
                    loading="lazy"
                    className="block h-auto max-w-none w-[105.48%] -ml-[0.865%]"
                  />
                  {/* Cover PNG has a baked drop shadow: the solid cover is x 6..700 of 732px,
                      so the img is oversized/offset to make the visible cover = button width. */}
                </button>
                <h3 className="font-[family-name:var(--font-display)] font-medium mt-6 text-xl sm:text-2xl leading-snug text-[#222] max-w-[320px] flex-1">
                  {g.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setOpenKey(g.key)}
                  aria-label={`Get your guide: ${g.title}`}
                  className="sb-btn-maroon mt-6 w-full max-w-[320px] px-6 py-4 leading-snug"
                >
                  Get Your Guide
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {guides.map((g) => (
        <GuidePanel
          key={g.key}
          guide={g}
          open={openKey === g.key}
          onClose={() => setOpenKey(null)}
        />
      ))}
    </div>
  );
}

/**
 * Slide-in panel from the right, like the old site's Avada off-canvas. Always
 * mounted (just translated off-screen) so the Connect form renders once and is
 * ready the moment the panel opens.
 */
function GuidePanel({
  guide,
  open,
  onClose,
}: {
  guide: Guide;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-[60] bg-black/70 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div className="pointer-events-none fixed inset-0 z-[61] overflow-hidden">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Get your ebook: ${guide.title}`}
          aria-hidden={!open}
          className={`absolute right-0 top-0 h-full w-full max-w-[420px] bg-white shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
            open ? "pointer-events-auto translate-x-0" : "translate-x-full invisible"
          }`}
        >
          <div className="flex h-full flex-col overflow-y-auto">
            <div className="relative">
              <img
                src={guide.panelImage}
                alt=""
                className="block w-full aspect-[3/2] object-cover"
                style={{ objectPosition: "50% 40%" }}
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-[#891f11] text-white shadow hover:bg-[#6d190e]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 pt-6 pb-10 text-left">
              <h2 className="font-[family-name:var(--font-display)] font-medium text-2xl text-[#222]">Get Your Ebook</h2>
              <h3 className="font-[family-name:var(--font-display)] font-medium mt-1 text-lg leading-snug text-[#222]">{guide.title}</h3>
              <div className="mt-5">
                <div className="lw-form-embed" data-lw-form={guide.formToken} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
