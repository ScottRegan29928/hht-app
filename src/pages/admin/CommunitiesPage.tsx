import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { Pencil, Save, X, MapPin, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { Id } from "../../../convex/_generated/dataModel";

/** Convert snake_case key to display label */
function amenityLabel(key: string): string {
  const LABELS: Record<string, string> = {
    pool: "Swimming Pool",
    hot_tub: "Hot Tub",
    tennis: "Tennis Court",
    grill: "Grill Area",
    near_harbour_town: "Near Harbour Town",
    near_beach_club: "Near Beach Club",
    on_golf_course: "On Golf Course",
    beach_access: "Beach Access",
    bike_trails: "Bike Trails",
    fitness_center: "Fitness Center",
    golf: "Golf",
    lagoon_views: "Lagoon Views",
    marina: "Marina",
    nature_trails: "Nature Trails",
    playground: "Playground",
    shopping: "Shopping",
    water_views: "Water Views",
  };
  return LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Convert display name → snake_case key */
function toAmenityKey(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

/** Feature category key → nice label */
function featureLabel(key: string): string {
  const LABELS: Record<string, string> = {
    heating_and_cooling: "Heating & Cooling",
    kitchen_and_dining: "Kitchen & Dining",
    appliances: "Appliances",
    interior_features: "Interior Features",
    garage_and_parking: "Garage & Parking",
    exterior_features: "Exterior Features",
    views_and_location: "Views & Location",
    activities: "Activities",
    utilities: "Utilities",
    security: "Security",
    essentials: "Essentials",
  };
  return LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AdminCommunitiesPage() {
  const communities = useQuery(api.admin.listCommunities);
  const allAmenities = useQuery(api.properties.allAmenities);
  const updateCommunity = useMutation(api.admin.updateCommunity);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [newAmenity, setNewAmenity] = useState("");
  const [newFeatureKey, setNewFeatureKey] = useState("");

  if (communities === undefined) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Communities</h1>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-background border rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const startEdit = (community: any) => {
    setEditing(community._id);
    setForm({
      name: community.name,
      shortDescription: community.shortDescription ?? "",
      description: community.description ?? "",
      latitude: community.latitude,
      longitude: community.longitude,
      sortOrder: community.sortOrder ?? 0,
      amenities: community.amenities ?? [],
      features: community.features ?? {},
    });
    setNewAmenity("");
    setNewFeatureKey("");
  };

  const toggleAmenity = (key: string) => {
    setForm((f: any) => ({
      ...f,
      amenities: f.amenities.includes(key)
        ? f.amenities.filter((a: string) => a !== key)
        : [...f.amenities, key].sort(),
    }));
  };

  const addCustomAmenity = () => {
    const key = toAmenityKey(newAmenity);
    if (!key) return;
    if (form.amenities.includes(key)) {
      toast.error("Amenity already added");
      return;
    }
    setForm((f: any) => ({
      ...f,
      amenities: [...f.amenities, key].sort(),
    }));
    setNewAmenity("");
  };

  const removeAmenity = (key: string) => {
    setForm((f: any) => ({
      ...f,
      amenities: f.amenities.filter((a: string) => a !== key),
    }));
  };

  const updateFeature = (key: string, value: string) => {
    setForm((f: any) => ({
      ...f,
      features: { ...f.features, [key]: value },
    }));
  };

  const removeFeature = (key: string) => {
    setForm((f: any) => {
      const { [key]: _, ...rest } = f.features;
      return { ...f, features: rest };
    });
  };

  const addFeatureCategory = () => {
    const key = toAmenityKey(newFeatureKey);
    if (!key) return;
    if (form.features[key] !== undefined) {
      toast.error("Category already exists");
      return;
    }
    setForm((f: any) => ({
      ...f,
      features: { ...f.features, [key]: "" },
    }));
    setNewFeatureKey("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await updateCommunity({
        id: editing as Id<"communities">,
        name: form.name,
        shortDescription: form.shortDescription || undefined,
        description: form.description || undefined,
        latitude: form.latitude,
        longitude: form.longitude,
        sortOrder: form.sortOrder,
        amenities: form.amenities,
        features: form.features,
      });
      toast.success("Community updated");
      setEditing(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
  };

  // Build master amenity list: all known amenities across all communities
  const knownAmenities = new Set<string>(allAmenities ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Communities</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {communities.length} communities in Sea Pines
        </p>
      </div>

      <div className="space-y-4">
        {communities.map((c) => (
          <div key={c._id} className="bg-background rounded-xl border overflow-hidden">
            {editing === c._id ? (
              /* Edit mode */
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Editing: {c.name}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditing(null)}
                      className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={saveEdit}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Sort Order</label>
                    <input
                      type="number"
                      value={form.sortOrder}
                      onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Short Description</label>
                  <input
                    value={form.shortDescription}
                    onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Brief tagline"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Full Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={form.latitude}
                      onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                {/* ── Amenities section ── */}
                <div className="border-t pt-5">
                  <label className="block text-sm font-semibold mb-2">Amenities</label>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    {Array.from(knownAmenities).sort().map((key) => (
                      <label
                        key={key}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                          form.amenities.includes(key)
                            ? "bg-primary/10 border-primary/30 text-foreground font-medium"
                            : "bg-background border-input text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.amenities.includes(key)}
                          onChange={() => toggleAmenity(key)}
                          className="rounded border-input"
                        />
                        {amenityLabel(key)}
                      </label>
                    ))}
                  </div>

                  {form.amenities
                    .filter((a: string) => !knownAmenities.has(a))
                    .map((key: string) => (
                      <div
                        key={key}
                        className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full mr-2 mb-2"
                      >
                        {amenityLabel(key)}
                        <button onClick={() => removeAmenity(key)} className="hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                  <div className="flex items-center gap-2 mt-1">
                    <input
                      value={newAmenity}
                      onChange={(e) => setNewAmenity(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addCustomAmenity(); }
                      }}
                      className="flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="Add new amenity (e.g. Dog Park)"
                    />
                    <button
                      onClick={addCustomAmenity}
                      disabled={!newAmenity.trim()}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    New amenities automatically appear in the public search filters.
                  </p>
                </div>

                {/* ── Features section ── */}
                <div className="border-t pt-5">
                  <label className="block text-sm font-semibold mb-1">Property Features</label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Features shared by all properties in this community. These appear on every property page.
                  </p>

                  <div className="space-y-3">
                    {Object.entries(form.features as Record<string, string>)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2">
                          <div className="flex-1">
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                              {featureLabel(key)}
                            </label>
                            <textarea
                              value={value}
                              onChange={(e) => updateFeature(key, e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                              placeholder="e.g. Central Air, Electric Heat, Ceiling Fans"
                            />
                          </div>
                          <button
                            onClick={() => removeFeature(key)}
                            className="mt-5 p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Remove category"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                  </div>

                  {/* Add new feature category */}
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      value={newFeatureKey}
                      onChange={(e) => setNewFeatureKey(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addFeatureCategory(); }
                      }}
                      className="flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="New category name (e.g. Pool & Spa)"
                    />
                    <button
                      onClick={addFeatureCategory}
                      disabled={!newFeatureKey.trim()}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* View mode */
              <div className="flex items-center gap-4 p-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {c.propertyCount} properties
                    </span>
                  </div>
                  {c.shortDescription && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {c.shortDescription}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}
                  </div>
                  {(c as any).amenities && (c as any).amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(c as any).amenities.map((a: string) => (
                        <span
                          key={a}
                          className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                        >
                          {amenityLabel(a)}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Show feature count in view mode */}
                  {(c as any).features && Object.keys((c as any).features).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {Object.keys((c as any).features).length} feature categories
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => startEdit(c)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <Link
                    to={`/community/${c.slug}`}
                    target="_blank"
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="View on site"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
