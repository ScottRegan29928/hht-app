import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  formatOwnerWeekRange,
  getRemainingWeeksInYear,
  getSelectableYears,
} from "@/lib/weekCalendar";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useSiteFlags } from "@/lib/siteContext";
import { ListingCard } from "@/components/owner/ListingCard";
import type { Id } from "../../../convex/_generated/dataModel";

type Kind = "for_sale" | "want_to_buy" | "trade";

// Week numbers for the "week wanted" field on a Want to Buy listing, which is
// not tied to a year.
const WEEK_NUMBERS = Array.from({ length: 52 }, (_, i) => i + 1);
// Years that still have weeks left — includes the current year, which a
// fixed list did not [scott, 2026-09-13].
const SELECTABLE_YEARS = getSelectableYears();

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
  // The weeks this owner actually holds. Listings for sale or trade must come
  // from this list — an owner cannot list a week that is not theirs
  // [scott, 2026-09-13]. Enforced on the server too; this is the usable half.
  const ownedWeeks = useQuery(api.owner.listOwnedWeeks);
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
  // Which owned week is selected, as "unit|week". want_to_buy has no such
  // selection: you ask for a week precisely because you do not own it.
  const [ownedKey, setOwnedKey] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const prefilled = useRef(false);

  // Unit|week keys the owner already has an active for-sale listing against.
  const alreadyListed = new Set(
    (listings ?? [])
      .filter((l: any) => l.kind === "for_sale" && l.status === "active")
      .map((l: any) => `${l.unitNumber ?? ""}|${l.weekNumber ?? ""}`),
  );

  const [askingPrice, setAskingPrice] = useState("");
  const [desiredWeekLabel, setDesiredWeekLabel] = useState("");
  const [desiredYear, setDesiredYear] = useState(String(SELECTABLE_YEARS[0]));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Non-null while editing an existing listing; the same form serves both, so
  // the fields and validation can never drift apart between create and edit.
  const [editingId, setEditingId] = useState<Id<"marketplaceListings"> | null>(
    null,
  );

  // Desired "week|year" pairs already covered by an active trade listing for
  // the owned week currently selected. An owner may offer the same week
  // against several different weeks, but not twice against the same one
  // [scott, 2026-09-13].
  const alreadyWanted = new Set(
    (listings ?? [])
      .filter(
        (l: any) =>
          l.kind === "trade" &&
          l.status === "active" &&
          `${l.unitNumber ?? ""}|${l.weekNumber ?? ""}` === ownedKey &&
          l._id !== editingId,
      )
      .map((l: any) => `${l.desiredWeekNumber ?? ""}|${l.desiredYear ?? ""}`),
  );

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
    setOwnedKey("");
    setAskingPrice("");
    setDesiredWeekLabel("");
    setDesiredYear(String(SELECTABLE_YEARS[0]));
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
    setOwnedKey(`${l.unitNumber ?? ""}|${l.weekNumber ?? ""}`);
    setAskingPrice(l.askingPrice ? String(l.askingPrice) : "");
    setDesiredWeekLabel(l.desiredWeekLabel ?? "");
    setDesiredYear(String(l.desiredYear ?? SELECTABLE_YEARS[0]));
    setNotes(l.notes ?? "");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /**
   * "Trade My Week" on My Weeks links here with the week already chosen, so
   * the owner does not have to find it again in the drop-down. Runs once, and
   * only when the owned-week list has loaded — otherwise the selection is set
   * before the options exist and the drop-down renders empty.
   */
  useEffect(() => {
    if (prefilled.current || !ownedWeeks) return;
    const kindParam = searchParams.get("kind");
    const unit = searchParams.get("unit");
    const week = searchParams.get("week");
    if (!kindParam && !week) return;

    prefilled.current = true;
    if (kindParam === "trade" || kindParam === "for_sale") setKind(kindParam);
    const match = ownedWeeks.find(
      (o: any) =>
        String(o.weekNumber) === week &&
        (!unit || String(o.unitNumber ?? "") === unit),
    );
    if (match) {
      setOwnedKey(`${match.unitNumber ?? ""}|${match.weekNumber}`);
      setUnitNumber(String(match.unitNumber ?? ""));
      setWeekLabel(String(match.weekNumber));
      setShowForm(true);
    }
    // Clear the params so a refresh doesn't reopen the form unexpectedly.
    setSearchParams({}, { replace: true });
  }, [ownedWeeks, searchParams, setSearchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (kind !== "want_to_buy" && !ownedKey) {
      toast.error("Please select which of your weeks you want to list");
      return;
    }
    if (kind === "want_to_buy" && !weekLabel.trim()) {
      toast.error("Please choose the week you are looking for");
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
          communitySlug: communitySlug || undefined,
          unitNumber: unitNumber.trim() || undefined,
          weekLabel: weekLabel.trim(),
          weekNumber,
          askingPrice: price,
          // An owner clearing the price means "Contact for price", which is
          // different from leaving the field untouched.
          clearPrice: kind === "for_sale" && !askingPrice,
          desiredWeekLabel:
            kind === "trade"
              ? desiredWeekLabel.trim() || "Flexible"
              : undefined,
          desiredYear: kind === "trade" ? Number(desiredYear) : undefined,
          notes: notes.trim() || undefined,
        });
        toast.success("Listing updated");
        reset();
        return;
      }

      await createListing({
        originSiteSlug: siteSlug,
        kind,
        communitySlug: communitySlug || undefined,
        unitNumber: unitNumber.trim() || undefined,
        weekLabel: weekLabel.trim(),
        weekNumber,
        askingPrice: price,
        desiredWeekLabel:
          kind === "trade" ? desiredWeekLabel.trim() || "Flexible" : undefined,
        desiredYear: kind === "trade" ? Number(desiredYear) : undefined,
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
    status: "active" | "closed" | "withdrawn",
  ) => {
    try {
      await setStatus({ listingId, status });
      toast.success(
        status === "closed"
          ? "Marked as closed"
          : status === "withdrawn"
            ? "Listing withdrawn"
            : "Listing reposted for another year",
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
                {kind === "for_sale" ? "Community" : "Community you want"}
              </label>
              <select
                value={communitySlug}
                onChange={(e) => {
                  touchedCommunity.current = true;
                  setCommunitySlug(e.target.value);
                }}
                className="w-full px-3 py-2.5 rounded-lg border text-sm bg-background"
              >
                {/* A trade names the community the owner wants, and that can
                    genuinely be either — the two resorts trade with each other
                    [scott, 2026-09-13]. For a sale the community is a fact
                    about the unit, so "Either" is not offered. */}
                {kind !== "for_sale" && (
                  <option value="">Either community</option>
                )}
                <option value="spicebush">Spicebush</option>
                <option value="swallowtail-at-sea-pines">Swallowtail</option>
              </select>
            </div>
            {kind === "want_to_buy" ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Unit number
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      (optional)
                    </span>
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
                    Week wanted
                  </label>
                  <select
                    value={weekLabel}
                    onChange={(e) => setWeekLabel(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm bg-background"
                  >
                    <option value="">Any week</option>
                    {WEEK_NUMBERS.map((w) => (
                      <option key={w} value={String(w)}>
                        Week {w}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Your week
                </label>
                {ownedWeeks === undefined ? (
                  <div className="h-11 rounded-lg border bg-slate-50 animate-pulse" />
                ) : ownedWeeks.length === 0 ? (
                  <p className="text-sm text-muted-foreground border rounded-lg px-3 py-2.5 bg-slate-50">
                    Our records do not show any weeks in your name yet. Please
                    contact the resort office so your ownership can be added.
                  </p>
                ) : (
                  <select
                    value={ownedKey}
                    onChange={(e) => {
                      setOwnedKey(e.target.value);
                      const w = ownedWeeks.find(
                        (o: any) =>
                          `${o.unitNumber ?? ""}|${o.weekNumber}` ===
                          e.target.value,
                      );
                      if (w) {
                        setUnitNumber(String(w.unitNumber ?? ""));
                        setWeekLabel(String(w.weekNumber));
                      }
                    }}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm bg-white"
                  >
                    <option value="">Select the week you own…</option>
                    {ownedWeeks.map((o: any) => {
                      // A week already listed for sale cannot be listed again;
                      // showing it as selectable invites an error message
                      // instead of an answer [scott, 2026-09-13]. Editing the
                      // existing listing is the way to change it.
                      const taken =
                        kind === "for_sale" &&
                        alreadyListed.has(
                          `${o.unitNumber ?? ""}|${o.weekNumber}`,
                        ) &&
                        !editingId;
                      return (
                        <option
                          key={o.weekId}
                          value={`${o.unitNumber ?? ""}|${o.weekNumber}`}
                          disabled={taken}
                        >
                          {o.propertyAddress} — Week {o.weekNumber} ({o.year})
                          {taken ? " (already listed)" : ""}
                        </option>
                      );
                    })}
                  </select>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  You can only list weeks recorded in your name.
                </p>
              </div>
            )}

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
                {/* Year first, then week: the week list is derived from the
                    year, so the current year offers only the weeks still to
                    come rather than dates that have already passed
                    [scott, 2026-09-13]. */}
                <div className="flex gap-2">
                  <select
                    value={desiredYear}
                    onChange={(e) => {
                      setDesiredYear(e.target.value);
                      // The chosen week may not exist in the new year, so the
                      // selection is cleared rather than left dangling.
                      setDesiredWeekLabel("");
                    }}
                    aria-label="Year you want"
                    className="w-28 shrink-0 px-3 py-2.5 rounded-lg border text-sm bg-background"
                  >
                    {SELECTABLE_YEARS.map((y: number) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <select
                    value={desiredWeekLabel}
                    onChange={(e) => setDesiredWeekLabel(e.target.value)}
                    aria-label="Week you want"
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border text-sm bg-background"
                  >
                    <option value="">Flexible</option>
                    {getRemainingWeeksInYear(Number(desiredYear)).map(
                      (w: { weekNumber: number; year: number }) => {
                        const taken = alreadyWanted.has(
                          `${w.weekNumber}|${w.year}`,
                        );
                        return (
                          <option
                            key={w.weekNumber}
                            value={String(w.weekNumber)}
                            disabled={taken}
                          >
                            Week {w.weekNumber} &mdash;{" "}
                            {formatOwnerWeekRange(w.weekNumber, w.year)}
                            {taken ? " (already listed)" : ""}
                          </option>
                        );
                      },
                    )}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  This listing closes itself once that week has passed.
                </p>
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
