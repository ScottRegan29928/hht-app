import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Calendar,
  MapPin,
  Home,
  Moon,
  DollarSign,
  User,
  Mail,
  Phone,
  CreditCard,
  CheckCircle2,
  ArrowLeft,
  AlertCircle,
  Loader2,
} from "lucide-react";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatDate(iso: string) {
  if (!iso) return "";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", opts);
}

function formatDateRange(start: string, end: string) {
  if (!start) return "";
  const s = formatDate(start);
  const e = end ? formatDate(end) : "";
  return e ? `${s} — ${e}` : s;
}

export function CheckoutPage() {
  const [params] = useSearchParams();

  // Determine checkout mode from URL params
  const weekId = params.get("weekId");
  const propertyId = params.get("propertyId");
  const checkIn = params.get("checkIn") ?? "";
  const checkOut = params.get("checkOut") ?? "";
  const isRental = !weekId && !!propertyId && !!checkIn && !!checkOut;

  const [step, setStep] = useState<"form" | "confirmed">("form");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Week-based checkout data
  const weekData = useQuery(
    api.booking.getCheckoutData,
    weekId ? { weekId: weekId as Id<"weeks"> } : "skip"
  );

  // Rental checkout data
  const rentalData = useQuery(
    api.booking.getRentalCheckoutData,
    isRental
      ? {
          propertyId: propertyId as Id<"properties">,
          checkIn,
          checkOut,
        }
      : "skip"
  );

  const booking = useQuery(
    api.booking.getBooking,
    bookingId ? { bookingId: bookingId as Id<"bookings"> } : "skip"
  );

  const createWeekBooking = useMutation(api.booking.createBooking);
  const createRentalBooking = useMutation(api.booking.createRentalBooking);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    notes: "",
  });

  // ── No valid params ──
  if (!weekId && !isRental) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-1">No booking selected</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Please select a property and dates to book.
          </p>
          <Link
            to="/search"
            className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Browse Properties
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading ──
  const data = isRental ? rentalData : weekData;
  if (data === undefined) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-1">
            {isRental ? "Property not found" : "Week not found"}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {isRental
              ? "This property may no longer be available."
              : "This week may no longer be available."}
          </p>
          <Link
            to="/search"
            className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Browse Properties
          </Link>
        </div>
      </div>
    );
  }

  // Normalize data for display
  const propertyName = data.property.name;
  const propertySlug = data.property.slug;
  const communityName = data.community?.name ?? "";
  const photoUrl = data.photoUrl;
  const isBooked = !isRental && "isBooked" in data ? (data as any).isBooked : false;

  // Price details
  const rentalInfo = isRental
    ? (data as NonNullable<typeof rentalData>)
    : null;
  const weekInfo = !isRental
    ? (data as NonNullable<typeof weekData>)
    : null;

  const totalPrice = rentalInfo
    ? rentalInfo.totalPrice
    : weekInfo?.week.rentPrice ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.phone) return;
    setError(null);
    setSubmitting(true);
    try {
      let id: string;
      if (isRental) {
        id = await createRentalBooking({
          propertyId: propertyId as Id<"properties">,
          checkIn,
          checkOut,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          notes: form.notes || undefined,
        });
      } else {
        id = await createWeekBooking({
          weekId: weekId as Id<"weeks">,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          notes: form.notes || undefined,
        });
      }
      setBookingId(id);
      setStep("confirmed");
    } catch (e: any) {
      setError(
        e.message?.includes("already")
          ? "This property/dates may already be booked. Please choose another."
          : e.message || "Something went wrong. Please try again."
      );
    }
    setSubmitting(false);
  };

  // ── Confirmation screen ──
  if (step === "confirmed") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-background border rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Reservation Submitted!</h1>
          <p className="text-muted-foreground mb-6">
            Your booking request has been received. You will receive a confirmation email at{" "}
            <strong>{form.email}</strong> once payment is processed.
          </p>

          <div className="bg-muted/30 border rounded-xl p-5 text-left space-y-3 mb-6">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Booking Summary
            </h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-muted-foreground">Property</span>
              <span className="font-medium">{propertyName}</span>
              {communityName && (
                <>
                  <span className="text-muted-foreground">Community</span>
                  <span className="font-medium">{communityName}</span>
                </>
              )}
              {isRental ? (
                <>
                  <span className="text-muted-foreground">Check-in</span>
                  <span className="font-medium">{formatDate(checkIn)}</span>
                  <span className="text-muted-foreground">Check-out</span>
                  <span className="font-medium">{formatDate(checkOut)}</span>
                  <span className="text-muted-foreground">Nights</span>
                  <span className="font-medium">{rentalInfo?.nights}</span>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">Week</span>
                  <span className="font-medium">
                    Week {weekInfo?.week.weekNumber}
                    {weekInfo?.week.year ? `, ${weekInfo.week.year}` : ""}
                  </span>
                  <span className="text-muted-foreground">Dates</span>
                  <span className="font-medium">
                    {formatDateRange(
                      weekInfo?.week.startDate ?? "",
                      weekInfo?.week.endDate ?? ""
                    )}
                  </span>
                </>
              )}
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold text-lg">${totalPrice.toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-6">
            <strong>Next step:</strong> Payment processing will be available soon. A team member
            will reach out to finalize your reservation.
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={`/property/${propertySlug}`}
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Property
            </Link>
            <Link
              to="/search"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Browse More Properties
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Checkout form ──
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        to={`/property/${propertySlug}${isRental ? "?mode=rent" : ""}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to {propertyName}
      </Link>

      <h1 className="text-2xl font-bold mb-6">Complete Your Reservation</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: Guest form */}
        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {isBooked && (
              <div className="px-4 py-3 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                This week already has an active booking and may not be available.
              </div>
            )}

            <div className="bg-background border rounded-xl p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Guest Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Last name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="email@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Phone *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="tel"
                      required
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                      className="w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Special Requests
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  placeholder="Early check-in, late checkout, etc."
                />
              </div>
            </div>

            {/* Payment placeholder */}
            <div className="bg-background border rounded-xl p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                Payment
              </h2>
              <div className="bg-muted/30 border border-dashed rounded-lg p-6 text-center">
                <CreditCard className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground">
                  Payment processing coming soon
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Your reservation will be held and a team member will contact you to arrange payment.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                submitting ||
                !form.firstName ||
                !form.lastName ||
                !form.email ||
                !form.phone ||
                isBooked
              }
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
                </>
              ) : (
                <>Complete Reservation</>
              )}
            </button>
          </form>
        </div>

        {/* Right: Booking summary sidebar */}
        <div className="lg:col-span-2">
          <div className="bg-background border rounded-xl overflow-hidden sticky top-24">
            {photoUrl && (
              <img
                src={photoUrl}
                alt={propertyName}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-5 space-y-4">
              <div>
                <h3 className="font-bold text-lg">{propertyName}</h3>
                {communityName && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" /> {communityName}
                  </p>
                )}
              </div>

              <div className="border-t pt-4 space-y-3">
                {isRental && rentalInfo ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" /> Check-in
                      </span>
                      <span className="font-semibold">{formatDate(rentalInfo.checkIn)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" /> Check-out
                      </span>
                      <span className="font-semibold">{formatDate(rentalInfo.checkOut)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Moon className="w-4 h-4" /> Nights
                      </span>
                      <span className="font-semibold">{rentalInfo.nights}</span>
                    </div>
                  </>
                ) : weekInfo ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" /> Week
                      </span>
                      <span className="font-semibold">
                        Week {weekInfo.week.weekNumber}
                        {weekInfo.week.year ? `, ${weekInfo.week.year}` : ""}
                      </span>
                    </div>
                    {(weekInfo.week.startDate || weekInfo.week.endDate) && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Dates</span>
                        <span className="font-medium text-xs">
                          {formatDateRange(
                            weekInfo.week.startDate ?? "",
                            weekInfo.week.endDate ?? ""
                          )}
                        </span>
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              {/* Price breakdown */}
              <div className="border-t pt-4 space-y-2">
                {isRental && rentalInfo ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        ${rentalInfo.nightlyRate}/night × {rentalInfo.nights} nights
                      </span>
                      <span className="font-medium">
                        ${(rentalInfo.nightlyRate * rentalInfo.nights).toLocaleString()}
                      </span>
                    </div>
                    {rentalInfo.cleaningFee > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Cleaning fee</span>
                        <span className="font-medium">${rentalInfo.cleaningFee.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">Total</span>
                      <span className="text-2xl font-bold">${rentalInfo.totalPrice.toLocaleString()}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">Total</span>
                      <span className="text-2xl font-bold">
                        ${totalPrice.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">for 1 week stay</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
