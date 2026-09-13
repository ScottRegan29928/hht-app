import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSiteFlags } from "@/lib/siteContext";
import {
  ResortSwitch,
  useAssociationSite,
} from "@/components/owner/ResortSwitch";
import { toast } from "sonner";
import { Phone, Mail, Printer, Send, FileText } from "lucide-react";

/**
 * The comment card, as a form instead of a PDF.
 *
 * On the WordPress portals this is a PDF an owner has to download, print, fill
 * in and email or fax back. The PDF stays available for anyone who prefers it
 * (it is in Documents under Forms), but the default path is now a form that
 * routes straight to the resort's regime managers.
 */

export function OwnerCommentCardPage() {
  const { siteSlug, portalSlug, setSiteSlug, resorts, multi } =
    useAssociationSite();
  const { siteName: portalName } = useSiteFlags();
  // The heading has to follow the switcher, not the portal: an owner viewing
  // Swallowtail's documents from the Spicebush portal should see Swallowtail.
  const siteName =
    resorts.find(
      (r: { siteSlug: string; name: string }) => r.siteSlug === siteSlug,
    )?.name ?? portalName;
  const data = useQuery(api.ownerPortal.overview, { siteSlug, portalSlug });
  const me = useQuery(api.owner.currentUser);
  const submit = useMutation(api.inquiries.submit);
  // A comment card is about one stay in one villa, and the resort cannot act
  // on "somewhere at Spicebush" [scott, 2026-09-13]. Owners pick from the
  // weeks recorded in their name.
  const ownedWeeks = useQuery(api.owner.listOwnedWeeks);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const s = data?.settings;
  const cardPdf = (data?.documents?.form ?? []).find((d: any) =>
    /comment card/i.test(d.title),
  );

  // Prefill from the signed-in owner, but leave the fields editable.
  const effName = name || me?.displayName || "";
  const effEmail = email || me?.email || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effName.trim() || !effEmail.trim() || !message.trim()) {
      toast.error("Please add your name, email and comments");
      return;
    }
    setSending(true);
    try {
      const stay = (ownedWeeks ?? []).find(
        (w: any) => String(w.propertyId) === propertyId,
      );
      await submit({
        type: "comment_card",
        siteSlug,
        propertyId: (propertyId || undefined) as any,
        name: effName.trim(),
        email: effEmail.trim(),
        phone: phone.trim() || undefined,
        // Name the villa in the body too: the routed email is read by people
        // who are not looking at a database record.
        message: stay
          ? `${stay.propertyAddress} — Week ${stay.weekNumber}\n\n${message.trim()}`
          : message.trim(),
      });
      setSent(true);
      setMessage("");
      toast.success("Thank you — your comments are on their way");
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
    setSending(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Comment Card</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tell us about your stay at {siteName}.
        </p>
        {multi && (
          <div className="pt-1">
            <ResortSwitch
              resorts={resorts}
              value={siteSlug}
              onChange={setSiteSlug}
            />
          </div>
        )}
      </div>

      {s?.commentCardIntro && (
        <p className="text-sm leading-relaxed">{s.commentCardIntro}</p>
      )}

      {sent ? (
        <div className="border rounded-xl p-8 text-center">
          <p className="font-medium">Your comments have been sent.</p>
          <p className="text-sm text-muted-foreground mt-1">
            {s?.regimeEmail
              ? `They went to ${s.regimeEmail}.`
              : "The resort team has been notified."}
          </p>
          <button
            onClick={() => setSent(false)}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Send another
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="border rounded-xl p-5 space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Your name"
              value={effName}
              onChange={setName}
              required
            />
            <Field
              label="Email"
              type="email"
              value={effEmail}
              onChange={setEmail}
              required
            />
          </div>
          <Field label="Phone (optional)" value={phone} onChange={setPhone} />
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Which villa are you commenting on?
            </label>
            {(ownedWeeks ?? []).length > 0 ? (
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
              >
                <option value="">Select your villa…</option>
                {[
                  ...new Map(
                    (ownedWeeks ?? []).map((w: any) => [
                      String(w.propertyId),
                      w,
                    ]),
                  ).values(),
                ].map((w: any) => (
                  <option
                    key={String(w.propertyId)}
                    value={String(w.propertyId)}
                  >
                    {w.propertyAddress} — Week {w.weekNumber}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-muted-foreground border rounded-lg px-3 py-2 bg-muted/30">
                No villas are recorded in your name yet, so we will pass your
                comments to the resort office without one.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Your comments
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              required
              placeholder="What worked well? What would make your next stay better?"
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sending ? "Sending…" : "Send comments"}
          </button>
        </form>
      )}

      <section className="border rounded-xl p-5">
        <h2 className="font-semibold mb-3">Your regime managers</h2>
        <div className="space-y-2 text-sm">
          {(s?.regimeManagers ?? []).map((m: any) => (
            <div key={m.name} className="flex items-center gap-2">
              <span className="font-medium">{m.name}</span>
              {m.email && (
                <a
                  href={`mailto:${m.email}`}
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {m.email}
                </a>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-muted-foreground">
            {s?.regimePhone && (
              <a
                href={`tel:${s.regimePhone.replace(/[^\d+]/g, "")}`}
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <Phone className="w-3.5 h-3.5" />
                {s.regimePhone}
              </a>
            )}
            {s?.regimeFax && (
              <span className="inline-flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5" />
                Fax {s.regimeFax}
              </span>
            )}
            {s?.regimeEmail && (
              <a
                href={`mailto:${s.regimeEmail}`}
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <Mail className="w-3.5 h-3.5" />
                {s.regimeEmail}
              </a>
            )}
          </div>
        </div>
        {cardPdf && (
          <a
            href={cardPdf.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 text-sm text-primary hover:underline"
          >
            <FileText className="w-4 h-4" />
            Prefer paper? Download the printable comment card
          </a>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
      />
    </div>
  );
}
