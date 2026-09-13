import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { X } from "lucide-react";
import { toast } from "sonner";
import { resortTheme } from "@/components/owner/portalTheme";

/**
 * The board volunteer form, online.
 *
 * Replaces the printable PDF owners used to download, fill by hand and fax
 * [scott, 2026-09-13]. Field set is taken verbatim from the two resort PDFs
 * (Spicebush VOLUNTEER FORM 2026 / Swallowtail Volunteer Form) so a submission
 * carries everything the board previously received on paper — including the
 * commitment acknowledgement and the typed signature, which are the parts that
 * make the form a declaration rather than a survey.
 *
 * Submissions ride the existing inquiry pipeline (type "board_nomination"), so
 * they land in the admin portal and route like every other form.
 */

type Props = {
  open: boolean;
  onClose: () => void;
  siteSlug: string;
  resortName: string;
  /** Deadline and meeting copy differ per resort; passed in from the page. */
  deadline?: string;
};

export function BoardNominationDialog({
  open,
  onClose,
  siteSlug,
  resortName,
  deadline,
}: Props) {
  const theme = resortTheme(siteSlug);
  const me = useQuery(api.owner.currentUser);
  const ownedWeeks = useQuery(api.owner.listOwnedWeeks);
  const submit = useMutation(api.inquiries.submit);

  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    villaWeek: "",
    occupation: "",
    homePhone: "",
    officePhone: "",
    email: "",
    experience: "",
    benefit: "",
    issues: "",
    profile: "",
    signature: "",
  });
  const [committed, setCommitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const set = (k: keyof typeof form) => (e: any) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Prefill from the account rather than making the owner retype what we know.
  const displayName =
    [me?.firstName, me?.lastName].filter(Boolean).join(" ") ||
    me?.displayName ||
    "";
  const name = form.name || displayName;
  const email = form.email || me?.email || "";
  // Address and phone come from the owner's account [scott, 2026-09-13];
  // `??` is wrong here because the stored value may be an empty string.
  const address = form.address || me?.homeAddress || "";
  const city = form.city || me?.homeCity || "";
  const stateVal = form.state || me?.homeState || "";
  const zip = form.zip || me?.homePostalCode || "";
  const homePhone = form.homePhone || me?.phone || "";

  // The nomination form belongs to one association, so it must only offer the
  // weeks this owner holds in *this* resort. An owner with weeks in both
  // communities was shown all of them [scott, 2026-09-13].
  const communitySlug =
    siteSlug === "swallowtail" ? "swallowtail-at-sea-pines" : "spicebush";
  const villaOptions = (ownedWeeks ?? [])
    .filter((w: any) => w.communitySlug === communitySlug)
    .map((w: any) => `${w.propertyAddress} — Week ${w.weekNumber}`);

  const wordCount = form.profile.trim()
    ? form.profile.trim().split(/\s+/).length
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Please give your name and email");
      return;
    }
    if (!committed) {
      toast.error(
        "Please confirm you can attend at least two meetings per year",
      );
      return;
    }
    if (!form.signature.trim()) {
      toast.error("Please type your name as your signature");
      return;
    }

    // The paper form is one page of labelled answers; keep that shape so the
    // recipient reads something familiar rather than a JSON blob.
    const message = [
      ["Address", address],
      ["City", city],
      ["State", stateVal],
      ["ZIP", zip],
      ["Villa/Week", form.villaWeek],
      ["Occupation", form.occupation],
      ["Home phone", homePhone],
      ["Office phone", form.officePhone],
      ["Relevant experience", form.experience],
      ["How participation would benefit the Association", form.benefit],
      ["Issues or areas of interest", form.issues],
      ["Director profile summary", form.profile],
      ["Signed", form.signature],
      ["Commitment confirmed", "Yes — can attend at least two meetings a year"],
    ]
      .filter(([, v]) => String(v || "").trim())
      .map(([k, v]) => `${k}:\n${v}`)
      .join("\n\n");

    setSubmitting(true);
    try {
      await submit({
        type: "board_nomination",
        siteSlug,
        name: name.trim(),
        email: email.trim(),
        phone: homePhone.trim() || form.officePhone.trim() || undefined,
        message,
      });
      toast.success("Your volunteer form has been submitted. Thank you.");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Could not submit the form");
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    "w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2";
  const ring = { ["--tw-ring-color" as any]: theme.accent };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between gap-4 px-6 py-5 rounded-t-2xl text-white"
          style={{
            background: `linear-gradient(135deg, ${theme.inkDeep}, ${theme.ink})`,
          }}
        >
          <div>
            <h2 className="text-lg font-semibold">
              Volunteer to Serve on the Board
            </h2>
            <p className="text-sm text-white/80 mt-0.5">
              {resortName} Owners Association Board of Directors
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg hover:bg-white/15"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Board members meet at least twice a year with The Club Group and are
            reimbursed for travel, lodging and meals.
            {deadline ? ` To be considered, submit by ${deadline}.` : ""}
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <input
                value={name}
                onChange={set("name")}
                className={field}
                style={ring}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={set("email")}
                className={field}
                style={ring}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Street address
            </label>
            <input
              value={address}
              onChange={set("address")}
              className={field}
              style={ring}
            />
          </div>

          <div className="grid sm:grid-cols-[2fr_1fr_1fr] gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">City</label>
              <input
                value={city}
                onChange={set("city")}
                className={field}
                style={ring}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">State</label>
              <input
                value={stateVal}
                onChange={set("state")}
                className={field}
                style={ring}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">ZIP</label>
              <input
                value={zip}
                onChange={set("zip")}
                className={field}
                style={ring}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Villa / Week
              </label>
              {villaOptions.length > 0 ? (
                <select
                  value={form.villaWeek}
                  onChange={set("villaWeek")}
                  className={`${field} bg-white`}
                  style={ring}
                >
                  <option value="">Select…</option>
                  {villaOptions.map((o: string) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={form.villaWeek}
                  onChange={set("villaWeek")}
                  placeholder="583 — Week 23"
                  className={field}
                  style={ring}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Occupation
              </label>
              <input
                value={form.occupation}
                onChange={set("occupation")}
                placeholder="If retired, list prior occupation"
                className={field}
                style={ring}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Home phone
              </label>
              <input
                value={homePhone}
                onChange={set("homePhone")}
                className={field}
                style={ring}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Office phone
              </label>
              <input
                value={form.officePhone}
                onChange={set("officePhone")}
                className={field}
                style={ring}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Relevant experience
            </label>
            <textarea
              value={form.experience}
              onChange={set("experience")}
              rows={3}
              placeholder="Real Estate Advisory Board, Property Management Committee, or any other experience which may qualify you as a candidate"
              className={field}
              style={ring}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              How would your participation benefit the Association?
            </label>
            <textarea
              value={form.benefit}
              onChange={set("benefit")}
              rows={3}
              className={field}
              style={ring}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Issues or areas of Association management that interest or concern
              you
            </label>
            <textarea
              value={form.issues}
              onChange={set("issues")}
              rows={3}
              className={field}
              style={ring}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Director profile summary
            </label>
            <textarea
              value={form.profile}
              onChange={set("profile")}
              rows={5}
              placeholder="75–100 words on your experience and why you would like to serve. Please do not abbreviate words or company names."
              className={field}
              style={ring}
            />
            <p
              className={`text-xs mt-1 ${
                wordCount > 0 && (wordCount < 75 || wordCount > 100)
                  ? "text-amber-600"
                  : "text-muted-foreground"
              }`}
            >
              {wordCount} words — the Notice of Annual Meeting allows 75–100.
            </p>
          </div>

          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={committed}
              onChange={(e) => setCommitted(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I can commit to attending at least two meetings per year. I
              understand that, if elected, my name and email will be listed in
              Association publications so other owners can contact me.
            </span>
          </label>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Signature — type your full name
            </label>
            <input
              value={form.signature}
              onChange={set("signature")}
              className={field}
              style={ring}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Submitting a volunteer form is not a guarantee of being selected as
            a candidate. Information submitted is used only by the Board of
            Directors, except for your profile, which is included with the
            Notice of Annual Meeting should you be selected.
          </p>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-60"
              style={{ background: theme.accent }}
            >
              {submitting ? "Submitting…" : "Submit volunteer form"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg border text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
