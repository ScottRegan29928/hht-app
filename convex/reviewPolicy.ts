/** Only guest-authored reviews Hostaway explicitly allows on the booking site. */
export function reviewVisible(row: any): boolean {
  return row?.type === "guest-to-host" && row.status === "published" &&
    !row.isHidden && !row.isCancelled && Number(row.bookingEngineVisibility) === 1 &&
    typeof row.publicReview === "string" && row.publicReview.trim().length > 0;
}
export function publicReview(row: any) {
  return { _id: row._id, guestFirstName: row.guestFirstName, body: row.body,
    reviewedAt: row.reviewedAt, response: row.response ?? null };
}
