import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link } from "react-router-dom";
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  Home,
  ChevronRight,
  LinkIcon,
  Unlink,
  X,
  Send,
  KeyRound,
} from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function OwnersPage() {
  const owners = useQuery(api.admin.listOwners);
  const createOwner = useMutation(api.admin.createOwner);
  const deleteOwner = useMutation(api.admin.deleteOwner);
  const resetPassword = useMutation(api.admin.resetOwnerPassword);
  const sendInvite = useAction(api.ownerInvites.sendInvite);
  const sendResetEmail = useAction(api.email.sendPasswordResetEmail);
  const [actionMsg, setActionMsg] = useState<{ id: string; type: "success" | "error"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);

  // Form state
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

  const filteredOwners = owners?.filter((o) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      o.fullName.toLowerCase().includes(term) ||
      (o.email ?? "").toLowerCase().includes(term) ||
      (o.phone ?? "").toLowerCase().includes(term)
    );
  });

  const handleCreate = async () => {
    if (!form.firstName || !form.lastName || !form.email) return;
    setFormError(null);
    setSaving(true);
    try {
      await createOwner({
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
      setForm({ firstName: "", lastName: "", email: "", phone: "", homeAddress: "", homeCity: "", homeState: "", homeCountry: "", homePostalCode: "" });
      setShowForm(false);
    } catch (e: any) {
      setFormError(e.message?.includes("email already exists")
        ? "An owner or admin with this email already exists. Please use a different email."
        : (e.message || "Failed to create owner"));
    }
    setSaving(false);
  };

  const handleSendInvite = async (owner: any) => {
    const email = owner.email;
    if (!email) return;
    try {
      setActionMsg({ id: owner._id, type: "success", text: "Sending…" });
      const res = await sendInvite({ profileId: owner._id });
      setActionMsg({
        id: owner._id,
        type: "success",
        text: `Invitation sent to ${res.email}`,
      });
      setTimeout(() => setActionMsg(null), 5000);
    } catch (e: any) {
      setActionMsg({ id: owner._id, type: "error", text: e.message || "Failed to send" });
      setTimeout(() => setActionMsg(null), 7000);
    }
  };

  const handleResetPassword = async (owner: any) => {
    try {
      setActionMsg({ id: owner._id, type: "success", text: "Resetting…" });
      const result = await resetPassword({ ownerId: owner._id as Id<"userProfiles"> });
      try {
        await sendResetEmail({ to: result.email, firstName: owner.firstName || undefined });
        setActionMsg({ id: owner._id, type: "success", text: `Password reset & email sent to ${result.email}` });
      } catch {
        setActionMsg({ id: owner._id, type: "success", text: `Password reset. Email failed — tell ${result.email} to re-register.` });
      }
      setTimeout(() => setActionMsg(null), 5000);
    } catch (e: any) {
      setActionMsg({ id: owner._id, type: "error", text: e.message || "Failed to reset" });
      setTimeout(() => setActionMsg(null), 5000);
    }
  };

  const handleDelete = async (id: Id<"userProfiles">) => {
    try {
      await deleteOwner({ ownerId: id });
      setDeleteConfirm(null);
    } catch (e: any) {
      alert(e.message || "Failed to delete owner");
    }
  };

  if (!owners) {
    return (
      <div className="animate-pulse text-muted-foreground p-8">Loading owners…</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Owners
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {owners.length} owner{owners.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "Add Owner"}
        </button>
      </div>

      {/* Add Owner Form */}
      {showForm && (
        <div className="bg-background border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-lg">New Owner</h2>
          {formError && (
            <div className="px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                First Name *
              </label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Last Name *
              </label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Email *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Home Address
              </label>
              <input
                type="text"
                value={form.homeAddress}
                onChange={(e) => setForm({ ...form, homeAddress: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="123 Main St"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                City
              </label>
              <input
                type="text"
                value={form.homeCity}
                onChange={(e) => setForm({ ...form, homeCity: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="City"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                State / Province
              </label>
              <input
                type="text"
                value={form.homeState}
                onChange={(e) => setForm({ ...form, homeState: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="State"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Country
              </label>
              <input
                type="text"
                value={form.homeCountry}
                onChange={(e) => setForm({ ...form, homeCountry: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="United States"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Postal Code
              </label>
              <input
                type="text"
                value={form.homePostalCode}
                onChange={(e) => setForm({ ...form, homePostalCode: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="12345"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !form.firstName || !form.lastName || !form.email}
              className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Creating…" : "Create Owner"}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search owners by name, email, or phone…"
          className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Owners List */}
      {filteredOwners && filteredOwners.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search ? "No owners match your search" : "No owners added yet. Click \"Add Owner\" to get started."}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOwners?.map((owner) => (
            <div
              key={owner._id}
              className="bg-background border rounded-xl p-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/management/owners/${owner._id}`}
                      className="text-base font-semibold hover:text-primary transition-colors"
                    >
                      {owner.fullName}
                    </Link>
                    {owner.isLinked ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700">
                        <LinkIcon className="w-3 h-3" /> Registered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700">
                        <Unlink className="w-3 h-3" /> Pending
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                    {owner.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {owner.email}
                      </span>
                    )}
                    {owner.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {owner.phone}
                      </span>
                    )}
                    {owner.homeAddress && (
                      <span className="flex items-center gap-1">
                        <Home className="w-3.5 h-3.5" />
                        {owner.homeAddress}
                      </span>
                    )}
                  </div>

                  {/* Assigned Properties */}
                  {owner.properties.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {owner.properties.map((p) => (
                        <Link
                          key={p._id}
                          to={`/management/properties/${p._id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-muted/50 hover:bg-muted transition-colors"
                        >
                          {p.address}
                        </Link>
                      ))}
                    </div>
                  )}
                  {owner.propertyCount === 0 && (
                    <p className="mt-2 text-xs text-muted-foreground/60 italic">
                      No properties assigned
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSendInvite(owner); }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg hover:bg-muted/50 transition-colors"
                      title="Send portal invitation"
                    >
                      <Send className="w-3.5 h-3.5 text-blue-500" />
                      <span className="hidden sm:inline">Invite</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleResetPassword(owner); }}
                      disabled={!owner.isLinked}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title={!owner.isLinked ? "Owner hasn't registered yet" : "Reset password"}
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                      <span className="hidden sm:inline">Reset</span>
                    </button>
                    <Link
                      to={`/management/owners/${owner._id}`}
                      className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                  {actionMsg?.id === owner._id && (
                    <span className={`text-[11px] font-medium ${actionMsg.type === "success" ? "text-green-600" : "text-red-600"}`}>
                      {actionMsg.text}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
