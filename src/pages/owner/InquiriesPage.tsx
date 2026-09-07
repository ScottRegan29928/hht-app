import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { MessageSquare, Check, Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "../../../convex/_generated/dataModel";

export function OwnerInquiriesPage() {
  const inquiries = useQuery(api.owner.listInquiries);
  const updateStatus = useMutation(api.owner.updateInquiryStatus);
  const [filter, setFilter] = useState<string>("all");

  if (inquiries === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground">Loading inquiries…</div>
      </div>
    );
  }

  const filtered = filter === "all" ? inquiries : inquiries.filter((i: any) => i.status === filter);
  const counts = {
    all: inquiries.length,
    new: inquiries.filter((i: any) => i.status === "new").length,
    responded: inquiries.filter((i: any) => i.status === "responded").length,
    closed: inquiries.filter((i: any) => i.status === "closed").length,
  };

  const handleStatusChange = async (id: Id<"inquiries">, status: "new" | "responded" | "closed") => {
    try {
      await updateStatus({ inquiryId: id, status });
      toast.success(`Inquiry marked as ${status}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inquiries</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Buyer inquiries about your properties
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        {(["all", "new", "responded", "closed"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === tab
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span className="ml-1.5 text-xs text-muted-foreground">
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Inquiries list */}
      {filtered.length === 0 ? (
        <div className="bg-background rounded-xl border p-8 text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Inquiries</h2>
          <p className="text-sm text-muted-foreground">
            {filter === "all"
              ? "No inquiries have been submitted for your properties yet."
              : `No ${filter} inquiries.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inq: any) => (
            <div key={inq._id} className="bg-background rounded-xl border p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{inq.name ?? "Unknown"}</span>
                    <InquiryStatusBadge status={inq.status} />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {inq.propertyAddress}
                    {inq.weekNumber && ` — Week ${inq.weekNumber}`}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {inq._creationTime
                    ? new Date(inq._creationTime).toLocaleDateString()
                    : "—"}
                </div>
              </div>

              {/* Contact info */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-2">
                {inq.email && <span>{inq.email}</span>}
                {inq.phone && <span>{inq.phone}</span>}
              </div>

              {/* Message */}
              {inq.message && (
                <div className="text-sm bg-muted/30 rounded-lg px-3 py-2 mb-3">
                  {inq.message}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                {inq.status === "new" && (
                  <button
                    onClick={() => handleStatusChange(inq._id, "responded")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition-colors"
                  >
                    <Check className="w-3 h-3" />
                    Mark Responded
                  </button>
                )}
                {inq.status === "responded" && (
                  <button
                    onClick={() => handleStatusChange(inq._id, "closed")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                  >
                    <Archive className="w-3 h-3" />
                    Close
                  </button>
                )}
                {inq.status === "closed" && (
                  <button
                    onClick={() => handleStatusChange(inq._id, "new")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reopen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InquiryStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    responded: "bg-green-100 text-green-700",
    closed: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[status] ?? styles.new}`}>
      {status}
    </span>
  );
}
