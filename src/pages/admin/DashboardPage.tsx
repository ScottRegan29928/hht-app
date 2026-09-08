import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link } from "react-router-dom";
import {
  Home,
  Building2,
  Calendar,
  MessageSquare,
  Star,
  CheckCircle,
  Clock,
  TrendingUp,
  DollarSign,
} from "lucide-react";

export function AdminDashboardPage() {
  const stats = useQuery(api.admin.dashboardStats);

  if (stats === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-background border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    {
      label: "Active Properties",
      value: stats.activeProperties,
      sub: `${stats.totalProperties} total`,
      icon: Home,
      color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30",
      link: "/management/properties",
    },
    {
      label: "Communities",
      value: stats.totalCommunities,
      sub: "Sea Pines",
      icon: Building2,
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
      link: "/management/communities",
    },
    {
      label: "Available Rental Weeks",
      value: stats.availableRentalWeeks,
      sub: `${stats.totalWeeks} total weeks`,
      icon: Calendar,
      color: "text-amber-500 bg-amber-50 dark:bg-amber-950/30",
      link: "/management/weeks",
    },
    {
      label: "Weeks for Sale",
      value: stats.availableSaleWeeks,
      sub: `${stats.availableWeeks} total available`,
      icon: DollarSign,
      color: "text-teal-500 bg-teal-50 dark:bg-teal-950/30",
      link: "/management/weeks",
    },
    {
      label: "New Inquiries",
      value: stats.newInquiries,
      sub: `${stats.totalInquiries} total`,
      icon: MessageSquare,
      color: "text-purple-500 bg-purple-50 dark:bg-purple-950/30",
      link: "/management/inquiries",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your property listings
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            to={card.link}
            className="bg-background rounded-xl border p-5 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="text-3xl font-bold mt-1">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
              </div>
              <div className={`p-2.5 rounded-lg ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions + Recent inquiries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick actions */}
        <div className="bg-background rounded-xl border p-6">
          <h2 className="font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link
              to="/management/properties?new=1"
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors"
            >
              <Home className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Add New Property</span>
            </Link>
            <Link
              to="/management/inquiries"
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Review Inquiries</span>
            </Link>
            <Link
              to="/management/properties"
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors"
            >
              <Star className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Manage Featured Listings</span>
            </Link>
          </div>
        </div>

        {/* Recent inquiries */}
        <div className="bg-background rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Inquiries</h2>
            <Link
              to="/management/inquiries"
              className="text-xs text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {stats.recentInquiries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No inquiries yet
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recentInquiries.map((inq: any) => (
                <div
                  key={inq._id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      inq.status === "new"
                        ? "bg-blue-500"
                        : inq.status === "contacted"
                        ? "bg-amber-500"
                        : "bg-green-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{inq.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {inq.type === "purchase" ? "Purchase" : inq.type === "general" ? "Contact" : "Rental"} ·{" "}
                      {new Date(inq.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                      inq.status === "new"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        : inq.status === "contacted"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                    }`}
                  >
                    {inq.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
