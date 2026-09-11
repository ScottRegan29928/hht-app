import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  ArrowLeft,
  Save,
  Mail,
  Phone,
  Home,
  LinkIcon,
  Unlink,
  KeyRound,
  Trash2,
  Building2,
  Send,
  ChevronRight,
} from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function OwnerDetailPage() {
  const { ownerId } = useParams();
  const navigate = useNavigate();
  const owner = useQuery(
    api.admin.getOwner,
    ownerId ? { ownerId: ownerId as Id<"userProfiles"> } : "skip"
  );
  const updateOwner = useMutation(api.admin.updateOwner);
  const deleteOwner = useMutation(api.admin.deleteOwner);
  const resetPassword = useMutation(api.admin.resetOwnerPassword);
  const sendInvite = useAction(api.ownerInvites.sendInvite);
  const sendResetEmail = useAction(api.email.sendPasswordResetEmail);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    homeAddress: "",
    homeCity: "",
    homeState: "",
    homeCountry: "",
    homePostalCode: "",
  });
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Populate form when owner loads
  useEffect(() => {
    if (owner) {
      setForm({
        firstName: owner.firstName ?? "",
        lastName: owner.lastName ?? "",
        email: owner.email ?? "",
        phone: owner.phone ?? "",
        homeAddress: owner.homeAddress ?? "",
        homeCity: owner.homeCity ?? "",
        homeState: owner.homeState ?? "",
        homeCountry: owner.homeCountry ?? "",
        homePostalCode: owner.homePostalCode ?? "",
      });
      setDirty(false);
    }
  }, [owner?._id]);

  const handleUpdate = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!ownerId || !form.firstName || !form.lastName || !form.email) return;
    setSaving(true);
    try {
      await updateOwner({
        ownerId: ownerId as Id<"userProfiles">,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        homeAddress: form.homeAddress || undefined,
        homeCity: form.homeCity || undefined,
        homeState: form.homeState || undefined,
        homeCountry: form.homeCountry || undefined,
        homePostalCode: form.homePostalCode || undefined,
      });
      setDirty(false);
      setActionMsg({ type: "success", text: "Owner updated" });
      setTimeout(() => setActionMsg(null), 3000);
    } catch (e: any) {
      setActionMsg({ type: "error", text: e.message || "Failed to update" });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!ownerId) return;
    try {
      await deleteOwner({ ownerId: ownerId as Id<"userProfiles"> });
      navigate("/management/owners");
    } catch (e: any) {
      alert(e.message || "Failed to delete");
    }
  };

  const handleResetPassword = async () => {
    if (!ownerId) return;
    try {
      const result = await resetPassword({ ownerId: ownerId as Id<"userProfiles"> });
      // Also send reset email
      try {
        await sendResetEmail({ to: result.email, firstName: owner?.firstName || undefined });
        setActionMsg({
          type: "success",
          text: `Password reset and email sent to ${result.email}.`,
        });
      } catch {
        setActionMsg({
          type: "success",
          text: `Password reset. Email notification failed — tell ${result.email} to re-register.`,
        });
      }
    } catch (e: any) {
      setActionMsg({ type: "error", text: e.message || "Failed to reset" });
    }
  };

  // Replaces the old "welcome letter", which pointed at a dead staging host and
  // told owners to click a Sign Up button that does not exist. This sends a
  // one-time activation link instead.
  const handleSendInvite = async () => {
    const email = owner?.email;
    if (!email) return;
    try {
      setActionMsg({ type: "success", text: "Sending invitation…" });
      const res = await sendInvite({ profileId: ownerId as Id<"userProfiles"> });
      setActionMsg({
        type: "success",
        text: `Invitation sent to ${res.email} for the ${res.siteSlug} portal`,
      });
      setTimeout(() => setActionMsg(null), 6000);
    } catch (e: any) {
      setActionMsg({ type: "error", text: e.message || "Failed to send invitation" });
      setTimeout(() => setActionMsg(null), 8000);
    }
  };

  if (!owner) {
    return (
      <div className="animate-pulse text-muted-foreground p-8">Loading owner…</div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/management/owners")}
          className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{owner.fullName}</h1>
          <div className="flex items-center gap-2 mt-1">
            {owner.isLinked ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700">
                <LinkIcon className="w-3 h-3" /> Registered
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700">
                <Unlink className="w-3 h-3" /> Pending Registration
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Created {new Date(owner.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Action message */}
      {actionMsg && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            actionMsg.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {actionMsg.text}
        </div>
      )}

      {/* Owner Details Form */}
      <div className="bg-background border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-lg">Owner Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              First Name *
            </label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => handleUpdate("firstName", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Last Name *
            </label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => handleUpdate("lastName", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-1">
              <Mail className="w-3.5 h-3.5" /> Email *
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleUpdate("email", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-1">
              <Phone className="w-3.5 h-3.5" /> Phone
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => handleUpdate("phone", formatPhone(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="(555) 123-4567"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-1">
              <Home className="w-3.5 h-3.5" /> Home Address
            </label>
            <input
              type="text"
              value={form.homeAddress}
              onChange={(e) => handleUpdate("homeAddress", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="123 Main St"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">City</label>
            <input
              type="text"
              value={form.homeCity}
              onChange={(e) => handleUpdate("homeCity", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="City"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">State / Province</label>
            <input
              type="text"
              value={form.homeState}
              onChange={(e) => handleUpdate("homeState", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="State"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Country</label>
            <input
              type="text"
              value={form.homeCountry}
              onChange={(e) => handleUpdate("homeCountry", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="United States"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Postal Code</label>
            <input
              type="text"
              value={form.homePostalCode}
              onChange={(e) => handleUpdate("homePostalCode", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="12345"
            />
          </div>
        </div>
        {dirty && (
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.firstName || !form.lastName || !form.email}
              className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-background border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-lg">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSendInvite}
            disabled={owner.isLinked}
            title={
              owner.isLinked
                ? "This owner already has portal access"
                : "Emails a one-time link to choose a password"
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4 text-blue-500" />
            Send Portal Invitation
          </button>
          <button
            onClick={handleResetPassword}
            disabled={!owner.isLinked}
            className="inline-flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={!owner.isLinked ? "Owner hasn't registered yet" : ""}
          >
            <KeyRound className="w-4 h-4 text-amber-500" />
            Reset Password
          </button>
        </div>
        {!owner.isLinked && (
          <p className="text-xs text-muted-foreground">
            This owner has no portal access yet. Send a portal invitation and they can choose a password.
          </p>
        )}
      </div>

      {/* Assigned Properties */}
      <div className="bg-background border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Assigned Properties ({owner.properties.length})
          </h2>
        </div>
        {owner.properties.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No properties assigned yet. Assign this owner to a week on the Weeks page, or to a property on the property edit page.
          </p>
        ) : (
          <div className="space-y-2">
            {owner.properties.map((p) => (
              <Link
                key={p._id}
                to={`/management/properties/${p._id}`}
                className="flex items-center justify-between px-4 py-3 rounded-lg border hover:border-primary/30 hover:bg-muted/30 transition-colors"
              >
                <div>
                  <div className="font-medium text-sm">{p.address}</div>
                  <div className="text-xs text-muted-foreground">{p.communityName}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      p.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {p.isActive ? "Active" : "Inactive"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-background border border-red-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-lg text-red-600">Danger Zone</h2>
        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Owner
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-600">
              This will permanently delete this owner and unassign all their properties. This cannot be
              undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Yes, Delete Owner
              </button>
              <button
                onClick={() => setShowDelete(false)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
