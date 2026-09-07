import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Shield,
  Plus,
  Search,
  Mail,
  Phone,
  X,
  Trash2,
  Crown,
  User as UserIcon,
} from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function UsersPage() {
  const currentUser = useQuery(api.admin.currentUser);
  const users = useQuery(api.admin.listAdminUsers);
  const createUser = useMutation(api.admin.createAdminUser);
  const updateUser = useMutation(api.admin.updateAdminUser);
  const deleteUser = useMutation(api.admin.deleteAdminUser);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    isSuperUser: false,
  });

  const isSuperUser = currentUser?.isSuperUser ?? false;

  const filteredUsers = users?.filter((u) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(term) ||
      (u.email ?? "").toLowerCase().includes(term)
    );
  });

  const handleCreate = async () => {
    if (!form.firstName || !form.lastName || !form.email) return;
    setSaving(true);
    try {
      await createUser({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        isSuperUser: form.isSuperUser,
      });
      setForm({ firstName: "", lastName: "", email: "", phone: "", isSuperUser: false });
      setShowForm(false);
      setMsg({ type: "success", text: "User created. They can sign up at the management portal login." });
      setTimeout(() => setMsg(null), 5000);
    } catch (e: any) {
      setMsg({ type: "error", text: e.message || "Failed to create user" });
    }
    setSaving(false);
  };

  const handleToggleRole = async (profileId: Id<"userProfiles">, currentlySuper: boolean) => {
    try {
      await updateUser({ profileId, isSuperUser: !currentlySuper });
      setMsg({ type: "success", text: `Role updated to ${!currentlySuper ? "Super User" : "User"}` });
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setMsg({ type: "error", text: e.message || "Failed to update role" });
    }
  };

  const handleDelete = async (profileId: Id<"userProfiles">) => {
    try {
      await deleteUser({ profileId });
      setDeleteConfirm(null);
      setMsg({ type: "success", text: "User removed" });
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setMsg({ type: "error", text: e.message || "Failed to delete user" });
    }
  };

  if (!isSuperUser) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-1">Super User Access Required</h2>
          <p className="text-sm text-muted-foreground">
            Only Super Users can manage admin accounts.
          </p>
        </div>
      </div>
    );
  }

  if (!users) {
    return <div className="animate-pulse text-muted-foreground p-8">Loading users…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Admin Users
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} admin{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "Add Admin"}
        </button>
      </div>

      {msg && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            msg.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Add User Form */}
      {showForm && (
        <div className="bg-background border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-lg">New Admin User</h2>
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
                placeholder="First name"
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
                placeholder="Last name"
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
                placeholder="admin@example.com"
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
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isSuperUser}
                onChange={(e) => setForm({ ...form, isSuperUser: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/30"
              />
              <div>
                <span className="text-sm font-medium">Super User</span>
                <p className="text-xs text-muted-foreground">
                  Can manage other admin accounts. Leave unchecked for regular User access.
                </p>
              </div>
            </label>
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
              {saving ? "Creating…" : "Create Admin"}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      {users.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search admins…"
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      )}

      {/* Users List */}
      <div className="space-y-3">
        {filteredUsers?.map((user) => {
          const isMe = user._id === currentUser?.profile?._id;
          return (
            <div
              key={user._id}
              className="bg-background border rounded-xl p-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">
                      {user.displayName}
                      {isMe && (
                        <span className="text-xs text-muted-foreground font-normal ml-1">(you)</span>
                      )}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        user.isSuperUser
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {user.isSuperUser ? (
                        <>
                          <Crown className="w-3 h-3" /> Super User
                        </>
                      ) : (
                        <>
                          <UserIcon className="w-3 h-3" /> User
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {user.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {user.email}
                      </span>
                    )}
                    {user.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {user.phone}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {deleteConfirm === user._id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(user._id)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1.5 text-xs text-muted-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      {!isMe && (
                        <button
                          onClick={() => handleToggleRole(user._id, user.isSuperUser)}
                          className="px-3 py-1.5 text-xs font-medium border rounded-lg hover:bg-muted/50 transition-colors"
                          title={user.isSuperUser ? "Demote to User" : "Promote to Super User"}
                        >
                          {user.isSuperUser ? "Make User" : "Make Super"}
                        </button>
                      )}
                      {!isMe && (
                        <button
                          onClick={() => setDeleteConfirm(user._id)}
                          className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
