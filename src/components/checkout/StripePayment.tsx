import { useEffect, useRef, useState } from "react";
import { Loader2, Lock, AlertCircle } from "lucide-react";
import { loadStripeJs } from "@/lib/stripeJs";

/**
 * Stripe Payment Element (card only). Confirms in the browser without a
 * redirect; the server then verifies the authorization itself before holding
 * dates, so nothing here is trusted.
 */
export function StripePayment({
  publishableKey,
  clientSecret,
  intentType,
  buttonLabel,
  email,
  phone,
  name,
  onAuthorized,
}: {
  publishableKey: string;
  clientSecret: string;
  intentType: "payment" | "setup";
  buttonLabel: string;
  email: string;
  phone?: string;
  name: string;
  onAuthorized: () => Promise<void>;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementsRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let element: any = null;
    loadStripeJs()
      .then((Stripe) => {
        if (cancelled || !mountRef.current) return;
        const stripe = Stripe(publishableKey);
        const elements = stripe.elements({
          clientSecret,
          appearance: {
            theme: "stripe",
            variables: { borderRadius: "8px", fontFamily: "inherit" },
          },
        });
        element = elements.create("payment", {
          layout: "tabs",
          // Prefill from the guest form; Stripe Link otherwise asks for the phone again.
          defaultValues: { billingDetails: { email, name, phone: toE164(phone) } },
        });
        element.on("ready", () => setReady(true));
        element.mount(mountRef.current);
        stripeRef.current = stripe;
        elementsRef.current = elements;
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
      try {
        element?.destroy();
      } catch {
        /* already gone */
      }
    };
  }, [publishableKey, clientSecret, email, name, phone]);

  const pay = async () => {
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const opts = {
      elements,
      redirect: "if_required" as const,
      confirmParams: { return_url: window.location.href },
    };
    const result =
      intentType === "payment"
        ? await stripe.confirmPayment(opts)
        : await stripe.confirmSetup(opts);
    if (result.error) {
      setError(result.error.message ?? "Your card could not be authorized.");
      setBusy(false);
      return;
    }
    try {
      await onAuthorized();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {/* Stripe owns the mount node's children; React must never render into it. */}
      {!ready && !error && (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading secure payment form…
        </div>
      )}
      <div ref={mountRef} />
      <button
        type="button"
        onClick={pay}
        disabled={!ready || busy}
        className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Securing your reservation…
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" /> {buttonLabel}
          </>
        )}
      </button>
      <p className="text-xs text-muted-foreground text-center">
        Card details go directly to Stripe and are never stored on this site.
      </p>
    </div>
  );
}

/** "(843) 555-0100" -> "+18435550100"; US default, undefined if unusable. */
function toE164(raw?: string): string | undefined {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return undefined;
}
