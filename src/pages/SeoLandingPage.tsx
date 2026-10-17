import { webp } from "@/lib/heroWebp";
import { Link, useParams } from "react-router-dom";
import { ContentPage } from "./ContentPage";
import { useEffect, useMemo } from "react";
import type React from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  BedDouble,
  Users,
  ShieldCheck,
  MapPin,
  Waves,
  PawPrint,
  CalendarCheck,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { useSeo } from "@/lib/seo";
import { useSite, useSiteFlags } from "@/lib/siteContext";
import { PropertyCard } from "@/components/property/PropertyCard";
import { lockedModeFor } from "@/lib/siteCapabilities";
import { resortInfo } from "@/lib/resort";
import {
  landingFor,
  landingPagesFor,
  type LandingPage,
} from "../../convex/seoLandingData";

/**
 * Code-routed SEO landing pages (Swallowtail first) [scott, 2026-10-08].
 * Copy lives in convex/seoLandingData.ts (generated) so the crawler prerender
 * serves the same words. Routed from the /:slug catch-all via SlugRoute.
 */

// Quick facts strip. Every line is verified (skills/hht_website, BRIEF.md):
// the villas are NOT oceanfront and the community is pet-free.
const FACTS = [
  { icon: BedDouble, label: "2-bedroom, 2-bath two-story villas" },
  { icon: Users, label: "Sleeps up to 8" },
  { icon: ShieldCheck, label: "Inside the Sea Pines gates" },
  { icon: MapPin, label: "A half mile to Harbour Town & the Beach Club" },
  { icon: Waves, label: "Heated pool & hot tub" },
  { icon: PawPrint, label: "Pet-free community" },
];

/** Inline copy: plain text plus [label](/path) links (internal = SPA Link). */
function Md({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const [, label, href] = m;
    const cls = "text-primary underline underline-offset-2 hover:no-underline";
    out.push(
      href.startsWith("/") && !href.endsWith(".pdf") ? (
        <Link key={m.index} to={href} className={cls}>{label}</Link>
      ) : (
        <a key={m.index} href={href} className={cls} {...(href.endsWith(".pdf") ? { target: "_blank", rel: "noopener" } : {})}>{label}</a>
      )
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

function JsonLd({ id, data }: { id: string; data: unknown }) {
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    el.text = JSON.stringify(data);
    document.head.appendChild(el);
    return () => el.remove();
  }, [id, data]);
  return null;
}

function VillaGrid({ siteSlug }: { siteSlug: string }) {
  const featured = useQuery(api.properties.list, { onlyFeatured: true, siteSlug });
  const all = useQuery(api.properties.list, { siteSlug });
  const villas = (featured && featured.length >= 3 ? featured : all) ?? [];
  if (!all) {
    return <div className="py-10 text-center text-muted-foreground">Loading villas…</div>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
      {villas.slice(0, 6).map((p) => (
        <PropertyCard key={p._id} property={p} mode={lockedModeFor(siteSlug) ?? "rent"} />
      ))}
    </div>
  );
}

export function SeoLandingPage({ page }: { page: LandingPage }) {
  const { siteSlug } = useSiteFlags();
  const { scope } = useSite();
  const resort = resortInfo(siteSlug);
  const domain = scope?.site?.domain;
  const all = landingPagesFor(siteSlug);
  const related = page.related
    .map((s) => all.find((p) => p.slug === s))
    .filter((p): p is LandingPage => !!p);

  useSeo({
    title: page.metaTitle,
    description: page.metaDescription,
    ogImageUrl: domain ? `https://${domain}${page.heroImage}` : undefined,
  });

  const faqLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.a.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"),
        },
      })),
    }),
    [page]
  );
  const crumbLd = useMemo(
    () =>
      domain
        ? {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: resort.fullName, item: `https://${domain}/` },
              { "@type": "ListItem", position: 2, name: page.navLabel, item: `https://${domain}/${page.slug}` },
            ],
          }
        : null,
    [domain, page, resort.fullName]
  );

  // The villa grid sits after the second section: high enough to convert,
  // low enough that the page opens with real content.
  const gridAfter = Math.min(1, page.sections.length - 1);

  return (
    <div className="sb-landing">
      <JsonLd id="seo-landing-faq-ld" data={faqLd} />
      {crumbLd && <JsonLd id="seo-landing-crumb-ld" data={crumbLd} />}

      {/* Hero */}
      <section
        className="relative w-full overflow-hidden"
        style={{
          backgroundImage: `url(${webp(page.heroImage)})`,
          backgroundSize: "cover",
          backgroundPosition: "50% 50%",
        }}
      >
        <span className="sr-only">{page.heroAlt}</span>
        <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
        <div className="relative max-w-4xl mx-auto px-4 py-20 sm:py-28 text-center">
          <p className="text-sm sm:text-base uppercase tracking-[0.2em] text-white/90 font-semibold">
            {page.eyebrow}
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] font-medium text-4xl sm:text-5xl lg:text-[3.5rem] leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
            {page.h1}
          </h1>
          <div className="sb-closing mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
            <Link
              to="/search?type=rent"
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-6 py-3 bg-white text-primary rounded-lg font-semibold transition-colors"
            >
              <CalendarCheck className="w-4 h-4" aria-hidden="true" />
              Check Availability
            </Link>
            <a
              href="#villas"
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-6 py-3 border-2 rounded-lg font-semibold transition-colors"
            >
              See the Villas
            </a>
          </div>
        </div>
      </section>

      {/* Intro + quick facts */}
      <section className="sb-sand-fade pb-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-lg sm:text-xl leading-relaxed text-[#333]">
            <Md text={page.intro} />
          </p>
        </div>
        {/* 3-column facts grid on every Stay page [zoe, 2026-10-09]. */}
        <ul className="max-w-4xl mx-auto px-4 sm:px-6 mt-10 grid grid-cols-2 md:grid-cols-3 gap-4">
          {FACTS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex flex-col items-center text-center gap-2 rounded-xl bg-card border border-border px-3 py-5">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#891f11] text-white">
                <Icon className="w-5 h-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-medium text-[#222] leading-snug">{label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Body */}
      {page.sections.map((s, i) => (
        <div key={s.h2}>
          <section className={i % 2 ? "bg-[#f6f4ef] py-14" : "bg-white py-14"}>
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
              {/* Photo breaks up the text-heavy tan sections [zoe, 2026-10-09]. */}
              {s.image && (
                <img
                  src={s.image}
                  alt={s.imageAlt ?? ""}
                  loading="lazy"
                  decoding="async"
                  className="mb-8 w-full aspect-[16/9] object-cover rounded-xl shadow-md"
                />
              )}
              <h2 className="font-[family-name:var(--font-display)] font-medium text-3xl sm:text-[2.25rem] leading-tight text-[#222]">
                {s.h2}
              </h2>
              {s.paragraphs.map((p, j) => (
                <p key={j} className="mt-4 text-[17px] leading-relaxed text-[#333] sb-landing-copy">
                  <Md text={p} />
                </p>
              ))}
              {/* Label/value lists render in the Own page's table style
                  [zoe, 2026-10-09]; bullets stay in the data for the prerender. */}
              {s.table ? (
                <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full text-left text-[15px]">
                    <thead>
                      <tr className="bg-[oklch(0.3_0.07_220)] text-white">
                        {s.table.head.map((h, j) => (
                          <th key={j} scope="col" className={"px-5 py-4 font-[family-name:var(--font-display)] font-medium tracking-wide" + (j === 0 ? " w-[34%]" : "")}>
                            {h || <span className="sr-only">Compare</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.table.rows.map((r, j) => (
                        <tr key={j} className={j % 2 ? "bg-[#f7f7f7]" : ""}>
                          <th scope="row" className="px-5 py-4 font-semibold text-[#222] align-top">{r[0]}</th>
                          {r.slice(1).map((c, k) => (
                            <td key={k} className="px-5 py-4 text-[#444] align-top leading-relaxed"><Md text={c} /></td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : s.bullets && s.bullets.length > 0 && (
                <ul className="mt-5 space-y-2.5">
                  {s.bullets.map((b, j) => (
                    <li key={j} className="flex gap-3 text-[17px] leading-relaxed text-[#333] sb-landing-copy">
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#891f11]" aria-hidden="true" />
                      <span><Md text={b} /></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {i === gridAfter && (
            <section id="villas" className="bg-[#efefef] py-16 scroll-mt-24">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-10">
                  <h2 className="font-[family-name:var(--font-display)] font-medium text-3xl sm:text-4xl text-[#222]">
                    Villas at {resort.fullName}
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    Live rates and availability. Book online in minutes.
                  </p>
                </div>
                <VillaGrid siteSlug={siteSlug} />
                <div className="mt-10 text-center">
                  <Link to="/search?type=rent" className="sb-btn-maroon inline-flex gap-2 px-6 py-3">
                    See All Villas & Rates
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </section>
          )}
        </div>
      ))}

      {/* FAQ in the Own page's table style [zoe, 2026-10-09]. */}
      <section className="bg-[#efefef] py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-center font-[family-name:var(--font-display)] font-medium text-3xl sm:text-4xl text-[#222]">
            Frequently Asked{" "}
            <span className="font-[family-name:Brushine] font-normal tracking-normal text-5xl sm:text-6xl leading-none">
              Questions
            </span>
          </h2>
          <div className="mt-[23px] overflow-hidden rounded-xl border border-border bg-card">
            <div className="bg-[oklch(0.3_0.07_220)] text-white px-5 py-4 font-[family-name:var(--font-display)] font-medium tracking-wide text-[15px]">
              Questions &amp; Answers
            </div>
            {page.faqs.map((f, i) => (
              <details key={f.q} className={"group px-5 py-4" + (i % 2 ? " bg-[#f7f7f7]" : "")}>
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-semibold text-[#222]">
                  <h3 className="text-[15px] sm:text-base">{f.q}</h3>
                  <ChevronDown className="w-5 h-5 mt-0.5 shrink-0 text-[oklch(0.3_0.07_220)] transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-[#444] sb-landing-copy">
                  <Md text={f.a} />
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Related guides */}
      {related.length > 0 && (
        <section className="bg-[#f6f4ef] py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-center font-[family-name:var(--font-display)] font-medium text-3xl sm:text-4xl text-[#222]">
              Plan Your Stay
            </h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  to={`/${r.slug}`}
                  className="group rounded-xl bg-card border border-border p-6 transition-all hover:shadow-xl"
                >
                  <p className="text-xs uppercase tracking-widest text-[#891f11] font-semibold">{r.eyebrow}</p>
                  <h3 className="mt-2 font-[family-name:var(--font-display)] font-medium text-xl text-[#222]">
                    {r.navLabel}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#555] line-clamp-3">{r.metaDescription}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    Read more <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Closing CTA */}
      <section className="sb-sand-section sb-closing py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-[family-name:var(--font-display)] font-medium text-3xl sm:text-4xl">
            Your Sea Pines Villa Is Waiting
          </h2>
          <p className="mt-3 text-lg">
            Pick your dates, choose your villa, and book online with live availability.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
            <Link
              to="/search?type=rent"
              className="inline-flex justify-center items-center gap-2 px-6 py-3 bg-white text-primary rounded-lg font-semibold transition-colors"
            >
              <CalendarCheck className="w-4 h-4" aria-hidden="true" />
              Check Availability
            </Link>
            <Link
              to={`/own-at-${siteSlug}`}
              className="inline-flex justify-center items-center gap-2 px-6 py-3 border-2 rounded-lg font-semibold transition-colors"
            >
              Why Own at {resort.name}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/** The /:slug catch-all: a code-routed landing page wins, else the CMS page (and 404). */
export default function SlugRoute() {
  const { slug } = useParams<{ slug: string }>();
  const { siteSlug } = useSiteFlags();
  const page = slug ? landingFor(siteSlug, slug) : undefined;
  return page ? <SeoLandingPage page={page} /> : <ContentPage />;
}
