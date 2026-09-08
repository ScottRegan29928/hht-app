import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useSiteFlags } from "@/lib/siteContext";
import { ListingCard } from "@/components/owner/ListingCard";
import type { Id } from "../../../convex/_generated/dataModel";

type Kind = "for_sale" | "want_to_buy" | "trade";

const KIND_LABEL: Record<Kind, string> = {
  for_sale: "For Sale",
  want_to_buy: "Want to Buy",
  trade: "Internal Trade",
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-200 text-slate-700",
  withdrawn: "bg-slate-200 text-slate-700",
  expired: "bg-amber-100 text-amber-800",
};

export function OwnerMyListingsPage() {
  const { siteSlug } = useSiteFlags();
  const listings = useQuery(api.marketplace.myListings);
  const createListing = useMutation(api.marketplace.createListing);
  const setStatus = useMutation(api.marketplace.setListingStatus);
  const updateListing = useMutation(api.marketplace.updateListing);
  const deleteListing = useMutation(api.marketplace.deleteListing);

  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<Kind>("for_sale");
  // Default the community to the portal the owner is actually in. Hardcoding
  // "spicebush" filed Swallowtail owners' weeks under the wrong community.
  const defaultCommunity =
    siteSlug === "swallowtail" ? "swallowtail-at-sea-pines" : "spicebush";
  const [communitySlug, setCommunitySlug] = useState(defaultCommunity);
  const [unitNumber, setUnitNumber] = useState("");
  const [weekLabel, setWeekLabel] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [desiredWeekLabel, setDesiredWeekLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Non-null while editing an existing listing; the same form serves both, so
  // the fields and validation can never drift apart between create and edit.
  const [editingId, setEditingId] =
    useState<Id<"marketplaceListings"> | null>(null);

  const touchedCommunity = useRef(false);
  useEffect(() => {
    if (!touchedCommunity.current && !editingId) {
      setCommunitySlug(defaultCommunity);
    }
  }, [defaultCommunity, editingId]);

  const reset = () => {
    setEditingId(null);
    setUnitNumber("");
    setWeekLabel("");
    setAskingPrice("");
    setDesiredWeekLabel("");
    setNotes("");
    touchedCommunity.current = false;
    setCommunitySlug(defaultCommunity);
    setShowForm(false);
  };

  const startEdit = (l: any) => {
    setEditingId(l._id);
    setKind(l.kind);
    touchedCommunity.current = true;
    setCommunitySlug(l.communitySlug ?? defaultCommunity);
    setUnitNumber(l.unitNumber ?? "");
    setWeekLabel(l.weekLabel ?? "");
    setAskingPrice(l.askingPrice ? String(l.askingPrice) : "");
    setDesiredWeekLabel(l.desiredWeekLabel ?? "");
    setNotes(l.notes ?? "");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRemove = async (listingId: Id<"marketplaceListings">) => {
    if (
      !window.confirm(
        "Remove this listing permanently? To take it down but keep it for later, use Withdraw instead."
      )
    ) {
      return;
    }
    try {
      await deleteListing({ listingId });
      toast.success("Listing removed");
    } catch (err: any) {
      toast.error(err.message || "Could not remove the listing");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (kind !== "want_to_buy" && !unitNumber.trim()) {
      toast.error("Please enter the unit number you own");
      return;
    }
    if (!weekLabel.trim()) {
      toast.error("Please enter the week");
      return;
    }
    setSubmitting(true);
    try {
      const parsedWeek = Number(weekLabel.trim());
      const weekNumber =
        Number.isFinite(parsedWeek) && parsedWeek > 0 ? parsedWeek : undefined;
      const price =
        kind === "for_sale" && askingPrice ? Number(askingPrice) : undefined;

      if (editingId) {
        await updateListing({
          listingId: editingId,
          kind,
          communitySlug,
          unitNumber: unitNumber.trim() || undefined,
          weekLabel: weekLabel.trim(),
          weekNumber,
          askingPrice: price,
          // An owner clearing the price means "Contact for price", which is
          // different from leaving the field untouched.
          clearPrice: kind === "for_sale" && !askingPrice,
          desiredWeekLabel:
            kind === "trade" ? desiredWeekLabel.trim() || "Flexible" : undefined,
          notes: notes.trim() || undefined,
        });
        toast.success("Listing updated");
        reset();
        return;
      }

      await createListing({
        originSiteSlug: siteSlug,
        kind,
        communitySlug,
        unitNumber: unitNumber.trim() || undefined,
        weekLabel: weekLabel.trim(),
        weekNumber,
        askingPrice: price,
        desiredWeekLabel:
          kind === "trade" ? desiredWeekLabel.trim() || "Flexible" : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Listing posted to both owner portals");
      reset();
    } catch (err: any) {
      toast.error(err.message || "Could not save the listing");
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async (
    listingId: Id<"marketplaceListings">,
    status: "active" | "closed" | "withdrawn"
  ) => {
    try {
      await setStatus({ listingId, status });
      toast.success(
        status === "closed"
          ? "Marked as closed"
          : status === "withdrawn"
            ? "Listing withdrawn"
            : "Listing reposted for another year"
      );
    } catch (err: any) {
      toast.error(err.message || "Could not update the listing");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My Listings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Anything you post appears in the Swallowtail and Spicebush owner
            portals. Listings run for one year, and stay up until you close
            them. Each unit and week can have one listing — posting the same
            week again updates the listing you already have.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "Post a listing"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-background border rounded-xl p-5 space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Listing type
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
                className="w-full px-3 py-2.5 rounded-lg border text-sm bg-background"
              >
                {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Community
              </label>
              <select
                value={communitySlug}
                onChange={(e) => {
                  touchedCommunity.current = true;
                  setCommunitySlug(e.target.value);
                }}
                className="w-full px-3 py-2.5 rounded-lg border text-sm bg-background"
              >
                <option value="spicebush">Spicebush</option>
                <option value="swallowtail-at-sea-pines">Swallowtail</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Unit number
                {kind === "want_to_buy" && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    (optional)
                  </span>
                )}
              </label>
              <input
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                placeholder="583"
                className="w-full px-3 py-2.5 rounded-lg border text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                {kind === "want_to_buy" ? "Week wanted" : "Week"}
              </label>
              <input
                value={weekLabel}
                onChange={(e) => setWeekLabel(e.target.value)}
                placeholder="23, or 23 & 24"
                className="w-full px-3 py-2.5 rounded-lg border text-sm"
              />
            </div>

            {kind === "for_sale" && (
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Asking price
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    (optional)
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={askingPrice}
                  onChange={(e) => setAskingPrice(e.target.value)}
                  placeholder="3500"
                  className="w-full px-3 py-2.5 rounded-lg border text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  You set your own price. Leave blank to show "Contact for
                  price."
                </p>
              </div>
            )}

            {kind === "trade" && (
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Week you want
                </label>
                <input
                  value={desiredWeekLabel}
                  onChange={(e) => setDesiredWeekLabel(e.target.value)}
                  placeholder="48, or Flexible"
                  className="w-full px-3 py-2.5 rounded-lg border text-sm"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Notes
              <span className="text-muted-foreground font-normal">
                {" "}
                (optional)
              </span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything else other owners should know."
              className="w-full px-3 py-2.5 rounded-lg border text-sm"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Your name, email and phone from your owner profile are shown with
            the listing so other owners can reach you. Only signed-in owners can
            see this.
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting
              ? "Saving…"
              : editingId
                ? "Save changes"
                : "Post listing"}
          </button>
        </form>
      )}

      {listings === undefined ? (
        <div className="py-16 text-center text-muted-foreground animate-pulse">
          Loading your listings…
        </div>
      ) : listings.length === 0 ? (
        <div className="py-16 text-center border rounded-xl bg-muted/30">
          <p className="font-medium">You have no listings yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Post a week for sale, a week you want to buy, or a trade.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {listings.map((l) => (
            <div key={l._id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-1 rounded bg-muted">
                  {KIND_LABEL[l.kind as Kind]}
                </span>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    STATUS_STYLE[l.status] ?? "bg-muted"
                  }`}
                >
                  {l.status}
                </span>
              </div>
              <ListingCard
                listing={l}
                footer={
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(l)}
                      className="text-xs font-medium px-2.5 py-1.5 rounded border hover:bg-muted"
                    >
                      Edit
                    </button>
                    {l.status === "active" ? (
                      <>
                        <button
                          onClick={() => changeStatus(l._id, "closed")}
                          className="text-xs font-medium px-2.5 py-1.5 rounded border hover:bg-muted"
                        >
                          Mark closed
                        </button>
                        <button
                          onClick={() => changeStatus(l._id, "withdrawn")}
                          className="text-xs font-medium px-2.5 py-1.5 rounded border hover:bg-muted"
                        >
                          Withdraw
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => changeStatus(l._id, "active")}
                        className="text-xs font-medium px-2.5 py-1.5 rounded border hover:bg-muted"
                      >
                        Repost
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(l._id)}
                      className="text-xs font-medium px-2.5 py-1.5 rounded border border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      Remove
                    </button>
                  </div>
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
