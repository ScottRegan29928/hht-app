import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { MapPin, Phone, Mail } from "lucide-react";
import { useSiteBrand, useSiteFlags } from "@/lib/siteContext";
import { currentHostname, linkForMode } from "@/lib/siteCapabilities";
import { HeritageFooter } from "./HeritageFooter";

export function Footer() {
  const { siteSlug } = useSiteFlags();
  // Heritage has its own footer recreated from heritagevacations.com; the
  // other three keep the shared one.
  if (siteSlug === "heritage") return <HeritageFooter />;
  return <SharedFooter />;
}

function SharedFooter() {
  const { siteSlug } = useSiteFlags();
  const navPages = useQuery(api.content.listNavPages, { siteSlug });
  // Same rule as the nav: a half this site doesn't sell links to its sister
  // site, as a real anchor [scott, 2026-09-15].
  const rentLink = linkForMode(siteSlug, "rent", currentHostname());
  const buyLink = linkForMode(siteSlug, "buy", currentHostname());
  const posts = useQuery(api.content.listPosts, { siteSlug, limit: 1 });
  const hasPosts = !!posts && posts.length > 0;
  const brand = useSiteBrand();
  return (
    <footer
      className={[
        "text-primary-foreground/80",
        siteSlug === "spicebush" ? "sb-footer" : "bg-foreground",
      ].join(" ")}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            {brand.logo ? (
              <img
                src={brand.logo.white}
                alt={brand.legalName}
                className="h-[68px] w-auto mb-4"
              />
            ) : (
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold text-primary-foreground font-[family-name:var(--font-display)]">
                {brand.legalName}
              </span>
            </div>
            )}
            <p className="text-sm leading-relaxed text-primary-foreground/60">
              {brand.footerBlurb}
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary-foreground/40 mb-4">
              Explore
            </h3>
            <ul className="space-y-2.5">
              <li>
                {rentLink.external ? (
                  <a
                    href={rentLink.href}
                    className="text-sm hover:text-primary-foreground transition-colors"
                  >
                    Find a Rental
                  </a>
                ) : (
                  <Link
                    to={rentLink.href}
                    className="text-sm hover:text-primary-foreground transition-colors"
                  >
                    Find a Rental
                  </Link>
                )}
              </li>
              <li>
                {buyLink.external ? (
                  <a
                    href={buyLink.href}
                    className="text-sm hover:text-primary-foreground transition-colors"
                  >
                    Buy a Week
                  </a>
                ) : (
                  <Link
                    to={buyLink.href}
                    className="text-sm hover:text-primary-foreground transition-colors"
                  >
                    Buy a Week
                  </Link>
                )}
              </li>
              {/* Admin-managed pages for THIS site. Replaces a hardcoded
                  link to the old myhiltonheadtimeshare.com WordPress page,
                  which sent Spicebush and Swallowtail visitors to another
                  brand entirely. */}
              {(navPages ?? []).map((pg: { slug: string; label: string }) => (
                <li key={pg.slug}>
                  <Link
                    to={`/${pg.slug}`}
                    className="text-sm hover:text-primary-foreground transition-colors"
                  >
                    {pg.label}
                  </Link>
                </li>
              ))}
              {hasPosts && (
                <li>
                  <Link
                    to="/blog"
                    className="text-sm hover:text-primary-foreground transition-colors"
                  >
                    News &amp; Guides
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary-foreground/40 mb-4">
              Contact
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 mt-0.5 shrink-0 text-primary-foreground/40" />
                <div>
                  <p className="text-xs text-primary-foreground/40">
                    Purchase Inquiries
                  </p>
                  <a
                    href="mailto:lisafleming@lighthouserealtyhhi.com"
                    className="text-sm hover:text-primary-foreground transition-colors"
                  >
                    Lighthouse Realty
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 mt-0.5 shrink-0 text-primary-foreground/40" />
                <div>
                  <p className="text-xs text-primary-foreground/40">
                    Rental Inquiries
                  </p>
                  <a
                    href="mailto:asutton@cglhhi.com"
                    className="text-sm hover:text-primary-foreground transition-colors"
                  >
                    The Club Group
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-primary-foreground/10 text-center space-y-3">
          {/* Property-management referral, on all four sites [scott, 2026-09-15].
              clubgrouphhi.com is The Club Group's own management site — note it
              is NOT cglhhi.com, which is the email domain and serves no site. */}
          <p className="sb-referral text-sm text-primary-foreground/70">
            Looking for property management?{" "}
            <a
              href="https://clubgrouphhi.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-primary-foreground transition-colors"
            >
              The Club Group manages Hilton Head properties
            </a>
          </p>
          <p className="sb-copyright text-xs text-primary-foreground/40">
            © {new Date().getFullYear()} {brand.legalName}. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
