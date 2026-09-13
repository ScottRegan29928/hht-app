import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { Tag, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";

/**
 * Owner "Sell My Week" requests.
 *
 * The owner-side submission and the approve/reject mutation both existed, but
 * nothing in the admin portal ever listed the requests — a submitted request
 * sat in the database unseen [scott, 2026-09-13]. This is the missing half.
 */

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-200 text-slate-700",
};

const money = (cents: number) =>
  cents > 0 ? `$${cents.toLocaleString()}` : "Contact for price";

export function AdminSaleRequestsPage() {
  const requests = useQuery(api.admin.listSaleRequests);
  const review = useMutation(api.admin.reviewSaleRequest);
  const [filter, setFilter] = useState<
    "all" | "pending" | "approved" | "rejected" | "cancelled"
  >("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  if (requests === undefined) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Sale Requests</h1>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 bg-background border rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const pendingCount = requests.filter(
    (r: any) => r.status === "pending",
  ).length;
  const filtered =
    filter === "all"
      ? requests
      : requests.filter((r: any) => r.status === filter);

  const act = async (id: any, action: "approved" | "rejected") => {
    setBusy(String(id));
    try {
      await review({
        requestId: id,
        action,
        adminNotes: notes[String(id)]?.trim() || undefined,
      });
      toast.success(
        action === "approved" ? "Request approved" : "Request rejected",
      );
      setNotes((n) => ({ ...n, [String(id)]: "" }));
    } catch (err: any) {
      toast.error(err.message || "Could not update the request");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sale Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Owners asking to list a week they hold.{" "}
          {pendingCount > 0
            ? `${pendingCount} awaiting review.`
            : "Nothing awaiting review."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "cancelled", "all"] as const).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-full text-sm border capitalize ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted/50"
              }`}
            >
              {f}
              {f === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
          ),
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-xl px-5 py-10 text-center">
          No {filter === "all" ? "" : filter} requests.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r: any) => (
            <li key={r._id} className="border rounded-xl p-5 bg-background">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold">{r.propertyAddress}</span>
                    <span className="text-muted-foreground">
                      · Week {r.weekNumber}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {r.ownerName} · asking {money(r.askingPrice)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      STATUS_STYLE[r.status] ?? "bg-slate-200"
                    }`}
                  >
                    {r.status}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {r.notes && (
                <p className="text-sm mt-3 bg-muted/40 rounded-lg px-3 py-2">
                  {r.notes}
                </p>
              )}

              {r.adminNotes && (
                <p className="text-sm mt-2 text-muted-foreground">
                  <strong>Your note:</strong> {r.adminNotes}
                </p>
              )}

              {r.status === "pending" && (
                <div className="mt-4 space-y-2">
                  <input
                    value={notes[String(r._id)] ?? ""}
                    onChange={(e) =>
                      setNotes((n) => ({
                        ...n,
                        [String(r._id)]: e.target.value,
                      }))
                    }
                    placeholder="Note to the owner (optional)"
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={busy === String(r._id)}
                      onClick={() => act(r._id, "approved")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-60"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button
                      disabled={busy === String(r._id)}
                      onClick={() => act(r._id, "rejected")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium disabled:opacity-60"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
