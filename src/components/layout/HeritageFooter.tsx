import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSiteFlags } from "@/lib/siteContext";

/**
 * Heritage Vacations footer — a measured recreation of the footer on
 * heritagevacations.com [scott, 2026-09-08: "exactly match the attached"].
 *
 * Values read off the live site's computed styles, not eyeballed:
 *   heading    Bodoni Moda 400, 24px / 31.2px, #002d42
 *   sub copy   Quicksand 400, 19px / 26.6px, #727070
 *   input      465x55, white, 16px, padding 11px 12px
 *   button     #014e6c, white, 16px/600, padding 13px 26px
 *   dark bar   #0c2b3e, Quicksand 400 14px/25.2px white
 *   badge      Airbnb Superhost, 200x83
 *
 * Unlike the live site the newsletter form actually stores the signup
 * (per-site) rather than posting to a WordPress plugin.
 */

const YEAR_FROM = 1972;
const PHONE_DISPLAY = "843.363.5699";
const PHONE_HREF = "tel:8433635699";

export function HeritageFooter() {
  const { siteSlug } = useSiteFlags();
  const subscribe = useMutation(api.newsletter.subscribe);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    try {
      const res = await subscribe({ siteSlug, email });
      setMessage(
        res.alreadySubscribed
          ? "You’re already on the list — thank you."
          : "Thanks — you’re subscribed."
      );
      setState("done");
      setEmail("");
    } catch (err) {
      setMessage(
        err instanceof Error && /valid email/i.test(err.message)
          ? "Please enter a valid email address."
          : "Sorry — that didn’t go through. Please try again."
      );
      setState("error");
    }
  }

  return (
    <footer className="mt-[60px]">
      {/* ── Newsletter ── */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border-t border-[#014e6c]" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-12 items-start">
            <div>
              <h2
                className="text-[24px] leading-[31.2px] text-[#002d42]"
                style={{ fontFamily: '"Bodoni Moda", ui-serif, Georgia, serif', fontWeight: 400 }}
              >
                Subscribe to Our Newsletter
              </h2>
              <p
                className="mt-2 max-w-[442px] text-[19px] leading-[26.6px] text-[#727070]"
                style={{ fontFamily: "Quicksand, ui-sans-serif, system-ui, sans-serif", fontWeight: 400 }}
              >
                Receive first-to-know updates about our availability and specials.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="w-full max-w-[465px] md:justify-self-end">
              <label htmlFor="hv-newsletter-email" className="sr-only">
                Email
              </label>
              <input
                id="hv-newsletter-email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (state !== "idle") setState("idle");
                }}
                placeholder="Email *"
                className="w-full h-[55px] border border-[#d8dde1] bg-white px-3 py-[11px] text-[16px] leading-[22.4px] text-[#1f2933] outline-none transition-colors focus:border-[#014e6c]"
                style={{ fontFamily: "Quicksand, ui-sans-serif, system-ui, sans-serif" }}
              />
              <button
                type="submit"
                disabled={state === "sending"}
                className="mt-4 h-[50px] bg-[#014e6c] px-[26px] py-[13px] text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{
                  fontFamily: "Quicksand, ui-sans-serif, system-ui, sans-serif",
                  fontWeight: 600,
                  fontSize: "16px",
                }}
              >
                {state === "sending" ? "Subscribing…" : "Subscribe"}
              </button>
              {message && (
                <p
                  role="status"
                  className={`mt-3 text-sm ${state === "error" ? "text-red-600" : "text-[#014e6c]"}`}
                  style={{ fontFamily: "Quicksand, ui-sans-serif, system-ui, sans-serif" }}
                >
                  {message}
                </p>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* ── Dark bar ── */}
      <div className="bg-[#0c2b3e] px-[30px] py-[10px]">
        <div className="max-w-7xl mx-auto">
          <p
            className="text-center text-[14px] leading-[25.2px] text-white"
            style={{ fontFamily: "Quicksand, ui-sans-serif, system-ui, sans-serif", fontWeight: 400 }}
          >
            Copyright © {YEAR_FROM} - {new Date().getFullYear()} | Heritage Vacations | All
            Rights Reserved |{" "}
            <a href={PHONE_HREF} className="hover:underline">
              {PHONE_DISPLAY}
            </a>{" "}
            | Powered by{" "}
            <a
              href="https://lead-works.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/80 hover:text-white hover:underline"
            >
              LeadWorks
            </a>
          </p>
          <div className="flex justify-center pt-2 pb-4">
            <img
              src="/brand/hv/airbnb-superhost-white.png"
              alt="Airbnb Superhost"
              width={200}
              height={83}
              className="h-[83px] w-[200px] object-contain"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
