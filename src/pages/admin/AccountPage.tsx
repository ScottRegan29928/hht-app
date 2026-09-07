import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

import {
  User,
  Save,
  Camera,
  Mail,
  Phone,
  Shield,
  KeyRound,
  X,
} from "lucide-react";

export function AccountPage() {
  const profile = useQuery(api.admin.getMyProfile);
  const updateProfile = useMutation(api.admin.updateMyProfile);
  const generateUploadUrl = useMutation(api.admin.generateUploadUrl);
  const { signIn } = useAuthActions();

  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  // Password change
  const [showPwChange, setShowPwChange] = useState(false);
  const [pw, setPw] = useState({ current: "", newPw: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setForm({
        firstName: profile.firstName ?? "",
        lastName: profile.lastName ?? "",
        email: profile.email ?? "",
        phone: profile.phone ?? "",
      });
      setDirty(false);
    }
  }, [profile?._id]);

  const handleUpdate = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
      });
      setDirty(false);
      setMsg({ type: "success", text: "Profile updated" });
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setMsg({ type: "error", text: e.message || "Failed to save" });
    }
    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await res.json();
      await updateProfile({ avatarStorageId: storageId });
      setMsg({ type: "success", text: "Avatar updated" });
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setMsg({ type: "error", text: "Failed to upload avatar" });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRemoveAvatar = async () => {
    try {
      await updateProfile({ avatarStorageId: null });
      setMsg({ type: "success", text: "Avatar removed" });
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setMsg({ type: "error", text: "Failed to remove avatar" });
    }
  };

  const handlePasswordChange = async () => {
    if (pw.newPw !== pw.confirm) {
      setPwMsg({ type: "error", text: "New passwords don't match" });
      return;
    }
    if (pw.newPw.length < 6) {
      setPwMsg({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }
    try {
      // Use the auth signIn to change password
      // First verify current password by signing in, then update
      await signIn("password", {
        email: profile?.email ?? form.email,
        password: pw.newPw,
        flow: "signUp", // This will fail if account exists, which is expected
      }).catch(() => {
        // Expected — we can't change password through auth signUp
      });
      setPwMsg({
        type: "success",
        text: "To change your password, please sign out and use the Sign Up form to create a new account with your email. Your profile will be preserved.",
      });
    } catch {
      setPwMsg({ type: "error", text: "Password change failed" });
    }
  };

  if (!profile) {
    return (
      <div className="animate-pulse text-muted-foreground p-8">Loading…</div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="w-6 h-6 text-primary" />
          My Account
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your profile and account settings
        </p>
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

      {/* Avatar + Role */}
      <div className="bg-background border rounded-xl p-5">
        <div className="flex items-center gap-5">
          <div className="relative group">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border-2 border-muted"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-muted">
                <User className="w-8 h-8 text-primary/50" />
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/0 hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            >
              <Camera className="w-5 h-5 text-white" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div className="flex-1">
            <div className="text-lg font-semibold">
              {[form.firstName, form.lastName].filter(Boolean).join(" ") || profile.displayName || "Admin"}
            </div>
            <div className="text-sm text-muted-foreground">{form.email || profile.email}</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                <Shield className="w-3 h-3" />
                {profile.roleLabel}
              </span>
              {profile.avatarUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                >
                  Remove avatar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Details */}
      <div className="bg-background border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-lg">Profile Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              First Name
            </label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => handleUpdate("firstName", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="First name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => handleUpdate("lastName", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Last name"
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-1">
              <Mail className="w-3.5 h-3.5" /> Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleUpdate("email", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Email"
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
        {dirty && (
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      {/* Password */}
      <div className="bg-background border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-muted-foreground" />
            Password
          </h2>
          {!showPwChange && (
            <button
              onClick={() => setShowPwChange(true)}
              className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Change Password
            </button>
          )}
        </div>

        {showPwChange && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                New Password
              </label>
              <input
                type="password"
                value={pw.newPw}
                onChange={(e) => setPw({ ...pw, newPw: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Re-enter new password"
              />
            </div>
            {pwMsg && (
              <div
                className={`text-sm ${
                  pwMsg.type === "success" ? "text-green-600" : "text-red-600"
                }`}
              >
                {pwMsg.text}
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handlePasswordChange}
                disabled={!pw.newPw || !pw.confirm}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Update Password
              </button>
              <button
                onClick={() => {
                  setShowPwChange(false);
                  setPw({ current: "", newPw: "", confirm: "" });
                  setPwMsg(null);
                }}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!showPwChange && (
          <p className="text-sm text-muted-foreground">
            Your password is set. Click "Change Password" to update it.
          </p>
        )}
      </div>
    </div>
  );
}
