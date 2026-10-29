/**
 * Only an explicit cancellation of the exact linked reservation can free an
 * HHT hold. Missing reservations, HTTP errors and moved dates are not evidence.
 */
export function cancellationMatches(s: any, property: any, reservation: any, hold: any, booking: any): boolean {
  return !!(
    s?.status === "confirmed" && s.calendarBookingId && s.bookingId &&
    ["cancelled", "canceled"].includes(String(reservation?.status).toLowerCase()) &&
    Number(reservation?.id) === s.hostawayReservationId &&
    Number(reservation?.listingMapId) === property?.hostawayId &&
    String(reservation?.arrivalDate).slice(0, 10) === s.checkIn &&
    String(reservation?.departureDate).slice(0, 10) === s.checkOut &&
    hold?._id === s.calendarBookingId && hold.source === "hht" &&
    hold.propertyId === s.propertyId && hold.startDate === s.checkIn && hold.endDate === s.checkOut &&
    booking?._id === s.bookingId && booking.checkoutSessionId === s._id &&
    booking.hostawayReservationId === s.hostawayReservationId
  );
}
