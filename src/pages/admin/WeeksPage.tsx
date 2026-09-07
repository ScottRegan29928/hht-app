import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Save, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "../../../convex/_generated/dataModel";

const EMPTY_FORM = {
  weekNumber: 1,
  listingType: "both" as string,
  price: 0,
  rentPrice: 0,
  priceLabel: "",
  notes: "",
  status: "available" as string,
  year: new Date().getFullYear(),
  isAnnual: true,
  airbnbCalendarUrl: "",
  ownerId: null as string | null,
};

export function AdminWeeksPage() {
  const [searchParams] = useSearchParams();
  const preselectedProperty = searchParams.get("property") ?? "";

  const properties = useQuery(api.admin.listProperties);
  const [selectedProperty, setSelectedProperty] = useState(preselectedProperty);

  const weeks = useQuery(
    api.admin.listWeeksByProperty,
    selectedProperty
      ? { propertyId: selectedProperty as Id<"properties"> }
      : "skip"
  );
  const createWeek = useMutation(api.admin.createWeek);
  const updateWeek = useMutation(api.admin.updateWeek);
  const deleteWeek = useMutation(api.admin.deleteWeek);

  const [editing, setEditing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const selectedProp = useMemo(
    () => properties?.find((p) => p._id === selectedProperty),
    [properties, selectedProperty]
  );

  const startEdit = (week: any) => {
    setEditing(week._id);
    setForm({
      weekNumber: week.weekNumber,
      listingType: week.listingType ?? "both",
      price: week.price ?? 0,
      rentPrice: week.rentPrice ?? 0,
      priceLabel: week.priceLabel ?? "",
      notes: week.notes ?? "",
      status: week.status,
      year: week.year ?? new Date().getFullYear(),
      isAnnual: week.isAnnual ?? true,
      airbnbCalendarUrl: week.airbnbCalendarUrl ?? "",
      ownerId: (week as any).ownerId ?? null,
    });
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await updateWeek({
          id: editing as Id<"weeks">,
          weekNumber: form.weekNumber,
          listingType: form.listingType as any,
          price: form.price || undefined,
          rentPrice: form.rentPrice || undefined,
          priceLabel: form.priceLabel || undefined,
          notes: form.notes || undefined,
          status: form.status as any,
          year: form.year || undefined,
          isAnnual: form.isAnnual,
          airbnbCalendarUrl: form.airbnbCalendarUrl || undefined,
          ownerId: form.ownerId || null,
        });
        toast.success("Week updated");
        setEditing(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
  };

  const handleCreate = async () => {
    if (!selectedProperty) return;
    try {
      await createWeek({
        propertyId: selectedProperty as Id<"properties">,
        weekNumber: form.weekNumber,
        listingType: form.listingType as any,
        price: form.price || undefined,
        rentPrice: form.rentPrice || undefined,
        priceLabel: form.priceLabel || undefined,
        notes: form.notes || undefined,
        status: form.status as any,
        year: form.year || undefined,
        isAnnual: form.isAnnual,
        airbnbCalendarUrl: form.airbnbCalendarUrl || undefined,
        ownerId: form.ownerId || undefined,
      });
      toast.success("Week added");
      setShowAdd(false);
      setForm({ ...EMPTY_FORM });
    } catch (err: any) {
      toast.error(err.message || "Failed to create");
    }
  };

  const handleDelete = async (id: Id<"weeks">, weekNum: number) => {
    if (!confirm(`Delete week ${weekNum}?`)) return;
    try {
      await deleteWeek({ id });
      toast.success("Week deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Weeks Manager</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage timeshare weeks for renting and selling by property
        </p>
      </div>

      {/* Property selector */}
      <div className="bg-background rounded-xl border p-4">
        <label className="block text-sm font-medium mb-1.5">Select Property</label>
        <select
          value={selectedProperty}
          onChange={(e) => {
            setSelectedProperty(e.target.value);
            setEditing(null);
            setShowAdd(false);
          }}
          className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Choose a property…</option>
          {properties?.map((p) => (
            <option key={p._id} value={p._id}>
              {p.address} — {p.communityName}
            </option>
          ))}
        </select>
      </div>

      {/* Weeks list */}
      {selectedProperty && (
        <div className="bg-background rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="font-semibold">
              {selectedProp?.address ?? "Property"} — Weeks
            </h2>
            <button
              onClick={() => {
                setShowAdd(true);
                setEditing(null);
                setForm({ ...EMPTY_FORM });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Week
            </button>
          </div>

          {/* Add form */}
          {showAdd && (
            <div className="px-5 py-4 bg-primary/5 border-b">
              <WeekForm
                form={form}
                setForm={setForm}
                onSave={handleCreate}
                onCancel={() => setShowAdd(false)}
                saveLabel="Add"
              />
            </div>
          )}

          {/* Week cards — mobile-friendly */}
          <div className="divide-y">
            {weeks === undefined ? (
              <div className="px-5 py-8 text-center text-muted-foreground">Loading…</div>
            ) : weeks.length === 0 ? (
              <div className="px-5 py-8 text-center text-muted-foreground">
                No weeks listed. Add one above.
              </div>
            ) : (
              weeks.map((w: any) =>
                editing === w._id ? (
                  <div key={w._id} className="px-5 py-4 bg-primary/5">
                    <WeekForm
                      form={form}
                      setForm={setForm}
                      onSave={handleSave}
                      onCancel={() => setEditing(null)}
                      saveLabel="Save"
                      weekId={w._id}
                    />
                  </div>
                ) : (
                  <div key={w._id} className="px-5 py-4 hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Top row: week number + badges */}
                        <div className="flex items-center flex-wrap gap-2 mb-1.5">
                          <span className="font-semibold">Week {w.weekNumber}</span>
                          <ListingTypeBadge type={w.listingType ?? "both"} />
                          <StatusBadge status={w.status} />
                        </div>
                        {/* Prices */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          {w.price ? (
                            <span className="text-muted-foreground">
                              Sale: <span className="text-foreground font-medium">${w.price.toLocaleString()}</span>
                            </span>
                          ) : null}
                          {w.rentPrice ? (
                            <span className="text-muted-foreground">
                              Rent: <span className="text-foreground font-medium">${w.rentPrice.toLocaleString()}/wk</span>
                            </span>
                          ) : null}
                          {!w.price && !w.rentPrice && w.priceLabel ? (
                            <span className="text-muted-foreground">{w.priceLabel}</span>
                          ) : null}
                        </div>
                        {/* Meta row */}
                        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-1">
                          <span>{w.isAnnual ? "Annual" : w.year ?? "—"}</span>
                          {w.notes && <span className="truncate max-w-[200px]">{w.notes}</span>}
                          {w.airbnbCalendarUrl && (
                            <span className={w.lastSyncError ? "text-red-500" : "text-green-600"}>
                              {w.lastSyncError
                                ? `⚠ Sync error`
                                : w.lastSyncAt
                                  ? `✓ Synced ${new Date(w.lastSyncAt).toLocaleDateString()}`
                                  : "⏳ Pending sync"}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Action buttons — large touch targets */}
                      <div className="flex items-center gap-1 shrink-0">
                        {selectedProp?.slug && (
                          <a
                            href={`/property/${selectedProp.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 active:bg-primary/10 transition-colors"
                            title="View listing"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => startEdit(w)}
                          className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted transition-colors"
                          aria-label="Edit week"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(w._id, w.weekNumber)}
                          className="p-2.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 active:bg-red-50 transition-colors"
                          aria-label="Delete week"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WeekForm({
  form,
  setForm,
  onSave,
  onCancel,
  saveLabel,
  weekId,
}: {
  form: any;
  setForm: (f: any) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
  weekId?: string;
}) {
  const showSalePrice = form.listingType === "sale" || form.listingType === "both";
  const showRentPrice = form.listingType === "rent" || form.listingType === "both";
  const owners = useQuery(api.admin.listOwners) ?? [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Week #</label>
          <input
            type="number"
            min={1}
            max={52}
            value={form.weekNumber}
            onChange={(e) => setForm({ ...form, weekNumber: Number(e.target.value) })}
            className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Listing Type</label>
          <select
            value={form.listingType}
            onChange={(e) => setForm({ ...form, listingType: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="rent">For Rent</option>
            <option value="sale">For Sale</option>
            <option value="both">Rent & Sale</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="available">Available</option>
            <option value="pending">Pending</option>
            <option value="sold">Sold</option>
            <option value="rented">Rented</option>
            <option value="not_listed">Not Listed</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Year</label>
          <input
            type="number"
            value={form.year}
            onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
            className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        {showSalePrice && (
          <div>
            <label className="block text-xs font-medium mb-1">Sale Price ($)</label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        )}
        {showRentPrice && (
          <div>
            <label className="block text-xs font-medium mb-1">Rent Price ($/wk)</label>
            <input
              type="number"
              value={form.rentPrice}
              onChange={(e) => setForm({ ...form, rentPrice: Number(e.target.value) })}
              className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Price Label</label>
          <input
            value={form.priceLabel}
            onChange={(e) => setForm({ ...form, priceLabel: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="e.g. Contact for pricing"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Notes</label>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Owner</label>
          <select
            value={form.ownerId || ""}
            onChange={(e) => setForm({ ...form, ownerId: e.target.value || null })}
            className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">No owner assigned</option>
            {owners.map((o: any) => (
              <option key={o._id} value={o._id}>
                {o.displayName || `${o.firstName || ""} ${o.lastName || ""}`.trim() || o.email}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* Airbnb iCal Sync */}
      <div>
        <label className="block text-xs font-medium mb-1">
          Airbnb iCal URL
          <span className="text-muted-foreground font-normal ml-1">(paste from Airbnb → Listing → Availability → Export Calendar)</span>
        </label>
        <input
          value={form.airbnbCalendarUrl}
          onChange={(e) => setForm({ ...form, airbnbCalendarUrl: e.target.value })}
          className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="https://www.airbnb.com/calendar/ical/{listing_id}.ics?s={secret_token}"
        />
        {form.airbnbCalendarUrl && (
          <p className="text-xs text-green-600 mt-1">✓ Syncs every 2 hours from Airbnb</p>
        )}
      </div>
      {/* Our export URL for Airbnb to import */}
      {weekId && (
        <div>
          <label className="block text-xs font-medium mb-1">
            Our Export URL
            <span className="text-muted-foreground font-normal ml-1">(paste into Airbnb → Listing → Pricing &amp; Availability → Import Calendar)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={`https://savory-heron-748.convex.site/api/calendar?weekId=${weekId}`}
              className="flex-1 px-3 py-2.5 rounded-lg border text-sm bg-muted/30 text-muted-foreground focus:outline-none"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`https://savory-heron-748.convex.site/api/calendar?weekId=${weekId}`);
                alert("Copied!");
              }}
              className="px-3 py-2.5 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors whitespace-nowrap"
            >
              📋 Copy
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Paste this URL into Airbnb → Listing → Pricing &amp; Availability → Import Calendar so Airbnb can pull bookings from our site.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isAnnual}
            onChange={(e) => setForm({ ...form, isAnnual: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm">Annual (every year)</span>
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            <Save className="w-3.5 h-3.5" />
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ListingTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    rent: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    sale: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    both: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  };
  const labels: Record<string, string> = {
    rent: "Rent",
    sale: "Sale",
    both: "Rent & Sale",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[type] ?? styles.both}`}>
      {labels[type] ?? type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    available: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    sold: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    rented: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    not_listed: "bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-300",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[status] ?? colors.not_listed}`}>
      {status.replace("_", " ")}
    </span>
  );
}
