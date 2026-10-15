import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export type StayQuote =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unavailable"; reason: string }
  | {
      status: "ready";
      totalCents: number;
      components: Array<{ title: string; type: string; total: number }>;
    };

/**
 * Live HostAway price for a stay (debounced). This is the only price a guest
 * should ever see for specific dates — it is exactly what checkout charges.
 */
export function useStayQuote(
  propertyId: string | undefined,
  checkIn: string,
  checkOut: string,
  guests: number
): StayQuote {
  const quote = useAction(api.rentalCheckout.quoteStay);
  const [state, setState] = useState<StayQuote>({ status: "idle" });

  useEffect(() => {
    if (!propertyId || !checkIn || !checkOut || checkOut <= checkIn) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    const t = setTimeout(() => {
      quote({ propertyId: propertyId as Id<"properties">, checkIn, checkOut, guests })
        .then((r: any) => {
          if (cancelled) return;
          setState(
            r?.ok
              ? { status: "ready", totalCents: r.totalCents, components: r.components ?? [] }
              : { status: "unavailable", reason: r?.reason ?? "These dates are not available." }
          );
        })
        .catch(() => {
          if (!cancelled) setState({ status: "unavailable", reason: "Could not get a price right now. Please try again." });
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [quote, propertyId, checkIn, checkOut, guests]);

  return state;
}

export const fmtCents = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
