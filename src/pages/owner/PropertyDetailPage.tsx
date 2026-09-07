import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import {
  ArrowLeft,
  MapPin,
  Bed,
  Bath,
  Ruler,
  Users,
  Calendar,
  DollarSign,
  Plus,
  X,
  Send,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import type { Id } from "../../../convex/_generated/dataModel";

export function OwnerPropertyDetailPage() {
  const { propertyId } = useParams();
  const property = useQuery(
    api.owner.getProperty,
    propertyId ? { propertyId: propertyId as Id<"properties"> } : "skip"
  );
  const saleRequests = useQuery(
    api.owner.listSaleRequestsByProperty,
    propertyId ? { propertyId: propertyId as Id<"properties"> } : "skip"
  );
  const submitRequest = useMutation(api.owner.submitSaleRequest);
  const cancelRequest = useMutation(api.owner.cancelSaleRequest);

  const [showSellForm, setShowSellForm] = useState(false);
  const [sellForm, setSellForm] = useState({
    weekNumber: 1,
    askingPrice: 0,
    notes: "",
  });

  if (property === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground">Loading property…</div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Property not found.</p>
        <Link to="/owner/properties" className="text-primary text-sm mt-2 inline-block">
          ← Back to properties
        </Link>
      </div>
    );
  }

  const handleSubmitSale = async () => {
    if (sellForm.askingPrice <= 0) {
      toast.error("Please enter an asking price");
      return;
    }
    try {
      await submitRequest({
        propertyId: propertyId as Id<"properties">,
        weekNumber: sellForm.weekNumber,
        askingPrice: sellForm.askingPrice,
        notes: sellForm.notes || undefined,
      });
      toast.success("Sale request submitted!");
      setShowSellForm(false);
      setSellForm({ weekNumber: 1, askingPrice: 0, notes: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    }
  };

  const handleCancelRequest = async (requestId: Id<"saleRequests">) => {
    if (!confirm("Cancel this sale request?")) return;
    try {
      await cancelRequest({ requestId });
      toast.success("Request cancelled");
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel");
    }
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/owner/properties"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Properties
      </Link>

      {/* Property header */}
      <div className="bg-background rounded-xl border overflow-hidden">
        {/* Photo gallery */}
        {property.photos.length > 0 && (
          <div className="flex gap-1 h-52 sm:h-72 overflow-x-auto">
            {property.photos.map((photo: any, i: number) => (
              <img
                key={i}
                src={photo.url}
                alt={photo.caption ?? `Photo ${i + 1}`}
                className="h-full w-auto object-cover flex-shrink-0"
              />
            ))}
          </div>
        )}

        <div className="p-5">
          <h1 className="text-2xl font-bold mb-1">{property.address}</h1>
          <div className="flex items-center gap-1.5 text-muted-foreground mb-4">
            <MapPin className="w-4 h-4" />
            {property.communityName}
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            {property.bedrooms && (
              <span className="flex items-center gap-1.5">
                <Bed className="w-4 h-4 text-muted-foreground" />
                {property.bedrooms} Bedrooms
              </span>
            )}
            {property.bathrooms && (
              <span className="flex items-center gap-1.5">
                <Bath className="w-4 h-4 text-muted-foreground" />
                {property.bathrooms} Bathrooms
              </span>
            )}
            {property.sleeps && (
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-muted-foreground" />
                Sleeps {property.sleeps}
              </span>
            )}
            {property.squareFeet && (
              <span className="flex items-center gap-1.5">
                <Ruler className="w-4 h-4 text-muted-foreground" />
                {property.squareFeet.toLocaleString()} sq ft
              </span>
            )}
          </div>

          {property.description && (
            <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
              {property.description}
            </p>
          )}
        </div>
      </div>

      {/* Currently listed sale weeks (read-only) */}
      <div className="bg-background rounded-xl border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Calendar className="w-4.5 h-4.5 text-muted-foreground" />
            Weeks Listed for Sale
          </h2>
        </div>
        <div className="divide-y">
          {property.saleWeeks.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-muted-foreground">
              No weeks currently listed for sale.
            </div>
          ) : (
            property.saleWeeks.map((w: any) => (
              <div key={w._id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium">Week {w.weekNumber}</span>
                  <span className="text-muted-foreground text-sm ml-2">
                    {w.isAnnual ? "Annual" : w.year ?? "—"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {w.price && (
                    <span className="text-sm font-medium">${w.price.toLocaleString()}</span>
                  )}
                  <WeekStatusBadge status={w.status} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sell My Week */}
      <div className="bg-background rounded-xl border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Tag className="w-4.5 h-4.5 text-muted-foreground" />
            Sell My Week
          </h2>
          {!showSellForm && (
            <button
              onClick={() => setShowSellForm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Request
            </button>
          )}
        </div>

        {/* Sell form */}
        {showSellForm && (
          <div className="px-5 py-4 bg-primary/5 border-b">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Week #</label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={sellForm.weekNumber}
                    onChange={(e) =>
                      setSellForm({ ...sellForm, weekNumber: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Asking Price ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={sellForm.askingPrice}
                    onChange={(e) =>
                      setSellForm({ ...sellForm, askingPrice: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Notes (optional)</label>
                <textarea
                  value={sellForm.notes}
                  onChange={(e) => setSellForm({ ...sellForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder="Any additional details about the sale…"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowSellForm(false)}
                  className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitSale}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sale request history */}
        <div className="divide-y">
          {saleRequests === undefined ? (
            <div className="px-5 py-4 text-sm text-muted-foreground">Loading…</div>
          ) : saleRequests.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-muted-foreground">
              No sale requests yet. Use "New Request" to list a week for sale.
            </div>
          ) : (
            saleRequests.map((r: any) => (
              <div key={r._id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm">Week {r.weekNumber}</span>
                      <RequestStatusBadge status={r.status} />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Asking ${r.askingPrice.toLocaleString()}
                    </div>
                    {r.notes && (
                      <div className="text-xs text-muted-foreground mt-0.5">{r.notes}</div>
                    )}
                    {r.adminNotes && (
                      <div className="text-xs text-amber-600 mt-1">
                        Admin: {r.adminNotes}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground/60 mt-1">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  {r.status === "pending" && (
                    <button
                      onClick={() => handleCancelRequest(r._id)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Cancel request"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Community features (read-only) */}
      {Object.keys(property.communityFeatures).length > 0 && (
        <div className="bg-background rounded-xl border">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold">Community Features</h2>
          </div>
          <div className="p-5 grid sm:grid-cols-2 gap-4">
            {Object.entries(property.communityFeatures).map(([category, items]) => (
              <div key={category}>
                <h3 className="text-sm font-medium mb-1">{category}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {items as string}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Community amenities */}
      {property.communityAmenities.length > 0 && (
        <div className="bg-background rounded-xl border">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold">Community Amenities</h2>
          </div>
          <div className="p-5 flex flex-wrap gap-2">
            {property.communityAmenities.map((a: string) => (
              <span
                key={a}
                className="px-3 py-1 bg-primary/5 text-sm rounded-full"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WeekStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    available: "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    sold: "bg-red-100 text-red-700",
    not_listed: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[status] ?? colors.not_listed}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function RequestStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}
