import { Link } from "react-router-dom";
import { MapPin, Phone, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-foreground text-primary-foreground/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold text-primary-foreground font-[family-name:var(--font-display)]">
                Hilton Head Timeshares
              </span>
            </div>
            <p className="text-sm leading-relaxed text-primary-foreground/60">
              Luxury timeshare rentals and sales at Sea Pines on Hilton Head
              Island, South Carolina. Your island getaway awaits.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary-foreground/40 mb-4">
              Explore
            </h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  to="/search"
                  className="text-sm hover:text-primary-foreground transition-colors"
                >
                  Find a Villa
                </Link>
              </li>
              <li>
                <Link
                  to="/search?tab=weeks"
                  className="text-sm hover:text-primary-foreground transition-colors"
                >
                  Search by Week
                </Link>
              </li>
              <li>
                <a
                  href="https://myhiltonheadtimeshare.com/about-us/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-primary-foreground transition-colors"
                >
                  About Us
                </a>
              </li>
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

        <div className="mt-10 pt-8 border-t border-primary-foreground/10 text-center">
          <p className="text-xs text-primary-foreground/40">
            © {new Date().getFullYear()} Hilton Head Timeshares. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
