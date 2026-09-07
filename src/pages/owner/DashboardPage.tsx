import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link } from "react-router-dom";
import {
  Calendar,
  MessageSquare,
  Clock,
  ArrowRight,
  Tag,
  Home,
} from "lucide-react";

export function OwnerDashboardPage() {
  const stats = useQuery(api.owner.dashboardStats);
  const requests = useQuery(api.owner.listSaleRequests);

  if (stats === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground">
          Loading dashboard…
        </div>
      </div>
    );
  }

  const recentRequests = requests?.slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your property overview at a glance
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Calendar}
          label="Owned Weeks"
          value={stats.ownedWeeks}
          color="bg-blue-500"
        />
        <StatCard
          icon={Tag}
          label="Listed for Sale"
          value={stats.listedForSale}
          color="bg-purple-500"
        />
        <StatCard
          icon={Clock}
          label="Pending Requests"
          value={stats.pendingRequests}
          color="bg-amber-500"
        />
        <StatCard
          icon={MessageSquare}
          label="New Inquiries"
          value={stats.newInquiryCount}
          sublabel={`${stats.inquiryCount} total`}
          color="bg-green-500"
        />
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          to="/owner/properties"
          className="bg-background rounded-xl border p-5 hover:border-primary/30 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">My Weeks</h3>
              <p className="text-sm text-muted-foreground">
                View your weeks and list them for sale
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>
        <Link
          to="/owner/inquiries"
          className="bg-background rounded-xl border p-5 hover:border-primary/30 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">Inquiries</h3>
              <p className="text-sm text-muted-foreground">
                {stats.newInquiryCount > 0
                  ? `${stats.newInquiryCount} new inquiry${stats.newInquiryCount > 1 ? "ies" : ""} to review`
                  : "View and respond to buyer inquiries"}
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>
      </div>

      {/* Recent sale requests */}
      {recentRequests.length > 0 && (
        <div className="bg-background rounded-xl border">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold">Recent Sale Requests</h2>
          </div>
          <div className="divide-y">
            {recentRequests.map((r: any) => (
              <div
                key={r._id}
                className="px-5 py-3 flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-medium">
                    {r.propertyAddress}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {" "}
                    — Week {r.weekNumber}
                  </span>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Asking ${r.askingPrice.toLocaleString()}
                  </div>
                </div>
                <RequestStatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  sublabel?: string;
  color: string;
}) {
  return (
    <div className="bg-background rounded-xl border p-4">
      <div
        className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-3`}
      >
        <Icon className="w-4.5 h-4.5 text-white" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
      {sublabel && (
        <div className="text-xs text-muted-foreground">{sublabel}</div>
      )}
    </div>
  );
}

function RequestStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-500",
  };
  const labels: Record<string, string> = {
    pending: "Pending",
    approved: "Live",
    rejected: "Rejected",
    cancelled: "Withdrawn",
  };
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[status] ?? styles.pending}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
