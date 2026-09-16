import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Menu, X, MapPin, Search, Phone } from "lucide-react";
import { ContactPanel } from "./ContactPanel";
import { cn } from "@/lib/utils";
import { HeaderSearchBar } from "@/components/search/HeaderSearchBar";
import { useSiteBrand, useSiteFlags } from "@/lib/siteContext";
import { currentHostname, linkForMode } from "@/lib/siteCapabilities";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

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

type NavItem = { href: string; label: string; external: boolean };

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
  if (item.external) {
    return (
      <a href={item.href} className={className} onClick={onClick}>
        {item.label}
      </a>
    );
  }
  return (
    <Link to={item.href} className={className} onClick={onClick}>
      {item.label}
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

  const navLinks = [
    ...baseNavLinks(siteSlug, currentHostname()),
    ...(navPages ?? []).map((pg: { slug: string; label: string }) => ({
      href: `/${pg.slug}`,
      label: pg.label,
      external: false,
    })),
    ...(posts && posts.length > 0
      ? [{ href: "/blog", label: "News", external: false }]
      : []),
  ];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
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
  const spicebush = siteSlug === "spicebush";
  const overlay = (heritage || spicebush) && isHome;
  // Scott supplied the full-color logo (2026-09-08), so the solid inner-page
  // header goes back to the normal light bar with the color lockup. Only the
  // transparent hero overlay is light-on-dark, and it uses the white logo.
  const lightOnDark = overlay;

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
        // for at least 10px of breathing room above it [zoe, 2026-09-16].
        spicebush && "pt-2.5"
      )}>
        {/* When the search pill is present the desktop layout becomes:
            full-height logo pinned left, and nav + pill stacked and centered
            as one group so the nav sits centered over the pill [scott, 2026-09-10]. */}
        <div className={cn(headerSearch && "md:relative")}>
        <div className={cn(
          "flex items-center justify-between h-16 sm:h-20",
          // Let the row grow around Spicebush's taller logo instead of
          // clipping it.
          spicebush && "h-auto min-h-16 sm:h-auto sm:min-h-20 py-2",
          headerSearch && "md:justify-center"
        )}>
          {/* Logo */}
          <Link
            to="/"
            className={cn(
              "flex items-center gap-2.5 group",
              headerSearch && "md:absolute md:left-0 md:inset-y-0 md:z-10"
            )}
          >
            {/* Heritage has a real supplied logo lockup; the other three
                still use the generic pin-and-wordmark. */}
            {heritage ? (
              <img
                src={
                  overlay
                    ? "/brand/hv/logo-horz-white.png"
                    : "/brand/hv/logo-horz-color.png"
                }
                alt={brand.legalName}
                width={180}
                height={55}
                className="h-[44px] sm:h-[55px] w-auto"
              />
            ) : brand.logo ? (
              <img
                src={lightOnDark ? brand.logo.white : brand.logo.color}
                alt={brand.legalName}
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
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavItemLink
                key={link.href}
                item={link}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
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
            {/* Contact opens a slide-in form [scott, 2026-09-08]. */}
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
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
            {!headerSearch && (
            <Link
              to="/search"
              className={cn(
                "ml-2 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                lightOnDark
                  ? "border border-white/70 text-white hover:bg-white/15"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              <Search className="w-4 h-4" />
              Search Properties
            </Link>
            )}
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={cn(
              "md:hidden p-2 rounded-lg transition-colors",
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
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className={cn(
            "md:hidden pb-4 pt-4 space-y-1 border-t",
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
            {navLinks.map((link) => (
              <NavItemLink
                key={link.href}
                item={link}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  overlay
                    ? cn("text-white hover:bg-white/15",
                         location.pathname === link.href && "bg-white/15")
                    : location.pathname === link.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              />
            ))}
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
