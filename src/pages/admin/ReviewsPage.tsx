import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import type { Id } from "../../../convex/_generated/dataModel";

function ResponseEditor({ reviewId, initial }: { reviewId: Id<"guestReviews">; initial: string }) {
  const [body, setBody] = useState(initial);
  const [saving, setSaving] = useState(false);
  const save = useMutation(api.guestReviews.saveResponse);
  return <form className="space-y-2" onSubmit={async e => {
    e.preventDefault(); setSaving(true);
    try { await save({ reviewId, body }); toast.success(body.trim() ? "Management response published" : "Management response removed"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save response"); }
    finally { setSaving(false); }
  }}>
    <label className="block text-sm font-semibold" htmlFor={`response-${reviewId}`}>Management response</label>
    <textarea id={`response-${reviewId}`} className="w-full border rounded-lg p-3 text-sm min-h-28"
      maxLength={5000} value={body} onChange={e => setBody(e.target.value)} />
    <div className="flex items-center gap-3">
      <button disabled={saving} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm disabled:opacity-50">
        {saving ? "Saving…" : "Publish Response"}
      </button>
      <span className="text-xs text-muted-foreground">Leave blank and publish to remove the response.</span>
    </div>
  </form>;
}

export function AdminReviewsPage() {
  const user = useQuery(api.admin.currentUser);
  const allowed = !!user?.profile && ["admin", "admin_user", "admin_rental"].includes(user.profile.role);
  const reviews = useQuery(api.guestReviews.adminList, allowed ? {} : "skip");
  const refresh = useAction(api.guestReviews.refresh);
  const hide = useMutation(api.guestReviews.setHidden);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("");
  const [limit, setLimit] = useState(25);
  if (user === undefined) return <div className="p-8">Loading reviews…</div>;
  if (!allowed) return <div className="p-8">Rental admin access is required to manage guest reviews.</div>;
  const shown = reviews?.filter(r => (r.propertyName + " " + r.guestFirstName + " " + r.body).toLowerCase().includes(filter.toLowerCase()));
  return <div className="p-6 lg:p-8 max-w-5xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-bold">Guest Reviews</h1>
      <button disabled={refreshing} className="border rounded-lg px-4 py-2 text-sm" onClick={async () => {
        setRefreshing(true);
        try { const r = await refresh({}); toast.success(`Refreshed ${r.imported} guest reviews`); }
        catch (e) { toast.error(e instanceof Error ? e.message : "Refresh failed"); }
        finally { setRefreshing(false); }
      }}>{refreshing ? "Refreshing…" : "Refresh from Hostaway"}</button>
    </div>
    <p className="text-sm text-muted-foreground">Management responses publish on this website only. They do not post to Hostaway or booking channels. Only published guest reviews approved for booking-site display in Hostaway can appear publicly.</p>
    <label className="block text-sm">Search reviews
      <input type="search" value={filter} onChange={e => { setFilter(e.target.value); setLimit(25); }} className="block w-full mt-2 border rounded-lg px-3 py-2" />
    </label>
    {reviews === undefined ? <p>Loading reviews…</p> : !shown?.length ? <p>No matching guest reviews.</p> : shown.slice(0, limit).map(r =>
      <article key={r._id} className="border rounded-xl bg-background p-5 space-y-4">
        <div className="flex flex-wrap justify-between gap-3">
          <div><h2 className="font-semibold">{r.propertyName}</h2>
            <p className="text-sm text-muted-foreground">{r.guestFirstName} · {r.reviewedAt}</p></div>
          <span className="text-xs">{!r.upstreamVisible ? "Not published in Hostaway" : r.hiddenOnSite ? "Hidden on website" : "Visible on website"}</span>
        </div>
        <p className="text-sm whitespace-pre-wrap">{r.body || "No public review text."}</p>
        <ResponseEditor key={`${r._id}-${r.responseUpdatedAt ?? 0}`} reviewId={r._id} initial={r.response ?? ""} />
        <button className="text-sm underline" onClick={async () => {
          try { await hide({ reviewId: r._id, hidden: !r.hiddenOnSite }); toast.success("Review visibility updated"); }
          catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
        }}>{r.hiddenOnSite ? "Show on website when approved in Hostaway" : "Hide on website"}</button>
      </article>)}
    {shown && shown.length > limit && <button className="text-sm underline" onClick={() => setLimit(limit + 25)}>Show more reviews</button>}
  </div>;
}
