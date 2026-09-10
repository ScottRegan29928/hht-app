/**
 * Annual maintenance fee payment.
 *
 * The two resorts do not work the same way [scott, 2026-09-08]:
 *   - Swallowtail does NOT take payments on the website. Owners are sent to
 *     their management company's portal at secure2.irm1.net.
 *   - Spicebush collects on site through Square.
 *
 * This page renders from the site's `paymentMode`, so neither behavior is
 * hardcoded to a slug and a third resort can be added by config alone.
 *
 * Deliberate: when a mode needs a URL that has not been supplied yet, the page
 * tells the owner how to pay by phone instead of rendering a dead button. A
 * broken payment button on a fee page costs the client real calls.
 */
import { ExternalLink, CreditCard, Phone } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSitePayment, useSiteFlags, useSiteBrand } from "@/lib/siteContext";

export function OwnerPaymentPage() {
  const payment = useSitePayment();
  const { siteName } = useSiteFlags();
  const brand = useSiteBrand();

  // What this owner actually owes, from the Store module. Independent of any
  // processor: a fee recorded as paid by check shows as paid here too.
  const charges = useQuery(api.store.myCharges, {});
  const totals = useQuery(api.store.myChargeTotals, {});
  const money = (cents: number) =>
    cents === 0
      ? "Free"
      : `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">Make a Payment</h1>
      <p className="mt-2 text-muted-foreground">
        Annual maintenance fees for {siteName}.
      </p>

      {charges && charges.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-lg border">
          <div className="flex items-baseline justify-between border-b bg-muted/40 px-5 py-3">
            <h2 className="font-semibold">Your fees</h2>
            {totals && totals.dueCount > 0 && (
              <span className="text-sm">
                <span className="text-muted-foreground">Balance due </span>
                <span className="font-semibold">{totals.dueLabel}</span>
              </span>
            )}
          </div>
          <table className="w-full text-sm">
            <tbody>
              {charges.map((c: any) => (
                <tr key={c._id} className="border-b last:border-0">
                  <td className="px-5 py-3">
                    <span className="font-medium">{c.itemName}</span>
                    {c.weekLabel && (
                      <span className="block text-xs text-muted-foreground">
                        {c.weekLabel}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-medium whitespace-nowrap">
                    {money(c.amountCents)}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.status === "paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : c.status === "due"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.status === "paid" && c.paymentMethod === "free"
                        ? "included"
                        : c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
            Paid by check or over the phone? Staff record it here, so this list
            is the full picture either way.
          </p>
        </div>
      )}

      {!payment.enabled && (
        <div className="mt-8 rounded-lg border bg-muted/30 p-6">
          <p className="text-sm text-muted-foreground">
            Online payments are not set up for this portal. Please contact the
            resort office to pay your maintenance fee.
          </p>
        </div>
      )}

      {payment.mode === "external" && (
        <div className="mt-8 rounded-lg border p-6">
          <h2 className="font-semibold">Pay through the owner portal</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {payment.note ??
              `${brand.legalName} maintenance fees are handled by our management company, not on this website. You will be taken to their secure payment portal to sign in and pay.`}
          </p>
          {payment.ready ? (
            <a
              href={payment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Go to the payment portal
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <PayByPhone />
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            This link opens a site we do not operate. Your card details are
            never entered on this website.
          </p>
        </div>
      )}

      {payment.mode === "square_link" && (
        <div className="mt-8 rounded-lg border p-6">
          <h2 className="font-semibold">Pay your maintenance fee</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {payment.note ??
              "Payments are processed securely by Square. You can pay by credit or debit card."}
          </p>
          {payment.ready ? (
            <a
              href={payment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <CreditCard className="h-4 w-4" />
              Pay with Square
            </a>
          ) : (
            <PayByPhone />
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Card details are entered on Square's secure checkout, never stored
            on this website.
          </p>
        </div>
      )}
    </div>
  );
}

function PayByPhone() {
  return (
    <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4">
      <p className="flex items-start gap-2 text-sm text-amber-900">
        <Phone className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Online payment is being set up. In the meantime, please call The Club
          Group at{" "}
          <a href="tel:+18436715551" className="font-medium underline">
            843-671-5551
          </a>{" "}
          to pay your maintenance fee.
        </span>
      </p>
    </div>
  );
}
