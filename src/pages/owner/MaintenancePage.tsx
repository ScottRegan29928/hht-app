import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSiteFlags } from "@/lib/siteContext";
import {
  ResortSwitch,
  useAssociationSite,
} from "@/components/owner/ResortSwitch";
import { toast } from "sonner";
import { Send, Wrench, Phone } from "lucide-react";

/**
 * Owner maintenance requests [scott, 2026-09-15].
 *
 * Built on the same `inquiries.submit` path as the comment card and volunteer
 * form, so everything an owner sends lands in one place in the management
 * portal. Routing to the front desk lives server-side in convex/inquiries.ts
 * — the address is deliberately not repeated in the UI.
 *
 * ⚠ These are recorded and visible to admins but NOT emailed until go-live,
 * per Scott's rule on new notification addresses. The confirmation copy below
 * says "logged", not "sent", because claiming an email went out when none did
 * would be the kind of lie that costs someone a broken air conditioner.
 */

const CATEGORIES = [
  "Air conditioning / heating",
  "Plumbing",
  "Electrical",
  "Appliance",
  "Furniture or fixtures",
  "Pest control",
  "Housekeeping",
  "Other",
];

interface OwnedVilla {
  propertyId: string;
  propertyAddress: string;
}

const URGENCY = [
  { value: "routine", label: "Routine — can wait for the next visit" },
  { value: "soon", label: "Soon — should be looked at this week" },
  { value: "urgent", label: "Urgent — unusable or causing damage" },
];

export function OwnerMaintenancePage() {
  const { siteSlug, portalSlug, setSiteSlug, resorts, multi } =
    useAssociationSite();
  const { siteName: portalName } = useSiteFlags();
  const siteName =
    resorts.find(
      (r: { siteSlug: string; name: string }) => r.siteSlug === siteSlug,
    )?.name ?? portalName;

  const me = useQuery(api.owner.currentUser);
  const ownedWeeks = useQuery(api.owner.listOwnedWeeks);
  const submit = useMutation(api.inquiries.submit);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [urgency, setUrgency] = useState("routine");
  const [access, setAccess] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Prefill from the owner's profile, still editable [scott, 2026-09-13].
  const effName = name || me?.displayName || "";
  const effEmail = email || me?.email || "";
  const effPhone = phone || (me as any)?.phone || "";

  // One entry per villa, not per week: an owner with four weeks in one villa
  // should not see it four times.
  // Typed explicitly: Map<string, unknown>.values() widens to {} and loses
  // propertyAddress otherwise.
  const villas: OwnedVilla[] = [
    ...new Map<string, OwnedVilla>(
      (ownedWeeks ?? []).map((w: any) => [
        String(w.propertyId),
        { propertyId: String(w.propertyId), propertyAddress: w.propertyAddress },
      ]),
    ).values(),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effName.trim() || !effEmail.trim() || !message.trim()) {
      toast.error("Please add your name, email and a description");
      return;
    }
    if (!propertyId && villas.length > 0) {
      toast.error("Please choose which villa needs attention");
      return;
    }
    setSending(true);
    try {
      const villa = villas.find((w) => w.propertyId === propertyId);
      // The routed email is read by front-desk staff who are not looking at a
      // database record, so the villa, category and urgency go in the body.
      const body = [
        villa ? `Villa: ${villa.propertyAddress}` : null,
        `Category: ${category}`,
        `Urgency: ${URGENCY.find((u) => u.value === urgency)?.label ?? urgency}`,
        access.trim() ? `Access notes: ${access.trim()}` : null,
        "",
        message.trim(),
      ]
        .filter((line) => line !== null)
        .join("\n");

      await submit({
        type: "maintenance",
        siteSlug,
        propertyId: (propertyId || undefined) as any,
        name: effName.trim(),
        email: effEmail.trim(),
        phone: effPhone.trim() || undefined,
        message: body,
      });
      setSent(true);
      setMessage("");
      setAccess("");
      toast.success("Maintenance request logged");
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
    setSending(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Maintenance Request</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Report something that needs fixing in your villa at {siteName}.
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

      <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
        <Phone className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          If something is urgent — a leak, no air conditioning, anything causing
          damage — call the front desk on{" "}
          <a href="tel:+18433635699" className="font-medium text-foreground hover:underline">
            843.363.5699
          </a>{" "}
          rather than waiting on this form.
        </p>
      </div>

      {sent ? (
        <div className="border rounded-xl p-8 text-center">
          <Wrench className="w-6 h-6 mx-auto text-primary" />
          <p className="font-medium mt-3">Your request has been logged.</p>
          <p className="text-sm text-muted-foreground mt-1">
            The resort office can see it in the management portal.
          </p>
          <button
            onClick={() => setSent(false)}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Report something else
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="border rounded-xl p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" value={effName} onChange={setName} required />
            <Field
              label="Email"
              type="email"
              value={effEmail}
              onChange={setEmail}
              required
            />
          </div>
          <Field label="Phone" value={effPhone} onChange={setPhone} />

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Which villa needs attention?
            </label>
            {villas.length > 0 ? (
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
              >
                <option value="">Select your villa…</option>
                {villas.map((w) => (
                  <option key={w.propertyId} value={w.propertyId}>
                    {w.propertyAddress}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-muted-foreground border rounded-lg px-3 py-2 bg-muted/30">
                No villas are recorded in your name yet, so we will pass your
                request to the resort office without one.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">What needs fixing?</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">How urgent?</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
              >
                {URGENCY.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Description
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              required
              placeholder="What is wrong, where in the villa, and when you noticed it."
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
            />
          </div>

          <Field
            label="Access notes (optional)"
            value={access}
            onChange={setAccess}
            placeholder="e.g. guests in the villa until Friday; key with the front desk"
          />

          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sending ? "Sending…" : "Submit request"}
          </button>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
      />
    </div>
  );
}
