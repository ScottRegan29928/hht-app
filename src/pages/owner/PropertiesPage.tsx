import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import {
  Calendar,
  MapPin,
  Bed,
  Bath,
  Home,
  Tag,
  DollarSign,
  Send,
  X,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import type { Id } from "../../../convex/_generated/dataModel";

export function OwnerPropertiesPage() {
  const weeks = useQuery(api.owner.listOwnedWeeks);
  const submitRequest = useMutation(api.owner.submitSaleRequest);
  const withdrawRequest = useMutation(api.owner.withdrawSaleRequest);

  // Track which week has the sell form open
  const [sellFormWeekId, setSellFormWeekId] = useState<string | null>(null);
  const [askingPrice, setAskingPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (weeks === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground">
          Loading your weeks…
        </div>
      </div>
    );
  }

  const openSellForm = (weekId: string) => {
    setSellFormWeekId(weekId);
    setAskingPrice("");
    setNotes("");
  };

  const closeSellForm = () => {
    setSellFormWeekId(null);
    setAskingPrice("");
    setNotes("");
  };

  const handleSubmitSale = async (weekId: Id<"weeks">) => {
    const price = Number(askingPrice);
    if (!price || price <= 0) {
      toast.error("Please enter a valid asking price");
      return;
    }
    setSubmitting(true);
    try {
      await submitRequest({
        weekId,
        askingPrice: price,
        notes: notes || undefined,
      });
      toast.success("Sale request submitted for approval!");
      closeSellForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (requestId: Id<"saleRequests">) => {
    if (!confirm("Withdraw this sale listing?")) return;
    try {
      await withdrawRequest({ requestId });
      toast.success("Listing withdrawn");
    } catch (err: any) {
      toast.error(err.message || "Failed to withdraw");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Weeks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View your owned weeks and list them for sale
        </p>
      </div>

      {weeks.length === 0 ? (
        <div className="bg-background rounded-xl border p-8 text-center">
          <Home className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Weeks Assigned</h2>
          <p className="text-sm text-muted-foreground">
            Contact your administrator to have weeks assigned to your account.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {weeks.map((w: any) => {
            const isFormOpen = sellFormWeekId === w.weekId;
            const sr = w.saleRequest;

            return (
              <div
                key={w.weekId}
                className="bg-background rounded-xl border overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row">
                  {/* Photo */}
                  <div className="sm:w-44 h-36 sm:h-auto bg-muted/50 flex-shrink-0">
                    {w.photoUrl ? (
                      <img
                        src={w.photoUrl}
                        alt={w.propertyAddress}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        /* Photos are served from HostAway's S3 bucket, not from
                           us. Scott saw one fail to load on 2026-09-12 that
                           loads fine here, so the cause is on the request side
                           rather than the data: some networks and privacy
                           extensions block a third-party image host, and an S3
                           referer policy can reject a cross-origin referer.
                           no-referrer removes the second possibility, and the
                           onError below makes the first degrade to the same
                           placeholder an absent photo gets, instead of a broken
                           image icon. */
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const img = e.currentTarget;
                          img.style.display = "none";
                          img.parentElement
                            ?.querySelector("[data-photo-fallback]")
                            ?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div
                      data-photo-fallback
                      className={`w-full h-full items-center justify-center flex ${
                        w.photoUrl ? "hidden" : ""
                      }`}
                    >
                      <Home className="w-10 h-10 text-muted-foreground/30" />
                    </div>
                  </div>

                  {/* Info + Action */}
                  <div className="flex-1 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-base sm:text-lg">
                          {w.propertyAddress}
                        </h3>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          {w.communityName}
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-2">
                          {w.bedrooms && (
                            <span className="flex items-center gap-1">
                              <Bed className="w-3.5 h-3.5" />
                              {w.bedrooms} bed
                            </span>
                          )}
                          {w.bathrooms && (
                            <span className="flex items-center gap-1">
                              <Bath className="w-3.5 h-3.5" />
                              {w.bathrooms} bath
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Week badge */}
                      <div className="flex-shrink-0 text-right">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-lg">
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          <span className="text-sm font-semibold text-primary">
                            Week {w.weekNumber}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {w.year}
                        </div>
                      </div>
                    </div>

                    {/* Sale status / action */}
                    <div className="mt-4 pt-3 border-t">
                      {sr ? (
                        // Active sale request
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {sr.status === "pending" ? (
                              <>
                                <Clock className="w-4 h-4 text-amber-500" />
                                <span className="text-sm font-medium text-amber-700">
                                  Pending Approval
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  — ${sr.askingPrice.toLocaleString()}
                                </span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                <span className="text-sm font-medium text-green-700">
                                  Listed for Sale
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  — ${sr.askingPrice.toLocaleString()}
                                </span>
                              </>
                            )}
                          </div>
                          <button
                            onClick={() => handleWithdraw(sr._id)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Withdraw
                          </button>
                        </div>
                      ) : isFormOpen ? (
                        // Inline sell form
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium mb-1">
                                Asking Price ($)
                              </label>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                  type="number"
                                  min={1}
                                  value={askingPrice}
                                  onChange={(e) =>
                                    setAskingPrice(e.target.value)
                                  }
                                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                  placeholder="1,500"
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">
                                Notes (optional)
                              </label>
                              <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Any details about the sale…"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={closeSellForm}
                              className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() =>
                                handleSubmitSale(
                                  w.weekId as Id<"weeks">
                                )
                              }
                              disabled={submitting}
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                              <Send className="w-3.5 h-3.5" />
                              {submitting
                                ? "Submitting…"
                                : "Submit for Approval"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        // No active request — show sell button
                        <button
                          onClick={() => openSellForm(w.weekId)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                          <Tag className="w-3.5 h-3.5" />
                          Sell My Week
                        </button>
                      )}
                    </div>

                    {/* Admin notes (if any on active request) */}
                    {sr?.adminNotes && (
                      <div className="mt-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                        Admin note: {sr.adminNotes}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
