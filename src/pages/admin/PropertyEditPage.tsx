import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Star,
  GripVertical,
  Plus,
  X,
  Lock,
  ImageOff,
} from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import { HOSTAWAY_OWNED_FIELDS, HOSTAWAY_LOCK_NOTE } from "../../../convex/hostawayFields";
import { SEARCH_FACETS } from "../../../convex/searchFacets";
import { photoSrc } from "@/lib/photoSrc";

export function PropertyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";

  const property = useQuery(
    api.admin.getProperty,
    isNew ? "skip" : { id: id as Id<"properties"> }
  );
  const communities = useQuery(api.admin.listCommunities);
  const allUsers = useQuery(api.admin.listUsers);
  // Owner assignment is done at the week level, not property level
  const updateProperty = useMutation(api.admin.updateProperty);
  const createProperty = useMutation(api.admin.createProperty);

  // Owner users for assignment dropdown
  const ownerUsers = allUsers?.filter((u: any) => u.role === "owner") ?? [];

  /**
   * HostAway-imported fields are read-only here [scott, 2026-09-15]: they are
   * overwritten by the 30-minute sync, so editing them only ever lost work.
   * The server rejects them too (convex/hostawayFields.ts) — this just stops
   * the editor from offering an edit that would be refused.
   */
  const hostawayLinked = !isNew && ((property as any)?.hostawayLinked ?? false);
  const isLocked = (field: string) =>
    hostawayLinked && (HOSTAWAY_OWNED_FIELDS as readonly string[]).includes(field);
  const lockCls = (field: string) =>
    isLocked(field) ? " bg-muted text-muted-foreground cursor-not-allowed" : "";

  const [saving, setSaving] = useState(false);
  const [facetOverrides, setFacetOverrides] = useState<Record<string, boolean>>({});
  const pageAmenities = useQuery(
    api.amenitySettings.listForProperty,
    !isNew && id ? { propertyId: id as Id<"properties"> } : "skip",
  ) as
    | { amenityId: string; label: string; raw: string; hidden: boolean }[]
    | undefined;
  const setAmenityHidden = useMutation(api.amenitySettings.setAmenityHidden);

  // Form state
  const [form, setForm] = useState({
    address: "",
    unitNumber: "",
    communityId: "" as string,
    bedrooms: 2,
    bathrooms: 2,
    sleeps: 0,
    squareFeet: 0,
    description: "",
    isActive: true,
    isFeatured: false,
    bookingUrl: "",
    calendarUrl: "",
    ownerDocsUrl: "",
    houseRules: "",
    cancellationPolicy: "",
    checkInInfo: "",
    ownerId: "" as string,
    // Rental details (Hostaway)
    nightlyRate: 0,
    cleaningFee: 0,
    weeklyDiscount: 0,
    monthlyDiscount: 0,
    maxNights: 0,
    checkInTime: "",
    checkOutTime: "",
    checkinType: "",
    bedsCount: 0,
    bedTypes: "" as string, // semicolon-separated for editing
    roomType: "",
    contactPhone: "",
  });

  // Populate form when property loads
  useEffect(() => {
    if (property && !isNew) {
      setForm({
        address: property.address,
        unitNumber: property.unitNumber,
        communityId: property.communityId,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        sleeps: property.sleeps ?? 0,
        squareFeet: property.squareFeet ?? 0,
        description: property.description ?? "",
        isActive: property.isActive,
        isFeatured: property.isFeatured ?? false,
        bookingUrl: property.bookingUrl ?? "",
        calendarUrl: property.calendarUrl ?? "",
        ownerDocsUrl: property.ownerDocsUrl ?? "",
        houseRules: property.houseRules ?? "",
        cancellationPolicy: property.cancellationPolicy ?? "",
        checkInInfo: property.checkInInfo ?? "",
        ownerId: property.ownerId ?? "",
        // Rental details (Hostaway)
        nightlyRate: (property as any).nightlyRate ?? 0,
        cleaningFee: (property as any).cleaningFee ?? 0,
        weeklyDiscount: (property as any).weeklyDiscount ?? 0,
        monthlyDiscount: (property as any).monthlyDiscount ?? 0,
        maxNights: (property as any).maxNights ?? 0,
        checkInTime: (property as any).checkInTime ?? "",
        checkOutTime: (property as any).checkOutTime ?? "",
        checkinType: (property as any).checkinType ?? "",
        bedsCount: (property as any).bedsCount ?? 0,
        bedTypes: ((property as any).bedTypes ?? []).join("; "),
        roomType: (property as any).roomType ?? "",
        contactPhone: (property as any).contactPhone ?? "",
      });
      setFacetOverrides(((property as any).facetOverrides ?? {}) as Record<string, boolean>);
    }
  }, [property, isNew]);

  // Loading
  if (!isNew && property === undefined) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-background border rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!isNew && property === null) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-muted-foreground">Property not found</p>
        <Link to="/management/properties" className="text-primary text-sm hover:underline mt-2 inline-block">
          Back to properties
        </Link>
      </div>
    );
  }

  const updateField = (field: string, value: any) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.address || !form.communityId) {
      toast.error("Address and community are required");
      return;
    }
    setSaving(true);
    try {
      const rentalFields = {
        nightlyRate: form.nightlyRate || undefined,
        cleaningFee: form.cleaningFee || undefined,
        weeklyDiscount: form.weeklyDiscount || undefined,
        monthlyDiscount: form.monthlyDiscount || undefined,
        maxNights: form.maxNights || undefined,
        checkInTime: form.checkInTime || undefined,
        checkOutTime: form.checkOutTime || undefined,
        checkinType: form.checkinType || undefined,
        bedsCount: form.bedsCount || undefined,
        bedTypes: form.bedTypes ? form.bedTypes.split(";").map((s: string) => s.trim()).filter(Boolean) : undefined,
        roomType: form.roomType || undefined,
        contactPhone: form.contactPhone || undefined,
      };
      if (isNew) {
        const newId = await createProperty({
          address: form.address,
          unitNumber: form.unitNumber,
          communityId: form.communityId as Id<"communities">,
          bedrooms: form.bedrooms,
          bathrooms: form.bathrooms,
          sleeps: form.sleeps || undefined,
          squareFeet: form.squareFeet || undefined,
          description: form.description || undefined,
          isActive: form.isActive,
          isFeatured: form.isFeatured,
          bookingUrl: form.bookingUrl || undefined,
          calendarUrl: form.calendarUrl || undefined,
          ownerDocsUrl: form.ownerDocsUrl || undefined,
          houseRules: form.houseRules || undefined,
          cancellationPolicy: form.cancellationPolicy || undefined,
          checkInInfo: form.checkInInfo || undefined,
          ...rentalFields,
        });
        toast.success("Property created");
        navigate(`/management/properties/${newId}`);
      } else {
        // Locked fields are stripped before sending: the server rejects them
        // outright for HostAway-linked properties [scott, 2026-09-15].
        const payload: Record<string, unknown> = {
          id: id as Id<"properties">,
          facetOverrides,
          address: form.address,
          unitNumber: form.unitNumber,
          communityId: form.communityId as Id<"communities">,
          bedrooms: form.bedrooms,
          bathrooms: form.bathrooms,
          sleeps: form.sleeps || undefined,
          squareFeet: form.squareFeet || undefined,
          description: form.description || undefined,
          isActive: form.isActive,
          isFeatured: form.isFeatured,
          bookingUrl: form.bookingUrl || undefined,
          calendarUrl: form.calendarUrl || undefined,
          ownerDocsUrl: form.ownerDocsUrl || undefined,
          houseRules: form.houseRules || undefined,
          cancellationPolicy: form.cancellationPolicy || undefined,
          checkInInfo: form.checkInInfo || undefined,
          ...rentalFields,
        };
        if (hostawayLinked) {
          for (const f of HOSTAWAY_OWNED_FIELDS) delete payload[f];
        }
        await updateProperty(payload as any);
        toast.success("Property updated");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
    setSaving(false);
  };



  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/management/properties"
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {isNew ? "New Property" : form.address || "Edit Property"}
            </h1>
            {!isNew && property?.communityName && (
              <p className="text-sm text-muted-foreground">{property.communityName}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* HostAway lock notice [scott, 2026-09-15] */}
      {hostawayLinked && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">This property is synced from HostAway.</p>
            <p className="mt-0.5 text-amber-800">
              Greyed-out fields are imported and can only be changed in HostAway — the
              sync rewrites them every 30 minutes. Everything still editable below
              (search filters, policies, owner documents, featured status) belongs to
              this site only.
            </p>
          </div>
        </div>
      )}

      {/* Basic info */}
      <div className="bg-background rounded-xl border p-6 space-y-5">
        <h2 className="font-semibold text-lg">Basic Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Address *</label>
            <input
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50${lockCls("address")}`}
              placeholder="e.g. 2870 Swallowtail"
            disabled={isLocked("address")}
              />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Unit Number</label>
            <input
              value={form.unitNumber}
              onChange={(e) => updateField("unitNumber", e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50${lockCls("unitNumber")}`}
              placeholder="e.g. 2870"
            disabled={isLocked("unitNumber")}
              />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Community *</label>
          <select
            value={form.communityId}
            onChange={(e) => updateField("communityId", e.target.value)}
            className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50${lockCls("communityId")}`}
          disabled={isLocked("communityId")}
              >
            <option value="">Select community…</option>
            {communities?.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Owner assignment removed — owners are assigned at the week level on the Weeks page */}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Bedrooms</label>
            <input
              type="number"
              value={form.bedrooms}
              onChange={(e) => updateField("bedrooms", Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50${lockCls("bedrooms")}`}
              min={0}
            disabled={isLocked("bedrooms")}
              />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Bathrooms</label>
            <input
              type="number"
              step="0.5"
              value={form.bathrooms}
              onChange={(e) => updateField("bathrooms", Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50${lockCls("bathrooms")}`}
              min={0}
            disabled={isLocked("bathrooms")}
              />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Sleeps</label>
            <input
              type="number"
              value={form.sleeps}
              onChange={(e) => updateField("sleeps", Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50${lockCls("sleeps")}`}
              min={0}
            disabled={isLocked("sleeps")}
              />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Sq Ft</label>
            <input
              type="number"
              value={form.squareFeet}
              onChange={(e) => updateField("squareFeet", Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              min={0}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            rows={4}
            className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y${lockCls("description")}`}
            placeholder="Property description…"
          disabled={isLocked("description")}
              />
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => updateField("isActive", e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">Active (visible on site)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => updateField("isFeatured", e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">Featured</span>
          </label>
        </div>
      </div>

      {/* Rental Details */}
      <div className="bg-background rounded-xl border p-6 space-y-5">
        <h2 className="font-semibold text-lg">Rental Details</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Nightly Rate ($)</label>
            <input
              type="number"
              value={form.nightlyRate || ""}
              onChange={(e) => updateField("nightlyRate", Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50${lockCls("nightlyRate")}`}
              placeholder="200"
              min={0}
            disabled={isLocked("nightlyRate")}
              />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Cleaning Fee ($)</label>
            <input
              type="number"
              value={form.cleaningFee || ""}
              onChange={(e) => updateField("cleaningFee", Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50${lockCls("cleaningFee")}`}
              placeholder="217"
              min={0}
            disabled={isLocked("cleaningFee")}
              />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Weekly Discount</label>
            <input
              type="number"
              step="0.05"
              value={form.weeklyDiscount || ""}
              onChange={(e) => updateField("weeklyDiscount", Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50${lockCls("weeklyDiscount")}`}
              placeholder="0.75 = 25% off"
              min={0}
              max={1}
            disabled={isLocked("weeklyDiscount")}
              />
            {form.weeklyDiscount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round((1 - form.weeklyDiscount) * 100)}% off weekly stays
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Monthly Discount</label>
            <input
              type="number"
              step="0.05"
              value={form.monthlyDiscount || ""}
              onChange={(e) => updateField("monthlyDiscount", Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50${lockCls("monthlyDiscount")}`}
              placeholder="0.5 = 50% off"
              min={0}
              max={1}
            disabled={isLocked("monthlyDiscount")}
              />
            {form.monthlyDiscount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round((1 - form.monthlyDiscount) * 100)}% off monthly stays
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Check-in Time</label>
            <input
              value={form.checkInTime}
              onChange={(e) => updateField("checkInTime", e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50${lockCls("checkInTime")}`}
              placeholder="4:00 PM"
            disabled={isLocked("checkInTime")}
              />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Check-out Time</label>
            <input
              value={form.checkOutTime}
              onChange={(e) => updateField("checkOutTime", e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50${lockCls("checkOutTime")}`}
              placeholder="10:00 AM"
            disabled={isLocked("checkOutTime")}
              />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Max Nights</label>
            <input
              type="number"
              value={form.maxNights || ""}
              onChange={(e) => updateField("maxNights", Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50${lockCls("maxNights")}`}
              placeholder="28"
              min={0}
            disabled={isLocked("maxNights")}
              />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Check-in Type</label>
            <select
              value={form.checkinType}
              onChange={(e) => updateField("checkinType", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select…</option>
              <option value="keypad">Keypad</option>
              <option value="lockbox">Lockbox</option>
              <option value="smartlock">Smart Lock</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Total Beds</label>
            <input
              type="number"
              value={form.bedsCount || ""}
              onChange={(e) => updateField("bedsCount", Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50${lockCls("bedsCount")}`}
              min={0}
            disabled={isLocked("bedsCount")}
              />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1.5">Bed Types</label>
            <input
              value={form.bedTypes}
              onChange={(e) => updateField("bedTypes", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="King Bed; Queen Bed; Single Bed"
            />
            <p className="text-xs text-muted-foreground mt-1">Separate with semicolons</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Room Type</label>
            <input
              value={form.roomType}
              onChange={(e) => updateField("roomType", e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50${lockCls("roomType")}`}
              placeholder="Deluxe Villa"
            disabled={isLocked("roomType")}
              />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Contact Phone</label>
            <input
              value={form.contactPhone}
              onChange={(e) => updateField("contactPhone", e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50${lockCls("contactPhone")}`}
              placeholder="(843) 384-0230"
            disabled={isLocked("contactPhone")}
              />
          </div>
        </div>
      </div>

      {/* Search filters — the curated twelve [scott, 2026-09-15] */}
      <div className="bg-background rounded-xl border p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-lg">Search Filters</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Whether this property matches each filter. Most are worked out from
            HostAway and the community; set one explicitly when that guess is wrong,
            or for the ones HostAway never supplies. Which filters visitors actually
            see is set under Search Filters in the sidebar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SEARCH_FACETS.map((f) => {
            const info = ((property as any)?.facets ?? []).find((x: any) => x.id === f.id);
            const derived: boolean = info?.derived ?? false;
            const override = facetOverrides[f.id];
            const effective = override ?? derived;
            const setOverride = (val: boolean | undefined) => {
              setFacetOverrides((prev) => {
                const next = { ...prev };
                if (val === undefined) delete next[f.id];
                else next[f.id] = val;
                return next;
              });
            };
            return (
              <div
                key={f.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={effective}
                      onChange={(e) =>
                        // Checking back to the derived value clears the override
                        // rather than pinning it, so later HostAway changes still
                        // flow through.
                        setOverride(e.target.checked === derived ? undefined : e.target.checked)
                      }
                      className="rounded border-input"
                    />
                    {f.label}
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {override !== undefined ? (
                      <>
                        Set manually to <strong>{override ? "yes" : "no"}</strong>
                        {" · "}
                        <button
                          type="button"
                          onClick={() => setOverride(undefined)}
                          className="underline hover:text-foreground"
                        >
                          use imported value ({derived ? "yes" : "no"})
                        </button>
                      </>
                    ) : derived ? (
                      "From HostAway or the community"
                    ) : (
                      f.note ?? "Not set"
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Links */}
      <div className="bg-background rounded-xl border p-6 space-y-5">
        <h2 className="font-semibold text-lg">Links & URLs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Booking URL</label>
            <input
              value={form.bookingUrl}
              onChange={(e) => updateField("bookingUrl", e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50${lockCls("bookingUrl")}`}
              placeholder="https://…"
            disabled={isLocked("bookingUrl")}
              />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Calendar URL</label>
            <input
              value={form.calendarUrl}
              onChange={(e) => updateField("calendarUrl", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Owner Docs URL</label>
            <input
              value={form.ownerDocsUrl}
              onChange={(e) => updateField("ownerDocsUrl", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="https://…"
            />
          </div>
        </div>
      </div>

      {/* Policies */}
      <div className="bg-background rounded-xl border p-6 space-y-5">
        <h2 className="font-semibold text-lg">Policies & Info</h2>
        <div>
          <label className="block text-sm font-medium mb-1.5">House Rules</label>
          <textarea
            value={form.houseRules}
            onChange={(e) => updateField("houseRules", e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Check-in Info</label>
          <textarea
            value={form.checkInInfo}
            onChange={(e) => updateField("checkInInfo", e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Cancellation Policy</label>
          <textarea
            value={form.cancellationPolicy}
            onChange={(e) => updateField("cancellationPolicy", e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
          />
        </div>
      </div>

      {/* Amenities shown on this property's page [scott, 2026-09-16] */}
      {!isNew && pageAmenities && pageAmenities.length > 0 && (
        <div className="bg-background rounded-xl border p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-lg">Amenities On This Page</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Everything HostAway lists for this villa. Uncheck an item to hide it
              from the public page &mdash; useful for the odd entry that reads as
              clutter. This only changes what the page displays; it never changes
              which properties a search filter returns.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {pageAmenities.map((a) => (
              <label
                key={a.amenityId}
                className="flex items-center gap-2 text-sm rounded-lg border px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={!a.hidden}
                  className="rounded border-input"
                  onChange={(e) =>
                    void setAmenityHidden({
                      propertyId: id as Id<"properties">,
                      amenityId: a.amenityId,
                      hidden: !e.target.checked,
                    }).catch(() => toast.error("Could not save"))
                  }
                />
                <span className={a.hidden ? "text-muted-foreground line-through" : ""}>
                  {a.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Photos */}
      {!isNew && (
        <div className="bg-background rounded-xl border p-6 space-y-5">
          {/*
            * View-only [scott, 2026-09-16]: "let's show the photos in the
            * portal but not them to be deleted or added to." Photos are
            * HostAway's record, synced daily, so editing them here would
            * either be overwritten by the next sync or drift from HostAway.
            * Same rule as the other HostAway-fed fields in this form.
            */}
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold text-lg">Photos</h2>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="w-3 h-3" />
              Managed in HostAway
            </span>
          </div>

          {/* Existing photos from photoUrls */}
          {property?.photoUrls && property.photoUrls.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">
                Current Photos ({property.photoUrls.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {property.photoUrls.map((url, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden aspect-[4/3] bg-muted">
                    <img
                      src={photoSrc(url)}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover"
                      /*
                       * These are HostAway S3 originals (~270KB each, 38 on a
                       * busy listing = 10MB), so load them lazily rather than
                       * all at once. onError swaps in a labeled placeholder:
                       * a real dead URL then reads as "unavailable" instead of
                       * a broken-image icon that looks like our bug.
                       */
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        const img = e.currentTarget;
                        img.style.display = "none";
                        // Inline style, not a class toggle: Tailwind's `hidden`
                        // and `flex` are both display rules and the winner
                        // depends on stylesheet order, not on which we add.
                        const fb = img.parentElement?.querySelector<HTMLElement>(
                          "[data-photo-fallback]",
                        );
                        if (fb) fb.style.display = "flex";
                      }}
                    />
                    <div
                      data-photo-fallback
                      style={{ display: "none" }}
                      className="absolute inset-0 flex-col items-center justify-center gap-1 bg-muted text-muted-foreground"
                    >
                      <ImageOff className="h-5 w-5" />
                      <span className="text-[10px] text-center px-1">
                        Image unavailable
                      </span>
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                    <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/*
            * Mirrored copies held in our own storage (the hero shot used on
            * cards). Labeled "Stored Copies" rather than "Uploaded" now that
            * nothing in the portal can upload.
            */}
          {property?.photos && property.photos.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">
                Stored Copies ({property.photos.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {property.photos.map((photo: any) => (
                  <PhotoCard key={photo._id} photo={photo} />
                ))}
              </div>
            </div>
          )}

          {(!property?.photoUrls || property.photoUrls.length === 0) &&
            (!property?.photos || property.photos.length === 0) && (
              <div className="text-center py-12 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                No photos yet. Photos appear here once they are added in
                HostAway.
              </div>
            )}
        </div>
      )}

      {/* Weeks section (inline) */}
      {!isNew && property?.weeks && (
        <div className="bg-background rounded-xl border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">
              Weeks ({property.weeks.length})
            </h2>
            <Link
              to={`/management/weeks?property=${id}`}
              className="text-sm text-primary hover:underline"
            >
              Manage weeks →
            </Link>
          </div>
          {property.weeks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium">Week</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-right px-3 py-2 font-medium">Price</th>
                    <th className="text-left px-3 py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {property.weeks.map((w: any) => (
                    <tr key={w._id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">Week {w.weekNumber}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            w.status === "available"
                              ? "bg-green-100 text-green-700"
                              : w.status === "pending"
                              ? "bg-amber-100 text-amber-700"
                              : w.status === "sold"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {w.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {w.price ? `$${w.price.toLocaleString()}` : w.priceLabel ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{w.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No weeks listed for this property
            </p>
          )}
        </div>
      )}

      {/* Features are now managed at the community level — see Communities page */}
    </div>
  );
}

// Small component for uploaded photos
function PhotoCard({ photo }: { photo: any }) {
  const url = useQuery(
    api.admin.getStorageUrl,
    photo.storageId ? { storageId: photo.storageId } : "skip"
  );

  return (
    <div className="relative group rounded-lg overflow-hidden aspect-[4/3] bg-muted">
      {url ? (
        <img src={url} alt={photo.caption ?? "Photo"} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full animate-pulse bg-muted" />
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
      {photo.isPrimary && (
        <span className="absolute top-1.5 left-1.5 text-amber-400">
          <Star className="w-4 h-4 fill-current" />
        </span>
      )}
    </div>
  );
}
