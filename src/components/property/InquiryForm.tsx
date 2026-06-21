import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";

interface InquiryFormProps {
  type: "purchase" | "rental";
  propertyId?: Id<"properties">;
  weekId?: Id<"weeks">;
  propertyName?: string;
  onClose?: () => void;
}

export function InquiryForm({
  type,
  propertyId,
  weekId,
  propertyName,
  onClose,
}: InquiryFormProps) {
  const submit = useMutation(api.inquiries.submit);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      toast.error("Please fill in your name and email.");
      return;
    }

    setSubmitting(true);
    try {
      await submit({
        type,
        propertyId,
        weekId,
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        message: form.message || undefined,
      });
      toast.success(
        type === "purchase"
          ? "Your offer request has been sent to Lighthouse Realty!"
          : "Your rental inquiry has been sent to The Club Group!"
      );
      setForm({ name: "", email: "", phone: "", message: "" });
      onClose?.();
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold font-[family-name:var(--font-display)]">
          {type === "purchase" ? "Make an Offer" : "Book Your Rental"}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {type === "purchase"
            ? "Your inquiry will be sent to Lighthouse Realty."
            : "Your inquiry will be sent to The Club Group."}
        </p>
        {propertyName && (
          <p className="text-sm font-medium text-primary mt-2">
            Re: {propertyName}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Name *
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Your full name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Email *
          </label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Phone
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="(555) 123-4567"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Message
        </label>
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          rows={3}
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          placeholder={
            type === "purchase"
              ? "I'm interested in purchasing this week..."
              : "I'd like to book this property for..."
          }
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {submitting ? "Sending..." : "Submit Inquiry"}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
