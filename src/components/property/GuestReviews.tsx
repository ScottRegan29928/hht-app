import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function GuestReviews({ propertyId }: { propertyId: Id<"properties"> }) {
  const reviews = useQuery(api.guestReviews.forProperty, { propertyId });
  const [limit, setLimit] = useState(5);
  if (!reviews?.length) return null;
  return <section aria-label="Guest reviews" className="space-y-5">
    <h2 className="text-xl font-semibold font-[family-name:var(--font-display)]">Guest Reviews</h2>
    {reviews.slice(0, limit).map(review => <article key={review._id} className="border-b border-border pb-5 space-y-3">
      <div className="flex justify-between gap-4 text-sm">
        <h3 className="font-semibold">{review.guestFirstName}</h3>
        <time className="text-muted-foreground" dateTime={review.reviewedAt}>{review.reviewedAt}</time>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{review.body}</p>
      {review.response && <div className="border-l-2 border-primary pl-4 space-y-2">
        <h4 className="text-sm font-semibold">Response from Management</h4>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{review.response}</p>
      </div>}
    </article>)}
    {reviews.length > limit && <button className="text-sm font-semibold text-primary underline" onClick={() => setLimit(limit + 10)}>Show more reviews</button>}
  </section>;
}
