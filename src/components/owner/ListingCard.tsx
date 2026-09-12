import { Mail, Phone, MapPin, Clock } from "lucide-react";
import type { Doc } from "../../../convex/_generated/dataModel";
import { KIND_STYLES } from "./portalTheme";

export type Listing = Doc<"marketplaceListings">;

const COMMUNITY_LABEL: Record<string, string> = {
  spicebush: "Spicebush",
  "swallowtail-at-sea-pines": "Swallowtail",
};

export function communityLabel(slug?: string) {
  if (!slug) return "Sea Pines";
  return COMMUNITY_LABEL[slug] ?? slug;
}

export function formatPostedAt(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Owners set their own prices, and legacy rows often have none. */
export function formatPrice(price?: number) {
  if (!price || price <= 0) return "Contact for price";
  return `$${price.toLocaleString("en-US")}`;
}

export function ListingCard({
  listing,
  footer,
}: {
  listing: Listing;
  footer?: React.ReactNode;
}) {
  const { kind } = listing;
  const unitLine = [
    listing.unitNumber ? `Unit ${listing.unitNumber}` : null,
    listing.weekLabel ? `Week ${listing.weekLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const style = KIND_STYLES[kind] ?? KIND_STYLES.for_sale;
  const hasPrice = !!listing.askingPrice && listing.askingPrice > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col gap-3 p-5 pt-4 shadow-[0_1px_2px_rgba(16,27,46,0.05)] hover:shadow-[0_8px_22px_-14px_rgba(16,27,46,0.4)] transition-shadow relative">
      {/* Color rail: kind is readable before any text is */}
      <span
        className={`absolute inset-x-0 top-0 h-1 ${style.dot}`}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase tracking-wide ${style.chip}`}
            >
              {style.label}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="w-3.5 h-3.5" />
              {communityLabel(listing.communitySlug)}
            </span>
          </div>
          <h3 className="font-semibold text-base text-slate-900">
            {unitLine || "Week details on request"}
          </h3>
        </div>

        {kind === "for_sale" && (
          <div className="text-right shrink-0">
            <div
              className={
                hasPrice
                  ? "font-bold text-lg text-slate-900 leading-tight"
                  : "font-semibold text-sm text-slate-500 leading-tight"
              }
            >
              {formatPrice(listing.askingPrice)}
            </div>
            <div className="text-[11px] text-slate-400">asking</div>
          </div>
        )}

        {kind === "trade" && listing.desiredWeekLabel && (
          <div className="text-right shrink-0">
            <div className={`font-bold ${style.text}`}>
              Wants week {listing.desiredWeekLabel}
            </div>
            <div className="text-[11px] text-slate-400">one-time trade</div>
          </div>
        )}
      </div>

      {listing.notes && (
        <p className="text-sm text-slate-600 leading-relaxed">
          {listing.notes}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm pt-1 border-t border-slate-100 mt-auto">
        {listing.contactName && (
          <span className="font-medium pt-2 text-slate-800">
            {listing.contactName}
          </span>
        )}
        {listing.contactPhone && (
          <a
            href={`tel:${listing.contactPhone.replace(/[^\d+]/g, "")}`}
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 pt-2"
          >
            <Phone className="w-3.5 h-3.5" />
            {listing.contactPhone}
          </a>
        )}
        {listing.contactEmail && (
          <a
            href={`mailto:${listing.contactEmail}`}
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 pt-2 break-all"
          >
            <Mail className="w-3.5 h-3.5 shrink-0" />
            {listing.contactEmail}
          </a>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
          <Clock className="w-3 h-3" />
          Posted {formatPostedAt(listing.postedAt)}
        </span>
        {footer}
      </div>
    </div>
  );
}
