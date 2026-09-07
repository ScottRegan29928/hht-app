import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import {
  Search,
  Plus,
  Eye,
  EyeOff,
  Star,
  StarOff,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { Id } from "../../../convex/_generated/dataModel";

export function AdminPropertiesPage() {
  const properties = useQuery(api.admin.listProperties);
  const toggleFlag = useMutation(api.admin.togglePropertyFlag);
  const deleteProperty = useMutation(api.admin.deleteProperty);
  const [search, setSearch] = useState("");
  const [filterCommunity, setFilterCommunity] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [deleting, setDeleting] = useState<string | null>(null);

  if (properties === undefined) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Properties</h1>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-background border rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const communities = [...new Set(properties.map((p) => p.communityName))].sort();

  const filtered = properties.filter((p) => {
    if (search && !p.address.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCommunity && p.communityName !== filterCommunity) return false;
    if (filterStatus === "active" && !p.isActive) return false;
    if (filterStatus === "inactive" && p.isActive) return false;
    return true;
  });

  const handleToggle = async (id: Id<"properties">, field: "isActive" | "isFeatured") => {
    try {
      await toggleFlag({ id, field });
      toast.success(`Property ${field === "isActive" ? "status" : "featured"} updated`);
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (id: Id<"properties">, address: string) => {
    if (!confirm(`Delete "${address}" and all its weeks? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await deleteProperty({ id });
      toast.success("Property deleted");
    } catch {
      toast.error("Failed to delete");
    }
    setDeleting(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Properties</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} of {properties.length} properties
          </p>
        </div>
        <Link
          to="/management/properties/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Property
        </Link>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select
          value={filterCommunity}
          onChange={(e) => setFilterCommunity(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">All Communities</option>
          {communities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Properties table */}
      <div className="bg-background rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-semibold">Property</th>
                <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Community</th>
                <th className="text-center px-4 py-3 font-semibold hidden md:table-cell">Bed/Bath</th>
                <th className="text-center px-4 py-3 font-semibold">Active</th>
                <th className="text-center px-4 py-3 font-semibold hidden sm:table-cell">Featured</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p._id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      to={`/management/properties/${p._id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {p.address}
                    </Link>
                    <div className="text-xs text-muted-foreground sm:hidden mt-0.5">
                      {p.communityName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {p.communityName}
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    {p.bedrooms}bd / {p.bathrooms}ba
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(p._id as Id<"properties">, "isActive")}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                        p.isActive
                          ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-950 dark:text-green-300"
                          : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-300"
                      }`}
                    >
                      {p.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {p.isActive ? "Live" : "Off"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <button
                      onClick={() => handleToggle(p._id as Id<"properties">, "isFeatured")}
                      className={`p-1.5 rounded-md transition-colors ${
                        p.isFeatured
                          ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                          : "text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {p.isFeatured ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={`/management/properties/${p._id}`}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(p._id as Id<"properties">, p.address)}
                        disabled={deleting === p._id}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <a
                        href={`/property/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="View listing"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No properties found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
