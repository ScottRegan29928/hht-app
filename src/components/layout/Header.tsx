import { Link, useLocation } from "react-router-dom";
import { blogBase, blogNavLabel } from "../../lib/blogPaths";
import { useState } from "react";
import { Menu, X, MapPin, Search, Phone, Home, ChevronDown } from "lucide-react";
import { ContactPanel } from "./ContactPanel";
import { cn } from "@/lib/utils";
import { HeaderSearchBar } from "@/components/search/HeaderSearchBar";
import { useSiteBrand, useSiteFlags } from "@/lib/siteContext";
import { currentHostname, linkForMode } from "@/lib/siteCapabilities";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { isResort, resortInfo } from "@/lib/resort";
import { landingNavFor } from "../../../convex/seoLandingNav";

// "Stay" menu groups for the code-routed SEO landing pages [scott, 2026-10-08].
const STAY_GROUPS: Array<{ key: "rentals" | "guides" | "ownership"; label: string }> = [
  { key: "rentals", label: "Vacation Rentals" },
  { key: "guides", label: "Plan Your Trip" },
  { key: "ownership", label: "Timeshares" },
];

/**
 * Both flagship sites keep both items; the half a site doesn't sell points at
 * its sister site instead [scott, 2026-09-15].
 */
function baseNavLinks(siteSlug: string, hostname: string) {
  const rent = linkForMode(siteSlug, "rent", hostname);
  const buy = linkForMode(siteSlug, "buy", hostname);
  return [
    { href: "/", label: "Home", external: false },
    { href: rent.href, label: "Find a Rental", external: rent.external },
    { href: buy.href, label: "Buy a Week", external: buy.external },
  ];
}

type NavItem = { href: string; label: string; external: boolean; icon?: boolean };

/**
 * A cross-site nav item has to be a real anchor: react-router would treat the
 * absolute URL as an in-app path and render this site's 404 instead.
 */
function NavItemLink({
  item,
  className,
  onClick,
}: {
  item: NavItem;
  className: string;
  onClick?: () => void;
}) {
  // Spicebush shows Home as a house icon [zoe, 2026-10-01]; the label stays
  // for screen readers, and the mobile menu passes icon:false to show the word.
  const content = item.icon ? (
    <>
      <Home className="w-4 h-4" aria-hidden="true" />
      <span className="sr-only">{item.label}</span>
    </>
  ) : (
    item.label
  );
  if (item.external) {
    return (
      <a href={item.href} className={className} onClick={onClick} aria-label={item.icon ? item.label : undefined}>
        {content}
      </a>
    );
  }
  return (
    <Link to={item.href} className={className} onClick={onClick} aria-label={item.icon ? item.label : undefined}>
      {content}
    </Link>
  );
}

export function Header() {
  const brand = useSiteBrand();
  const { siteSlug } = useSiteFlags();

  // Admin-authored pages flagged "show in menu", plus /blog once the site has
  // at least one published post. Both are per-site.
  const navPages = useQuery(api.content.listNavPages, { siteSlug });
  const posts = useQuery(api.content.listPosts, { siteSlug, limit: 1 });

  const hasPosts = !!(posts && posts.length > 0);
  // Spicebush nav, approved by Zoe 2026-10-01: house icon, Find a Rental,
  // Buy a Week, Own at Spicebush, Explore dropdown, Contact.
  const isSpicebush = isResort(siteSlug);
  const exploreLinks: NavItem[] = isSpicebush
    ? [
        { href: "/things-to-do", label: "Things to Do", external: false },
        ...(hasPosts
          ? [{ href: blogBase(siteSlug), label: blogNavLabel(siteSlug), external: false }]
          : []),
        { href: "/resources", label: "Resource Guides", external: false },
        ...(navPages ?? []).map((pg: { slug: string; label: string }) => ({
          href: `/${pg.slug}`,
          label: pg.label,
          external: false,
        })),
      ]
    : [];
  const spicebushLinks: NavItem[] = isSpicebush
    ? [
        ...baseNavLinks(siteSlug, currentHostname()).map((l) =>
          l.href === "/" ? { ...l, icon: true } : l
        ),
        {
          href: `/own-at-${siteSlug}`,
          label: `Why Own at ${resortInfo(siteSlug).name}`,
          external: false,
        },
      ]
    : [];
  const [exploreOpen, setExploreOpen] = useState(false);
  // New SEO pages get a nav home, not "out of nav" [scott, 2026-10-08].
  const landing = landingNavFor(siteSlug);
  const stayGroups = STAY_GROUPS.map((g) => ({
    ...g,
    links: landing
      .filter((p) => p.group === g.key)
      .map((p) => ({ href: `/${p.slug}`, label: p.navLabel, external: false } as NavItem)),
  })).filter((g) => g.links.length > 0);
  const stayLinks = stayGroups.flatMap((g) => g.links);
  const [stayOpen, setStayOpen] = useState(false);

  const navLinks: NavItem[] = isSpicebush ? spicebushLinks : [
    ...baseNavLinks(siteSlug, currentHostname()),
    ...(navPages ?? []).map((pg: { slug: string; label: string }) => ({
      href: `/${pg.slug}`,
      label: pg.label,
      external: false,
    })),
    ...(posts && posts.length > 0
      ? [{ href: blogBase(siteSlug), label: blogNavLabel(siteSlug), external: false }]
      : []),
  ];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileStayOpen, setMobileStayOpen] = useState(false);
  const [mobileExploreOpen, setMobileExploreOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";
  // Heritage's hero is a full-bleed photo banner recreated from
  // heritagevacations.com, where the header sits transparently ON the photo
  // rather than as a bar above it. Homepage only — inner pages keep the
  // normal solid header.
  const heritage = siteSlug === "heritage";
  // mhht carries an Airbnb-style search pill under the nav [scott, 2026-09-10],
  // which makes the "Search Properties" button redundant there.
  const headerSearch = siteSlug === "mhht";
  // Spicebush's hero is a recreation of spicebushatseapines.com, where the
  // header sits transparently ON the photo [zoe, 2026-09-16]. Homepage only.
  const spicebush = isResort(siteSlug);
  const overlay = (heritage || spicebush) && isHome;
  // Scott supplied the full-color logo (2026-09-08), so the solid inner-page
  // header goes back to the normal light bar with the color lockup. Only the
  // transparent hero overlay is light-on-dark, and it uses the white logo.
  const lightOnDark = overlay;

  // "Search Properties" used to be a plain link to /search, so on the rental
  // page itself it did nothing [justin via scott, 2026-10-17]. It now opens
  // the same Where/When/Who search pill mhht carries, in a row under the nav.
  const searchLink = (
            <button
              type="button"
              onClick={() => setSearchOpen((o) => !o)}
              aria-expanded={searchOpen}
              className={cn(
                "ml-2 flex items-center whitespace-nowrap gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                lightOnDark
                  ? "border border-white/70 text-white hover:bg-white/15"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              Search Properties
            </button>
  );

  return (
    <header
      className={cn(
        "z-50 transition-all duration-300",
        overlay
          ? "absolute inset-x-0 top-0 bg-transparent"
          : isHome
              ? "sticky top-0 bg-white/80 backdrop-blur-xl border-b border-border/50"
              : "sticky top-0 bg-white border-b border-border"
      )}
    >
      <div className={cn(
        "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
        // Spicebush's lockup is taller than the standard 80px header row, so
        // the butterfly was cropped against the top of the screen. Zoe asked
        // for at least 10px of breathing room above it, matched below it so
        // the lockup sits evenly inside the bar on inner pages [zoe, 2026-09-16].
        spicebush && "py-2.5"
      )}>
        {/* When the search pill is present the desktop layout becomes:
            full-height logo pinned left, and nav + pill stacked and centered
            as one group so the nav sits centered over the pill [scott, 2026-09-10]. */}
        <div className={cn(headerSearch && "md:relative")}>
        <div className={cn(
          "flex items-center justify-between h-16 sm:h-20",
          // Let the row grow around Spicebush's taller logo instead of
          // clipping it.
          spicebush && "h-auto min-h-16 sm:h-auto sm:min-h-20 py-2 2xl:grid 2xl:grid-cols-[1fr_auto_1fr]",
          headerSearch && "md:justify-center"
        )}>
          {/* Logo */}
          <Link
            to="/"
            className={cn(
              "flex items-center gap-2.5 group",
              // Breathing room between the lockup and the Home icon; the resort
              // nav items drop to px-3 to pay for it [zoe, 2026-10-09].
              spicebush && "2xl:justify-self-start mr-8",
              headerSearch && "md:absolute md:left-0 md:inset-y-0 md:z-10"
            )}
          >
            {/* Heritage has a real supplied logo lockup; the other three
                still use the generic pin-and-wordmark. */}
            {heritage ? (
              <img
                src={
                  overlay
                    ? "/brand/hv/logo-horz-white.webp"
                    : "/brand/hv/logo-horz-color.webp"
                }
                alt={brand.legalName}
                width={153}
                height={55}
                className="h-[44px] sm:h-[55px] w-auto"
              />
            ) : brand.logo ? (
              <img
                src={lightOnDark ? brand.logo.white : brand.logo.color}
                alt={brand.legalName}
                width={brand.logo.width}
                height={brand.logo.height}
                className={cn(
                  brand.logo.className ?? "h-[44px] sm:h-[55px] w-auto",
                  // md: comes after sm: in the cascade, so this wins.
                  headerSearch && "md:h-full md:py-2 w-auto object-contain"
                )}
              />
            ) : (
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center",
              overlay ? "bg-white/15 border border-white/60" : "bg-primary"
            )}>
              <MapPin className={cn("w-5 h-5", overlay ? "text-white" : "text-primary-foreground")} />
            </div>
            )}
            {!heritage && !brand.logo && (
            <div className="flex flex-col">
              <span className={cn(
                "text-lg font-semibold tracking-tight leading-none font-[family-name:var(--font-display)]",
                lightOnDark ? "text-white drop-shadow-[0_1px_3px_rgba(1,78,108,0.8)]" : "text-foreground"
              )}>
                {brand.wordmarkTop}
              </span>
              <span className={cn(
                "text-xs tracking-widest uppercase font-medium",
                lightOnDark ? "text-white/90 drop-shadow-[0_1px_3px_rgba(1,78,108,0.8)]" : "text-muted-foreground"
              )}>
                {brand.wordmarkBottom}
              </span>
            </div>
            )}
          </Link>

          {/* Desktop nav */}
          {/* Spicebush switches to the menu button below xl [zoe, 2026-10-01]. */}
          <nav className={cn("hidden items-center gap-1", spicebush ? "xl:flex" : "md:flex")}>
            {navLinks.map((link) => (
              <NavItemLink
                key={link.href}
                item={link}
                className={cn(
                  spicebush ? "px-3" : "px-4",
                  "py-2 rounded-lg text-sm font-medium transition-colors",
                  lightOnDark
                    ? cn(
                        "text-white drop-shadow-[0_1px_3px_rgba(1,78,108,0.8)] hover:bg-white/15",
                        location.pathname === link.href && "bg-white/15"
                      )
                    : location.pathname === link.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              />
            ))}
            {stayLinks.length > 0 && (
              <div
                className="relative"
                onMouseEnter={() => setStayOpen(true)}
                onMouseLeave={() => setStayOpen(false)}
              >
                <button
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={stayOpen}
                  onClick={() => setStayOpen((o) => !o)}
                  className={cn(
                    spicebush ? "px-3" : "px-4",
                    "flex items-center gap-1 py-2 rounded-lg text-sm font-medium transition-colors",
                    lightOnDark
                      ? cn("text-white drop-shadow-[0_1px_3px_rgba(1,78,108,0.8)] hover:bg-white/15",
                           stayLinks.some((l) => location.pathname === l.href) && "bg-white/15")
                      : stayLinks.some((l) => location.pathname === l.href)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  Stay
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", stayOpen && "rotate-180")} />
                </button>
                {stayOpen && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 z-50">
                    <div className="sb-explore-menu w-[min(860px,92vw)] rounded-lg bg-white shadow-lg border border-border p-5 grid grid-cols-3 gap-6">
                      {stayGroups.map((g) => (
                        <div key={g.key}>
                          <p className="px-2 pb-2 text-xs uppercase tracking-widest font-semibold text-muted-foreground/70">
                            {g.label}
                          </p>
                          {g.links.map((link) => (
                            <NavItemLink
                              key={link.href}
                              item={link}
                              onClick={() => setStayOpen(false)}
                              className={cn(
                                "block px-2 py-1.5 rounded text-sm font-medium transition-colors",
                                location.pathname === link.href
                                  ? "bg-primary/10 text-primary"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              )}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {exploreLinks.length > 0 && (
              <div
                className="relative"
                onMouseEnter={() => setExploreOpen(true)}
                onMouseLeave={() => setExploreOpen(false)}
              >
                <button
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={exploreOpen}
                  onClick={() => setExploreOpen((o) => !o)}
                  className={cn(
                    spicebush ? "px-3" : "px-4",
                    "flex items-center gap-1 py-2 rounded-lg text-sm font-medium transition-colors",
                    lightOnDark
                      ? cn("text-white drop-shadow-[0_1px_3px_rgba(1,78,108,0.8)] hover:bg-white/15",
                           exploreLinks.some((l) => location.pathname.startsWith(l.href)) && "bg-white/15")
                      : exploreLinks.some((l) => location.pathname.startsWith(l.href))
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  Explore
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", exploreOpen && "rotate-180")} />
                </button>
                {exploreOpen && (
                  <div className="absolute left-0 top-full pt-2 z-50">
                    <div className="sb-explore-menu min-w-[200px] rounded-lg bg-white shadow-lg border border-border py-2">
                      {exploreLinks.map((link) => (
                        <NavItemLink
                          key={link.href}
                          item={link}
                          onClick={() => setExploreOpen(false)}
                          className={cn(
                            "block px-4 py-2 text-sm font-medium transition-colors",
                            location.pathname.startsWith(link.href)
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Contact opens a slide-in form [scott, 2026-09-08]. */}
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className={cn(
                spicebush ? "px-3" : "px-4",
                "py-2 rounded-lg text-sm font-medium transition-colors",
                lightOnDark
                  ? "text-white drop-shadow-[0_1px_3px_rgba(1,78,108,0.8)] hover:bg-white/15"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              Contact
            </button>
            {brand.phoneDisplay && (
              <a
                href={brand.phoneHref}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  lightOnDark
                    ? "text-white drop-shadow-[0_1px_3px_rgba(1,78,108,0.8)] hover:bg-white/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Phone className="w-3.5 h-3.5" />
                {brand.phoneDisplay}
              </a>
            )}
            {!headerSearch && !spicebush && searchLink}
          </nav>
          {/* Spicebush: logo left, links centered, Search pinned right [zoe, 2026-10-01]. */}
          {spicebush && (
            <div className="hidden xl:flex 2xl:justify-self-end">{searchLink}</div>
          )}

          {/* Mobile menu button */}
          <button
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen(!mobileOpen)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              spicebush ? "xl:hidden" : "md:hidden",
              lightOnDark ? "text-white hover:bg-white/15" : "hover:bg-muted"
            )}
          >
            {mobileOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Airbnb-style search pill — its own row under the nav. */}
        {headerSearch && (
          <div className="flex justify-center pb-3 sm:pb-4">
            <HeaderSearchBar dark={lightOnDark} />
          </div>
        )}
        {!headerSearch && searchOpen && (
          <div className="flex justify-center pb-3 sm:pb-4">
            <HeaderSearchBar dark={lightOnDark} onSearched={() => setSearchOpen(false)} />
          </div>
        )}
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className={cn(
            // The header is sticky, so a long menu must scroll inside itself
            // or its bottom half is unreachable on tablets [zoe, 2026-10-09].
            "pb-4 pt-4 space-y-1 border-t max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain",
            spicebush ? "xl:hidden" : "md:hidden",
            // Over the photo the panel needs its own surface or the links
            // are unreadable against the hero image.
            overlay
              ? cn(
                  "border-white/25",
                  // Heritage's panel is teal; Spicebush's brand is the maroon
                  // and charcoal from spicebushatseapines.com.
                  spicebush ? "bg-[rgba(37,41,43,0.94)]" : "bg-[rgba(1,78,108,0.92)]"
                ) + " -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8"
              : "border-border"
          )}>
            {/* Stay and Explore collapse like the desktop dropdowns, so the
                menu shows every top-level item without a long scroll
                [zoe, 2026-10-09]. */}
            {(() => {
              const linkCls = (href: string, indent = false) => cn(
                "block py-3 rounded-lg text-sm font-medium transition-colors",
                indent ? "pl-8 pr-4" : "px-4",
                overlay
                  ? cn("text-white hover:bg-white/15", location.pathname === href && "bg-white/15")
                  : location.pathname === href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
              );
              const labelCls = cn(
                "pl-8 pr-4 pt-3 pb-1 text-xs uppercase tracking-widest font-semibold",
                overlay ? "text-white/60" : "text-muted-foreground/70"
              );
              const toggle = (label: string, open: boolean, onClick: () => void) => (
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={onClick}
                  className={cn(linkCls("#"), "w-full flex items-center justify-between text-left")}
                >
                  {label}
                  <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
                </button>
              );
              const close = () => setMobileOpen(false);
              return (
                <>
                  {navLinks.map((l) => (
                    <NavItemLink key={l.href} item={{ ...l, icon: false }} onClick={close} className={linkCls(l.href)} />
                  ))}
                  {stayLinks.length > 0 && toggle("Stay", mobileStayOpen, () => setMobileStayOpen((o) => !o))}
                  {mobileStayOpen && stayGroups.map((g) => (
                    <div key={g.label}>
                      <div className={labelCls}>{g.label}</div>
                      {g.links.map((l) => (
                        <NavItemLink key={l.href} item={l} onClick={close} className={linkCls(l.href, true)} />
                      ))}
                    </div>
                  ))}
                  {exploreLinks.length > 0 && toggle("Explore", mobileExploreOpen, () => setMobileExploreOpen((o) => !o))}
                  {mobileExploreOpen && exploreLinks.map((l) => (
                    <NavItemLink key={l.href} item={l} onClick={close} className={linkCls(l.href, true)} />
                  ))}
                </>
              );
            })()}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setContactOpen(true);
              }}
              className={cn(
                "block w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                lightOnDark
                  ? "text-white hover:bg-white/15"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              Contact
            </button>
            {!headerSearch && <button
              type="button"
              onClick={() => { setMobileOpen(false); setSearchOpen(true); }}
              className={cn("block w-full text-left px-4 py-3 rounded-lg text-sm font-medium", lightOnDark ? "text-white hover:bg-white/15" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
            >Search Properties</button>}
            {brand.phoneDisplay && (
              <a
                href={brand.phoneHref}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  lightOnDark
                    ? "text-white hover:bg-white/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Phone className="w-4 h-4" />
                {brand.phoneDisplay}
              </a>
            )}
          </nav>
        )}
      </div>
      <ContactPanel open={contactOpen} onClose={() => setContactOpen(false)} />
    </header>
  );
}
