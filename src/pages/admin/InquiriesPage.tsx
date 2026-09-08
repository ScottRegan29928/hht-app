import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { Mail, Phone, MessageSquare, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "../../../convex/_generated/dataModel";

export function AdminInquiriesPage() {
  const inquiries = useQuery(api.admin.listInquiries);
  const updateStatus = useMutation(api.admin.updateInquiryStatus);
  const [filterType, setFilterType] = useState<"all" | "purchase" | "rental" | "general">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "new" | "contacted" | "closed">("all");

  if (inquiries === undefined) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Inquiries</h1>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-background border rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const filtered = inquiries.filter((inq) => {
    if (filterType !== "all" && inq.type !== filterType) return false;
    if (filterStatus !== "all" && inq.status !== filterStatus) return false;
    return true;
  });

  const handleStatusChange = async (id: Id<"inquiries">, status: "new" | "contacted" | "closed") => {
    try {
      await updateStatus({ id, status });
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inquiries</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {filtered.length} of {inquiries.length} inquiries
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">All Types</option>
          <option value="purchase">Purchase</option>
          <option value="general">Contact</option>
          <option value="rental">Rental</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Inquiries list */}
      {filtered.length === 0 ? (
        <div className="bg-background rounded-xl border p-12 text-center text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No inquiries found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inq) => (
            <div key={inq._id} className="bg-background rounded-xl border p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{inq.name}</h3>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        inq.type === "purchase"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          : inq.type === "general"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      }`}
                    >
                      {inq.type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(inq.createdAt).toLocaleDateString()} at{" "}
                      {new Date(inq.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {(inq.propertyAddress || inq.communityName) && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {inq.propertyAddress}
                      {inq.communityName && ` — ${inq.communityName}`}
                    </p>
                  )}

                  {inq.message && (
                    <p className="text-sm mt-2 bg-muted/50 rounded-lg px-3 py-2">
                      {inq.message}
                    </p>
                  )}

                  <div className="flex items-center gap-4 mt-3">
                    <a
                      href={`mailto:${inq.email}`}
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Mail className="w-3 h-3" />
                      {inq.email}
                    </a>
                    {inq.phone && (
                      <a
                        href={`tel:${inq.phone}`}
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <Phone className="w-3 h-3" />
                        {inq.phone}
                      </a>
                    )}
                  </div>
                </div>

                {/* Status selector */}
                <select
                  value={inq.status}
                  onChange={(e) =>
                    handleStatusChange(inq._id as Id<"inquiries">, e.target.value as any)
                  }
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer focus:outline-none ${
                    inq.status === "new"
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : inq.status === "contacted"
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-green-50 border-green-200 text-green-700"
                  }`}
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
