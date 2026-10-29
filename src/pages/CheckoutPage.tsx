import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { StripePayment } from "@/components/checkout/StripePayment";
import { useStayQuote } from "@/lib/useStayQuote";
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
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  currentHostname,
  siteForMode,
  siteSells,
  sisterSiteUrl,
} from "@/lib/siteCapabilities";
import { useSiteFlags } from "@/lib/siteContext";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

type StartResult = {
  sessionId: string;
  clientSecret: string;
  publishableKey: string;
  intentType: "payment" | "setup";
  mode: "test" | "live";
  totalCents: number;
  dueNowCents: number;
  components: { title: string; type: string; total: number }[];
  charges: { label: string; amountCents: number; dueDate: string | null }[];
  policy: string[];
};

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
  const { siteSlug } = useSiteFlags();

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

  // Pay-first online checkout (convex/rentalCheckout.ts). When Stripe isn't
  // connected for this property, the page keeps the old request flow.
  const payConfig = useQuery(
    api.rentalCheckout.checkoutConfig,
    isRental ? { propertyId: propertyId as Id<"properties"> } : "skip"
  );
  const payReady = isRental && !!payConfig?.ready;
  const startCheckout = useAction(api.rentalCheckout.startCheckout);
  const finalizeCheckout = useAction(api.rentalCheckout.finalizeCheckout);
  const [payment, setPayment] = useState<StartResult | null>(null);
  const [guests, setGuests] = useState(2);
  // Live HostAway price — the property page and this sidebar always match the charge.
  const stayQuote = useStayQuote(isRental ? propertyId ?? undefined : undefined, checkIn ?? "", checkOut ?? "", guests);
  const [datesLost, setDatesLost] = useState<string | null>(null);

  const createWeekBooking = useMutation(api.booking.createBooking);
  const createRentalBooking = useMutation(api.booking.createRentalBooking);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    notes: "",
  });

  // ── Checkout this site doesn't handle ──
  // hht sells weeks only, hv rents only [scott, 2026-09-15]. Reachable only
  // by a stale link now, but it must not be able to create the booking.
  const wrongSide = isRental
    ? !siteSells(siteSlug, "rent")
    : !!weekId && !siteSells(siteSlug, "buy");
  if (wrongSide) {
    const other = siteForMode(isRental ? "rent" : "buy");
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-1">
            {isRental ? "Rentals are handled elsewhere" : "Sales are handled elsewhere"}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {isRental
              ? "Vacation rentals for Sea Pines are booked through Heritage Vacations."
              : "Timeshare weeks for sale are listed on My Hilton Head Timeshare."}
          </p>
          <a
            href={sisterSiteUrl(
              other,
              isRental ? "/search?type=rent" : "/search?type=buy",
              currentHostname()
            )}
            className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
          >
            Continue there <ArrowLeft className="w-4 h-4 rotate-180" />
          </a>
        </div>
      </div>
    );
  }

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

  const startPayment = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const r = (await startCheckout({
        propertyId: propertyId as Id<"properties">,
        checkIn,
        checkOut,
        guests,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        notes: form.notes || undefined,
      })) as StartResult;
      setPayment(r);
    } catch (e: any) {
      setError(cleanError(e));
    }
    setSubmitting(false);
  };

  const onAuthorized = async () => {
    if (!payment) return;
    const r: any = await finalizeCheckout({
      sessionId: payment.sessionId as Id<"checkoutSessions">,
    });
    if (r.status === "confirmed") {
      setBookingId(r.bookingId);
      setStep("confirmed");
      return;
    }
    if (r.status === "dates_lost") {
      setDatesLost(r.error ?? "These dates were just booked by someone else.");
      setPayment(null);
      return;
    }
    throw new Error(r.error ?? "We could not complete the reservation.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.phone) return;
    if (payReady) {
      await startPayment();
      return;
    }
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
          <h1 className="text-2xl font-bold mb-2">
            {payment ? "Reservation Confirmed!" : "Reservation Submitted!"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {payment ? (
              <>
                Your villa is reserved and your first payment has been charged. Confirmation details will be sent to <strong>{form.email}</strong>.
              </>
            ) : (
              <>
                Your booking request has been received. You will receive a confirmation email at{" "}
                <strong>{form.email}</strong> once payment is processed.
              </>
            )}
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
              <span className="font-bold text-lg">
                {payment ? money(payment.totalCents) : stayQuote.status === "ready" ? money(stayQuote.totalCents) : isRental ? "—" : `$${totalPrice.toLocaleString()}`}
              </span>
              {payment &&
                payment.charges.map((c) => (
                  <PaymentRow key={c.label + c.dueDate} c={c} paid={payment.intentType === "payment"} />
                ))}
            </div>
          </div>

          {!payment && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-6">
              <strong>Next step:</strong> Payment processing will be available soon. A team member
              will reach out to finalize your reservation.
            </div>
          )}

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

            {payReady && (
              <div className="bg-background border rounded-xl p-5">
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  <Users className="w-4 h-4 inline mr-1 -mt-0.5" />
                  Guests *
                </label>
                <select
                  value={guests}
                  disabled={!!payment}
                  onChange={(e) => setGuests(Number(e.target.value))}
                  className="w-full sm:w-40 px-3 py-2.5 border rounded-lg text-sm bg-background"
                >
                  {Array.from({ length: payConfig?.maxGuests ?? 8 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "guest" : "guests"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {datesLost && (
              <div className="px-4 py-3 rounded-lg text-sm font-medium bg-amber-50 text-amber-800 border border-amber-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {datesLost} Your card was not charged.{" "}
                  <Link to={`/property/${propertySlug}?mode=rent`} className="underline">
                    Choose new dates
                  </Link>
                </span>
              </div>
            )}

            {payReady ? (
              <div className="bg-background border rounded-xl p-5">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  Payment
                </h2>
                {payConfig?.mode === "test" && (
                  <div className="mb-4 px-3 py-2 rounded-lg text-xs bg-violet-50 text-violet-800 border border-violet-200">
                    <strong>Test mode.</strong> No real charges. Use card 4242 4242 4242 4242, any
                    future date, any CVC.
                  </div>
                )}
                {!payment ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      Your dates are reserved the moment payment is authorized. We'll confirm the
                      final price, including taxes and fees, on the next step.
                    </p>
                    <button
                      type="submit"
                      disabled={
                        submitting || !form.firstName || !form.lastName || !form.email || !form.phone
                      }
                      className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Checking availability…
                        </>
                      ) : (
                        <>Continue to Payment</>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="space-y-5">
                    <div className="rounded-lg border bg-muted/20 p-4 text-sm space-y-1.5">
                      {payment.charges.map((c) => (
                        <div key={c.label + c.dueDate} className="flex justify-between">
                          <span className={c.dueDate ? "text-muted-foreground" : "font-semibold"}>
                            {c.dueDate ? `Charged ${formatDate(c.dueDate)}` : "Due today"}
                          </span>
                          <span className={c.dueDate ? "" : "font-semibold"}>{money(c.amountCents)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t pt-1.5 mt-1.5">
                        <span className="text-muted-foreground">Total stay</span>
                        <span>{money(payment.totalCents)}</span>
                      </div>
                    </div>
                    <StripePayment
                      publishableKey={payment.publishableKey}
                      clientSecret={payment.clientSecret}
                      intentType={payment.intentType}
                      email={form.email}
                      phone={form.phone}
                      name={`${form.firstName} ${form.lastName}`}
                      buttonLabel={
                        `Pay ${money(payment.dueNowCents)} and Reserve`
                      }
                      onAuthorized={onAuthorized}
                    />
                    <div className="text-xs text-muted-foreground border-t pt-4">
                      <p className="font-semibold text-foreground mb-1 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Cancellation policy
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {payment.policy.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      <p className="mt-2">
                        Later installments are charged automatically to the same card.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
            <>
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
            </>
            )}
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
                {payment ? (
                  <>
                    {payment.components.map((c) => (
                      <div key={c.title} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{c.title}</span>
                        <span className="font-medium">{money(Math.round(c.total * 100))}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">Total</span>
                      <span className="text-2xl font-bold">{money(payment.totalCents)}</span>
                    </div>
                  </>
                ) : isRental && stayQuote.status === "ready" ? (
                  <>
                    {stayQuote.components.map((c) => (
                      <div key={c.title + c.type} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{c.title}</span>
                        <span className="font-medium">{money(Math.round(c.total * 100))}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">Total</span>
                      <span className="text-2xl font-bold">{money(stayQuote.totalCents)}</span>
                    </div>
                  </>
                ) : isRental ? (
                  <p className="text-sm text-muted-foreground">
                    {stayQuote.status === "unavailable" ? stayQuote.reason : "Getting the price…"}
                  </p>
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

function cleanError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  // Convex wraps server errors: "[CONVEX A(...)] Uncaught Error: <msg> at ..."
  const m = raw.match(/Uncaught Error:\s*([^\n]+?)(?:\s+at\s|$)/);
  return (m ? m[1] : raw).trim() || "Something went wrong. Please try again.";
}

function PaymentRow({
  c,
  paid,
}: {
  c: { label: string; amountCents: number; dueDate: string | null };
  paid: boolean;
}) {
  return (
    <>
      <span className="text-muted-foreground">
        {c.dueDate ? `Due ${formatDate(c.dueDate)}` : paid ? "Paid today" : "Charged today"}
      </span>
      <span className="font-medium">{money(c.amountCents)}</span>
    </>
  );
}
