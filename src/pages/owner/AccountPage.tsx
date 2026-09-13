import { useEffect, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSiteFlags } from "@/lib/siteContext";
import { RESORT_THEMES, DEFAULT_THEME } from "@/components/owner/portalTheme";
import { toast } from "sonner";
import { User, Mail, KeyRound, Loader2, Camera, Trash2 } from "lucide-react";

/**
 * Owner account self-service: contact details, sign-in email and password
 * [scott, 2026-09-13].
 *
 * Email and password sit in their own cards, apart from the contact details,
 * because both are credentials — sign-in is always email + password — and both
 * require the current password to change. Mixing them into one "save" button
 * would mean asking for a password to update a phone number.
 */

const INPUT =
  "w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

export function OwnerAccountPage() {
  const { siteSlug } = useSiteFlags();
  const theme = RESORT_THEMES[siteSlug] ?? DEFAULT_THEME;

  const account = useQuery(api.ownerAccount.getAccount);
  const updateContact = useMutation(api.ownerAccount.updateContact);
  const changeEmail = useAction(api.ownerAccount.changeEmail);
  const changePassword = useAction(api.ownerAccount.changePassword);
  const generateAvatarUploadUrl = useMutation(
    api.ownerAccount.generateAvatarUploadUrl,
  );
  const setAvatar = useMutation(api.ownerAccount.setAvatar);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    homeAddress: "",
    homeCity: "",
    homeState: "",
    homePostalCode: "",
    homeCountry: "",
  });
  const [savingContact, setSavingContact] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Seed the form once the record arrives; never overwrite what the owner is
  // part-way through typing.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!account || seeded) return;
    setForm({
      firstName: account.firstName ?? "",
      lastName: account.lastName ?? "",
      phone: account.phone ?? "",
      homeAddress: account.homeAddress ?? "",
      homeCity: account.homeCity ?? "",
      homeState: account.homeState ?? "",
      homePostalCode: account.homePostalCode ?? "",
      homeCountry: account.homeCountry ?? "",
    });
    setSeeded(true);
  }, [account, seeded]);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(
        "That image is larger than 5MB. Please choose a smaller one.",
      );
      return;
    }
    setUploading(true);
    try {
      const url = await generateAvatarUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed.");
      const { storageId } = await res.json();
      await setAvatar({ storageId });
      toast.success("Photo updated");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not upload that photo.");
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    try {
      await setAvatar({ storageId: null });
      toast.success("Photo removed");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not remove the photo.");
    }
  };

  const saveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingContact(true);
    try {
      await updateContact(form);
      toast.success("Contact details updated");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save your details.");
    } finally {
      setSavingContact(false);
    }
  };

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEmail(true);
    try {
      await changeEmail({ newEmail, currentPassword: emailPassword });
      toast.success("Email updated — use it next time you sign in");
      setNewEmail("");
      setEmailPassword("");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not change your email.");
    } finally {
      setSavingEmail(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("The two new passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not change your password.");
    } finally {
      setSavingPassword(false);
    }
  };

  if (account === undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 p-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your account…
      </div>
    );
  }

  const card = "bg-white rounded-xl border border-slate-200 shadow-sm";
  const header =
    "px-5 py-3.5 border-b border-slate-100 flex items-center gap-2";
  const button =
    "px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60";

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: theme.inkDeep }}>
          My Account
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Update your contact details and sign-in credentials.
        </p>
      </div>

      {/* Contact details */}
      <form onSubmit={saveContact} className={card}>
        <div className={header}>
          <User className="w-4 h-4" style={{ color: theme.accent }} />
          <h2 className="text-sm font-bold" style={{ color: theme.inkDeep }}>
            Contact details
          </h2>
        </div>
        <div className="px-5 pt-5 flex items-center gap-4">
          {account?.avatarUrl ? (
            <img
              src={account.avatarUrl}
              alt="Your photo"
              className="w-16 h-16 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <span
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white"
              style={{ background: theme.ink }}
            >
              {(form.firstName || account?.email || "O")
                .trim()
                .charAt(0)
                .toUpperCase()}
            </span>
          )}
          <div className="flex items-center gap-2">
            <label
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer hover:bg-slate-50"
              style={{ color: theme.inkDeep }}
            >
              <Camera className="w-3.5 h-3.5" />
              {uploading
                ? "Uploading…"
                : account?.avatarUrl
                  ? "Change photo"
                  : "Upload photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  // Reset the input so choosing the same file twice still fires.
                  e.target.value = "";
                  if (f) void uploadAvatar(f);
                }}
              />
            </label>
            {account?.avatarUrl && (
              <button
                type="button"
                onClick={removeAvatar}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First name">
            <input
              className={INPUT}
              value={form.firstName}
              onChange={(e) => set("firstName")(e.target.value)}
              required
            />
          </Field>
          <Field label="Last name">
            <input
              className={INPUT}
              value={form.lastName}
              onChange={(e) => set("lastName")(e.target.value)}
              required
            />
          </Field>
          <Field label="Phone">
            <input
              className={INPUT}
              value={form.phone}
              onChange={(e) => set("phone")(e.target.value)}
            />
          </Field>
          <Field label="Country">
            <input
              className={INPUT}
              value={form.homeCountry}
              onChange={(e) => set("homeCountry")(e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Mailing address">
              <input
                className={INPUT}
                value={form.homeAddress}
                onChange={(e) => set("homeAddress")(e.target.value)}
              />
            </Field>
          </div>
          <Field label="City">
            <input
              className={INPUT}
              value={form.homeCity}
              onChange={(e) => set("homeCity")(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="State">
              <input
                className={INPUT}
                value={form.homeState}
                onChange={(e) => set("homeState")(e.target.value)}
              />
            </Field>
            <Field label="ZIP">
              <input
                className={INPUT}
                value={form.homePostalCode}
                onChange={(e) => set("homePostalCode")(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <div className="px-5 py-3.5 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={savingContact}
            className={button}
            style={{ background: theme.ink }}
          >
            {savingContact ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      {/* Sign-in email */}
      <form onSubmit={saveEmail} className={card}>
        <div className={header}>
          <Mail className="w-4 h-4" style={{ color: theme.accent }} />
          <h2 className="text-sm font-bold" style={{ color: theme.inkDeep }}>
            Sign-in email
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            You currently sign in as{" "}
            <span className="font-semibold text-slate-800">
              {account?.email ?? "—"}
            </span>
            . Changing this changes the address you log in with.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="New email address">
              <input
                type="email"
                className={INPUT}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Current password">
              <input
                type="password"
                className={INPUT}
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                required
              />
            </Field>
          </div>
        </div>
        <div className="px-5 py-3.5 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={savingEmail}
            className={button}
            style={{ background: theme.ink }}
          >
            {savingEmail ? "Updating…" : "Update email"}
          </button>
        </div>
      </form>

      {/* Password */}
      <form onSubmit={savePassword} className={card}>
        <div className={header}>
          <KeyRound className="w-4 h-4" style={{ color: theme.accent }} />
          <h2 className="text-sm font-bold" style={{ color: theme.inkDeep }}>
            Password
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Current password">
            <input
              type="password"
              className={INPUT}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="New password">
              <input
                type="password"
                className={INPUT}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </Field>
            <Field label="Confirm new password">
              <input
                type="password"
                className={INPUT}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </Field>
          </div>
          <p className="text-xs text-slate-500">At least 10 characters.</p>
        </div>
        <div className="px-5 py-3.5 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={savingPassword}
            className={button}
            style={{ background: theme.ink }}
          >
            {savingPassword ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </div>
  );
}
