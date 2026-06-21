import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  ArrowLeft,
  Bed,
  Bath,
  MapPin,
  Ruler,
  Users,
  Calendar,
  Phone,
} from "lucide-react";
import { PhotoGallery } from "@/components/property/PhotoGallery";
import { WeeksTable } from "@/components/property/WeeksTable";
import { InquiryForm } from "@/components/property/InquiryForm";
import { useState } from "react";

export function PropertyPage() {
  const { slug } = useParams<{ slug: string }>();
  const property = useQuery(api.properties.getBySlug, { slug: slug ?? "" });
  const [showInquiry, setShowInquiry] = useState<{
    type: "purchase" | "rental";
    weekId?: string;
  } | null>(null);

  if (property === undefined) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="animate-pulse space-y-8">
          <div className="h-8 w-48 bg-muted rounded-lg" />
          <div className="h-96 bg-muted rounded-2xl" />
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (property === null) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-2xl font-bold">Property not found</h1>
        <Link
          to="/search"
          className="mt-4 inline-flex items-center gap-2 text-primary hover:text-primary/80"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to search
        </Link>
      </div>
    );
  }

  // Flatten features for display
  const featureList: { category: string; items: string[] }[] = [];
  if (property.features) {
    const f = property.features;
    const entries: [string, string[] | undefined][] = [
      ["Heating", f.heating],
      ["Cooling", f.cooling],
      ["Kitchen", f.kitchen],
      ["Bathroom", f.bathroom],
      ["Entertainment", f.entertainment],
      ["Outdoor", f.outdoor],
      ["Parking", f.parking],
      ["Accessibility", f.accessibility],
      ["Other", f.other],
    ];
    for (const [cat, items] of entries) {
      if (items && items.length > 0) {
        featureList.push({ category: cat, items });
      }
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link
          to={`/community/${property.communitySlug}`}
          className="hover:text-foreground transition-colors"
        >
          {property.communityName}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{property.address}</span>
      </div>

      {/* Photo Gallery */}
      <PhotoGallery photos={property.photos} alt={property.address} />

      {/* Main content */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left column — details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Title + stats */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-display)]">
              {property.address}
            </h1>
            <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              {property.communityName} · Sea Pines Resort · Hilton Head Island
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-5 text-sm">
              <span className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
                <Bed className="w-4 h-4 text-primary" />
                {property.bedrooms}{" "}
                {property.bedrooms === 1 ? "Bedroom" : "Bedrooms"}
              </span>
              <span className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
                <Bath className="w-4 h-4 text-primary" />
                {property.bathrooms}{" "}
                {property.bathrooms === 1 ? "Bathroom" : "Bathrooms"}
              </span>
              {property.sleeps && (
                <span className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
                  <Users className="w-4 h-4 text-primary" />
                  Sleeps {property.sleeps}
                </span>
              )}
              {property.squareFeet && (
                <span className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
                  <Ruler className="w-4 h-4 text-primary" />
                  {property.squareFeet.toLocaleString()} sq ft
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          {property.description && (
            <div>
              <h2 className="text-xl font-semibold font-[family-name:var(--font-display)] mb-3">
                About This Villa
              </h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {property.description}
              </p>
            </div>
          )}

          {/* Features */}
          {featureList.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold font-[family-name:var(--font-display)] mb-4">
                Features & Amenities
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {featureList.map(({ category, items }) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      {category}
                    </h3>
                    <ul className="space-y-1.5">
                      {items.map((item) => (
                        <li
                          key={item}
                          className="flex items-center gap-2 text-sm text-foreground"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Weeks */}
          {property.weeks.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold font-[family-name:var(--font-display)] mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Weeks for Purchase
              </h2>
              <div className="rounded-xl border border-border overflow-hidden bg-card">
                <WeeksTable
                  weeks={property.weeks}
                  onInquire={(week) =>
                    setShowInquiry({ type: "purchase", weekId: week._id })
                  }
                />
              </div>
            </div>
          )}

          {/* House Rules */}
          {property.houseRules && (
            <div>
              <h2 className="text-xl font-semibold font-[family-name:var(--font-display)] mb-3">
                House Rules
              </h2>
              <div className="prose prose-sm text-muted-foreground whitespace-pre-line">
                {property.houseRules}
              </div>
            </div>
          )}

          {/* Cancellation Policy */}
          {property.cancellationPolicy && (
            <div>
              <h2 className="text-xl font-semibold font-[family-name:var(--font-display)] mb-3">
                Cancellation Policy
              </h2>
              <div className="prose prose-sm text-muted-foreground whitespace-pre-line">
                {property.cancellationPolicy}
              </div>
            </div>
          )}
        </div>

        {/* Right column — inquiry sidebar */}
        <div className="space-y-6">
          {/* Inquiry card */}
          <div className="sticky top-28 space-y-4">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              {showInquiry ? (
                <InquiryForm
                  type={showInquiry.type}
                  propertyId={property._id}
                  weekId={showInquiry.weekId as any}
                  propertyName={property.address}
                  onClose={() => setShowInquiry(null)}
                />
              ) : (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold font-[family-name:var(--font-display)]">
                    Interested?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Contact us about purchasing a week or booking a rental at
                    this villa.
                  </p>
                  <button
                    onClick={() => setShowInquiry({ type: "purchase" })}
                    className="w-full py-3 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Make an Offer
                  </button>
                  <button
                    onClick={() => setShowInquiry({ type: "rental" })}
                    className="w-full py-3 border-2 border-primary text-primary rounded-lg text-sm font-semibold hover:bg-primary/5 transition-colors"
                  >
                    Book a Rental
                  </button>
                </div>
              )}
            </div>

            {/* Contact info */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Contact
              </h4>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Purchase Inquiries
                  </p>
                  <a
                    href="mailto:lisafleming@lighthouserealtyhhi.com"
                    className="text-primary hover:text-primary/80 font-medium flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Lighthouse Realty
                  </a>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Rental Inquiries
                  </p>
                  <a
                    href="mailto:asutton@cglhhi.com"
                    className="text-primary hover:text-primary/80 font-medium flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    The Club Group
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
