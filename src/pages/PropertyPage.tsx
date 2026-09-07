import { useParams, Link, useSearchParams } from "react-router-dom";
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

  FileText,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Moon,
  Key,
  ArrowRight,
} from "lucide-react";
import { PhotoGallery } from "@/components/property/PhotoGallery";
import { InquiryForm } from "@/components/property/InquiryForm";
import { PropertyMap } from "@/components/property/PropertyMap";
import { FeatureGrid } from "@/components/property/FeatureGrid";
import { AvailabilityCalendar, useBookedDates } from "@/components/AvailabilityCalendar";
import { useState, useMemo } from "react";
import { formatWeekRange, getNext52Weeks } from "@/lib/weekCalendar";
import { AlertCircle } from "lucide-react";

export function PropertyPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const property = useQuery(api.properties.getBySlug, { slug: slug ?? "" });

  // Mode from URL: buy, rent, or unset
  const mode = searchParams.get("mode") ?? null;
  const isBuy = mode === "buy";
  const isRent = mode === "rent";

  // Rent dates from URL
  const initialCheckIn = searchParams.get("checkIn") ?? "";
  const initialCheckOut = searchParams.get("checkOut") ?? "";
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);

  const [showInquiry, setShowInquiry] = useState<{
    type: "purchase" | "rental";
    weekId?: string;
    weekNumber?: number;
  } | null>(null);
  const [weeksExpanded, setWeeksExpanded] = useState(true);
  // Rolling 52-week data for buy mode
  const next52Weeks = useMemo(() => getNext52Weeks(), []);

  // ── ALL hooks must be above the early returns ──
  // Calculate rental nights from dates
  const rentalNights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const d1 = new Date(checkIn + "T12:00:00");
    const d2 = new Date(checkOut + "T12:00:00");
    return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 86400000));
  }, [checkIn, checkOut]);

  // Build internal checkout URL with pre-filled dates (safe when property is null/loading)
  const bookingHref = useMemo(() => {
    if (!property) return "#";
    const params = new URLSearchParams();
    params.set("propertyId", property._id);
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    return `/checkout?${params.toString()}`;
  }, [property, checkIn, checkOut]);

  const today = new Date().toISOString().split("T")[0];

  // Check for date conflicts with existing bookings
  const { bookedDates } = useBookedDates(property?._id);
  const hasDateConflict = useMemo(() => {
    if (!checkIn || !checkOut || bookedDates.size === 0) return false;
    const start = new Date(checkIn + "T00:00:00");
    const end = new Date(checkOut + "T00:00:00");
    const cur = new Date(start);
    while (cur < end) {
      if (bookedDates.has(cur.toISOString().slice(0, 10))) return true;
      cur.setDate(cur.getDate() + 1);
    }
    return false;
  }, [checkIn, checkOut, bookedDates]);

  // ── Early returns (after all hooks) ──
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

  // ── Derived values (not hooks, safe after early returns) ──
  const hasLocation = property.latitude && property.longitude;
  const hasWeeks = property.weeks.length > 0;
  const saleWeeks = property.weeks.filter(
    (w: any) => w.listingType === "sale" || w.listingType === "both" || !w.listingType
  );
  const nightlyRate = (property as any).nightlyRate ?? null;
  const totalRentalPrice = nightlyRate && rentalNights > 0 ? nightlyRate * rentalNights : null;

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
              {property.communityName} · Sea Pines · Hilton Head Island
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
              <div className="text-muted-foreground leading-relaxed space-y-4">
                {property.description
                  .split(/\n+/)
                  .filter((p: string) => p.trim())
                  .map((paragraph: string, i: number) => (
                    <p key={i}>{paragraph.trim()}</p>
                  ))}
              </div>
            </div>
          )}

          {/* Availability Calendar */}
          <AvailabilityCalendar
            propertyId={property._id}
            selectedRange={isRent && checkIn && checkOut ? { checkIn, checkOut } : undefined}
          />

          {/* Amenities (from Hostaway sync) */}
          {property.amenityTags && property.amenityTags.length > 0 ? (
            <div>
              <h2 className="text-xl font-semibold font-[family-name:var(--font-display)] mb-5">
                Amenities
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {property.amenityTags.map((tag: string) => (
                  <div key={tag} className="flex items-center gap-2 text-sm text-gray-700 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                    {tag}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Features (legacy) */}
          {!property.amenityTags?.length && ((property.communityFeatures && Object.keys(property.communityFeatures).length > 0) || property.featureCategories) ? (
            <div>
              <h2 className="text-xl font-semibold font-[family-name:var(--font-display)] mb-5">
                Features
              </h2>
              <FeatureGrid
                features={
                  (property.communityFeatures && Object.keys(property.communityFeatures).length > 0
                    ? property.communityFeatures
                    : property.featureCategories) as Record<string, string>
                }
              />
            </div>
          ) : null}

          {/* Map Location */}
          {hasLocation && (
            <div>
              <h2 className="text-xl font-semibold font-[family-name:var(--font-display)] mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Location
              </h2>
              <PropertyMap
                latitude={property.latitude!}
                longitude={property.longitude!}
                address={property.address}
                communityName={property.communityName}
              />
            </div>
          )}

          {/* Quick Links */}
          {(property.calendarUrl || property.ownerDocsUrl) && (
            <div>
              <h2 className="text-xl font-semibold font-[family-name:var(--font-display)] mb-4">
                Resources
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {property.calendarUrl && (
                  <a
                    href={property.calendarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all group"
                  >
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Annual Calendar</p>
                      <p className="text-xs text-muted-foreground">View week schedule (PDF)</p>
                    </div>
                  </a>
                )}
                {property.ownerDocsUrl && (
                  <a
                    href={property.ownerDocsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all group"
                  >
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Owner Documents</p>
                      <p className="text-xs text-muted-foreground">Access owner resources</p>
                    </div>
                  </a>
                )}
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

        {/* ── Right column — sidebar ── */}
        <div className="space-y-6">
          <div className="sticky top-28 space-y-4">

            {/* ══ Buy Mode Sidebar ══ */}
            {isBuy && (
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                {showInquiry ? (
                  <InquiryForm
                    type={showInquiry.type}
                    propertyId={property._id}
                    weekId={showInquiry.weekId as any}
                    weekNumber={showInquiry.weekNumber}
                    propertyName={property.address}
                    onClose={() => setShowInquiry(null)}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Key className="w-5 h-5 text-primary" />
                      <h3 className="text-lg font-semibold font-[family-name:var(--font-display)]">
                        Weeks for Purchase
                      </h3>
                    </div>

                    {saleWeeks.length > 0 ? (
                      <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                        {saleWeeks.map((week: any) => {
                          // Find the next upcoming occurrence of this week number
                          const upcoming = next52Weeks.find((w) => w.weekNumber === week.weekNumber);
                          const yr = upcoming?.year ?? new Date().getFullYear();
                          const dateRange = formatWeekRange(week.weekNumber, yr);
                          return (
                            <div
                              key={week._id}
                              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/30"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground">
                                  Week {week.weekNumber}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {dateRange}
                                </p>
                                <p className="text-xs text-primary font-medium mt-0.5">
                                  {week.price
                                    ? `$${week.price.toLocaleString()}`
                                    : week.priceLabel || "Contact for pricing"}
                                </p>
                              </div>
                              <button
                                onClick={() =>
                                  setShowInquiry({
                                    type: "purchase",
                                    weekId: week._id,
                                    weekNumber: week.weekNumber,
                                  })
                                }
                                className="px-3 py-1.5 border border-primary text-primary rounded-md text-xs font-semibold hover:bg-primary/10 transition-colors shrink-0"
                              >
                                Make Offer
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        <p>No weeks currently listed for purchase.</p>
                        <button
                          onClick={() => setShowInquiry({ type: "purchase" })}
                          className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                        >
                          Inquire About Availability
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ══ Rent Mode Sidebar ══ */}
            {isRent && (
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold font-[family-name:var(--font-display)]">
                      Book This Villa
                    </h3>
                  </div>

                  {nightlyRate && (
                    <p className="text-2xl font-bold text-foreground">
                      ${nightlyRate}
                      <span className="text-base font-normal text-muted-foreground">/night</span>
                    </p>
                  )}

                  {/* Date picker */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Check-in
                      </label>
                      <input
                        type="date"
                        value={checkIn}
                        min={today}
                        onChange={(e) => {
                          setCheckIn(e.target.value);
                          if (checkOut && e.target.value && checkOut <= e.target.value) {
                            const next = new Date(e.target.value);
                            next.setDate(next.getDate() + 1);
                            setCheckOut(next.toISOString().split("T")[0]);
                          }
                        }}
                        className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Check-out
                      </label>
                      <input
                        type="date"
                        value={checkOut}
                        min={checkIn || today}
                        onChange={(e) => setCheckOut(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  {/* Price summary */}
                  {totalRentalPrice && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          ${nightlyRate} × {rentalNights} {rentalNights === 1 ? "night" : "nights"}
                        </span>
                        <span className="font-semibold">${totalRentalPrice.toLocaleString()}</span>
                      </div>
                      {(property as any).cleaningFee ? (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Cleaning fee</span>
                          <span className="font-semibold">${(property as any).cleaningFee.toLocaleString()}</span>
                        </div>
                      ) : null}
                      {(property as any).cleaningFee ? (
                        <div className="flex justify-between text-sm font-semibold border-t border-primary/10 pt-1">
                          <span>Total</span>
                          <span>${(totalRentalPrice + (property as any).cleaningFee).toLocaleString()}</span>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Check-in/out info */}
                  {((property as any).checkInTime || (property as any).checkOutTime || (property as any).minNights) && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      {(property as any).checkInTime && (
                        <p>Check-in: {(property as any).checkInTime}</p>
                      )}
                      {(property as any).checkOutTime && (
                        <p>Check-out: {(property as any).checkOutTime}</p>
                      )}
                      {(property as any).minNights && (
                        <p>Minimum stay: {(property as any).minNights} nights</p>
                      )}
                    </div>
                  )}

                  {/* Date conflict warning */}
                  {hasDateConflict && (
                    <div className="px-3 py-2.5 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>
                        These dates are not available — this property is already booked during part or all of your selected dates. Please choose different dates.
                      </span>
                    </div>
                  )}

                  {/* Book button — requires dates to be selected and no conflict */}
                  {checkIn && checkOut && !hasDateConflict ? (
                    <Link
                      to={bookingHref}
                      className="block w-full py-3 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors text-center"
                    >
                      Book This Villa
                      <ArrowRight className="w-4 h-4 inline-block ml-1" />
                    </Link>
                  ) : checkIn && checkOut && hasDateConflict ? (
                    <div className="w-full py-3 bg-red-100 text-red-400 rounded-lg text-sm font-semibold text-center cursor-not-allowed">
                      Dates Not Available
                    </div>
                  ) : (
                    <div className="w-full py-3 bg-muted text-muted-foreground rounded-lg text-sm font-semibold text-center cursor-not-allowed">
                      Select dates to book
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══ Default Mode (no buy/rent chosen) ══ */}
            {!isBuy && !isRent && (
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                {showInquiry ? (
                  <InquiryForm
                    type={showInquiry.type}
                    propertyId={property._id}
                    weekId={showInquiry.weekId as any}
                    weekNumber={showInquiry.weekNumber}
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

                    {/* Weeks for Purchase */}
                    {hasWeeks ? (
                      <div>
                        <button
                          onClick={() => setWeeksExpanded(!weeksExpanded)}
                          className="w-full py-3 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                        >
                          <Calendar className="w-4 h-4" />
                          Weeks for Purchase
                          {weeksExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        {weeksExpanded && (
                          <div className="mt-3 max-h-80 overflow-y-auto space-y-2 pr-1">
                            {property.weeks.map((week: any) => (
                              <div
                                key={week._id}
                                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/30"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground">
                                    Week {week.weekNumber}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {week.price
                                      ? `$${week.price.toLocaleString()}`
                                      : week.priceLabel || "Contact for pricing"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {(week.listingType === "sale" || week.listingType === "both") && (
                                    <button
                                      onClick={() =>
                                        setShowInquiry({
                                          type: "purchase",
                                          weekId: week._id,
                                          weekNumber: week.weekNumber,
                                        })
                                      }
                                      className="px-3 py-1.5 border border-primary text-primary rounded-md text-xs font-semibold hover:bg-primary/10 transition-colors"
                                    >
                                      Make Offer
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowInquiry({ type: "purchase" })}
                        className="w-full py-3 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                      >
                        Make an Offer
                      </button>
                    )}

                    <Link
                      to={`/property/${slug}?mode=rent`}
                      className="block w-full py-3 border-2 border-primary text-primary rounded-lg text-sm font-semibold hover:bg-primary/5 transition-colors text-center"
                    >
                      Book This Villa
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Booking shortcut */}
            {!isRent && !isBuy && (
              <Link
                to={`/property/${slug}?mode=rent`}
                className="block rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 text-green-700">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Rent This Villa</p>
                    <p className="text-xs text-muted-foreground">Select dates & book online</p>
                  </div>
                </div>
              </Link>
            )}

            {/* Contact info */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Contact
              </h4>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Purchase Inquiries</p>
                  <a
                    href="mailto:lisafleming@lighthouserealtyhhi.com"
                    className="text-primary hover:text-primary/80 font-medium flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Lighthouse Realty
                  </a>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rental Inquiries</p>
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
