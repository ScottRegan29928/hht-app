import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { X, Phone, Check } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useSiteFlags } from "@/lib/siteContext";

/**
 * Site-wide Contact form, presented as a slide-in panel from the right
 * [scott, 2026-09-08: "Contact (slide-in form)"].
 *
 * Submits an inquiry of type "general" — it has no property attached, unlike
 * the purchase/rental enquiries raised from a listing page.
 */

const PHONE_DISPLAY = "843.363.5699";
const PHONE_HREF = "tel:8433635699";

type Props = { open: boolean; onClose: () => void };

export function ContactPanel({ open, onClose }: Props) {
  const { siteSlug } = useSiteFlags();
  const submit = useMutation(api.inquiries.submit);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape, and keep background scroll locked while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the panel so keyboard and screen-reader users land here.
    const t = setTimeout(() => firstFieldRef.current?.focus(), 120);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open, onClose]);

  // Reset back to a blank form once the panel has closed, so reopening it
  // doesn't show the previous confirmation.
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      setSent(false);
      setError(null);
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    }, 300);
    return () => clearTimeout(t);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    try {
      await submit({
        type: "general",
        siteSlug,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        message: message.trim() || undefined,
      });
      setSent(true);
    } catch {
      setError("Sorry — that didn't send. Please try again, or call us.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-[60] bg-black/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Contact us"
        className={`fixed right-0 top-0 z-[61] h-full w-full max-w-[420px] bg-white shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto">
          <div className="flex items-start justify-between px-6 pt-6">
            <div>
              <h2
                className="text-[24px] leading-[31.2px] text-[#002d42]"
                style={{ fontFamily: '"Bodoni Moda", ui-serif, Georgia, serif', fontWeight: 400 }}
              >
                Contact Us
              </h2>
              <a
                href={PHONE_HREF}
                className="mt-1 inline-flex items-center gap-1.5 text-sm text-[#014e6c] hover:underline"
                style={{ fontFamily: "Quicksand, ui-sans-serif, system-ui, sans-serif" }}
              >
                <Phone className="h-3.5 w-3.5" />
                {PHONE_DISPLAY}
              </a>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close contact form"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {sent ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#014e6c]/10">
                <Check className="h-6 w-6 text-[#014e6c]" />
              </div>
              <p className="text-base font-medium text-foreground">Thanks — we&rsquo;ve got it.</p>
              <p className="text-sm text-muted-foreground">
                Someone from our team will be in touch shortly.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 text-sm text-[#014e6c] hover:underline"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-6 py-6">
              <Field label="Name" required>
                <input
                  ref={firstFieldRef}
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="How can we help?">
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={`${inputClass} resize-y`}
                />
              </Field>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={sending}
                className="mt-auto w-full bg-[#014e6c] px-6 py-3.5 text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{
                  fontFamily: "Quicksand, ui-sans-serif, system-ui, sans-serif",
                  fontWeight: 600,
                  fontSize: "16px",
                }}
              >
                {sending ? "Sending…" : "Send Message"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

const inputClass =
  "w-full border border-input bg-white px-3 py-2.5 text-[15px] text-foreground outline-none transition-colors focus:border-[#014e6c]";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
