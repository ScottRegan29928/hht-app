/**
 * Loads Stripe.js from Stripe's CDN (it must be loaded from js.stripe.com for
 * PCI compliance, and node_modules here is read-only, so no npm package).
 * Card data goes from the browser straight to Stripe; our servers never see it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeFactory = (key: string) => any;

let loader: Promise<StripeFactory> | null = null;

export function loadStripeJs(): Promise<StripeFactory> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.Stripe) return Promise.resolve(w.Stripe);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3/";
    s.async = true;
    s.onload = () => (w.Stripe ? resolve(w.Stripe) : reject(new Error("Stripe.js failed to load")));
    s.onerror = () => {
      loader = null;
      reject(new Error("Could not load the secure payment form. Check your connection and try again."));
    };
    document.head.appendChild(s);
  });
  return loader;
}
