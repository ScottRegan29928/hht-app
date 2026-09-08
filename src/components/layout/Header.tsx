import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Menu, X, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteBrand, useSiteFlags } from "@/lib/siteContext";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

const baseNavLinks = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Find a Villa" },
  { href: "/search?tab=weeks", label: "Search by Week" },
];

export function Header() {
  const brand = useSiteBrand();
  const { siteSlug } = useSiteFlags();

  // Admin-authored pages flagged "show in menu", plus /blog once the site has
  // at least one published post. Both are per-site.
  const navPages = useQuery(api.content.listNavPages, { siteSlug });
  const posts = useQuery(api.content.listPosts, { siteSlug, limit: 1 });

  const navLinks = [
    ...baseNavLinks,
    ...(navPages ?? []).map((p) => ({ href: `/${p.slug}`, label: p.label })),
    ...(posts && posts.length > 0 ? [{ href: "/blog", label: "News" }] : []),
  ];
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";
  // Heritage's hero is a full-bleed photo banner recreated from
  // heritagevacations.com, where the header sits transparently ON the photo
  // rather than as a bar above it. Homepage only — inner pages keep the
  // normal solid header.
  const overlay = siteSlug === "heritage" && isHome;

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center",
              overlay ? "bg-white/15 border border-white/60" : "bg-primary"
            )}>
              <MapPin className={cn("w-5 h-5", overlay ? "text-white" : "text-primary-foreground")} />
            </div>
            <div className="flex flex-col">
              <span className={cn(
                "text-lg font-semibold tracking-tight leading-none font-[family-name:var(--font-display)]",
                overlay ? "text-white drop-shadow-[0_1px_3px_rgba(1,78,108,0.8)]" : "text-foreground"
              )}>
                {brand.wordmarkTop}
              </span>
              <span className={cn(
                "text-xs tracking-widest uppercase font-medium",
                overlay ? "text-white/90 drop-shadow-[0_1px_3px_rgba(1,78,108,0.8)]" : "text-muted-foreground"
              )}>
                {brand.wordmarkBottom}
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  overlay
                    ? cn(
                        "text-white drop-shadow-[0_1px_3px_rgba(1,78,108,0.8)] hover:bg-white/15",
                        location.pathname === link.href && "bg-white/15"
                      )
                    : location.pathname === link.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/search"
              className={cn(
                "ml-2 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                overlay
                  ? "border border-white/70 text-white hover:bg-white/15"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              <Search className="w-4 h-4" />
              Search Properties
            </Link>
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={cn(
              "md:hidden p-2 rounded-lg transition-colors",
              overlay ? "text-white hover:bg-white/15" : "hover:bg-muted"
            )}
          >
            {mobileOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className={cn(
            "md:hidden pb-4 pt-4 space-y-1 border-t",
            // Over the photo the panel needs its own surface or the links
            // are unreadable against the hero image.
            overlay
              ? "border-white/25 bg-[rgba(1,78,108,0.92)] -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8"
              : "border-border"
          )}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
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
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
