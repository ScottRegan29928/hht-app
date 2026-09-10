import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { Search } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useSiteFlags } from "@/lib/siteContext";
import { cn } from "@/lib/utils";

/**
 * Airbnb-style search pill for the site header [scott, 2026-09-10].
 *
 * Three segments: Where (community dropdown), When (check-in / check-out)
 * and Who (# of guests). Submitting navigates to /search with the matching
 * query params, which SearchPage already round-trips into the Convex query.
 *
 * Deliberately not a popover-per-segment like Airbnb's: the fields are inline
 * so the whole thing works with keyboard and screen readers without a custom
 * focus-trap, and it degrades to a stacked block on mobile.
 */
export function HeaderSearchBar({ dark = false }: { dark?: boolean }) {
  const navigate = useNavigate();
  const { siteSlug } = useSiteFlags();
  // Where is a dropdown of this site's communities, alphabetical [scott, 2026-09-10].
  // communities.list is already site-scoped server-side, so a scoped site can
  // never list a sister site's communities here.
  const communities = useQuery(api.communities.list, { siteSlug });
  const communityOptions = [...(communities ?? [])]
    .map((c) => ({ value: c.slug, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
  const [community, setCommunity] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("");
  const checkOutRef = useRef<HTMLInputElement>(null);

  // Check-out can never precede check-in.
  useEffect(() => {
    if (checkIn && checkOut && checkOut <= checkIn) setCheckOut("");
  }, [checkIn, checkOut]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    // Dates only make sense for rentals, so a dated search is a rental search.
    params.set("type", checkIn || checkOut ? "rent" : "rent");
    // SearchPage round-trips `community` as a comma-joined slug list.
    if (community) params.set("community", community);
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    if (guests) params.set("guests", guests);
    navigate(`/search?${params.toString()}`);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Search properties"
      className={cn(
        "flex w-full flex-col gap-2 rounded-2xl border p-2 shadow-sm sm:max-w-3xl sm:flex-row sm:items-stretch sm:gap-0 sm:rounded-full sm:py-1.5 sm:pl-5 sm:pr-1.5",
        dark
          ? "border-white/40 bg-white/10 backdrop-blur"
          : "border-border bg-white"
      )}
    >
      {/* Where */}
      <Segment label="Where" dark={dark} className="sm:flex-[1.4]">
        <select
          value={community}
          onChange={(e) => setCommunity(e.target.value)}
          aria-label="Community"
          className={cn(fieldClass(dark), "cursor-pointer bg-transparent")}
        >
          <option value="">Search Properties</option>
          {communityOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Segment>

      <Divider dark={dark} />

      {/* When */}
      <Segment label="When" dark={dark} className="sm:flex-[1.3]">
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={checkIn}
            min={today}
            onChange={(e) => {
              setCheckIn(e.target.value);
              if (e.target.value) checkOutRef.current?.focus();
            }}
            aria-label="Check in"
            className={cn(fieldClass(dark), "w-[7.5rem]")}
          />
          <span className={dark ? "text-white/50" : "text-muted-foreground"}>
            &ndash;
          </span>
          <input
            ref={checkOutRef}
            type="date"
            value={checkOut}
            min={checkIn || today}
            onChange={(e) => setCheckOut(e.target.value)}
            aria-label="Check out"
            className={cn(fieldClass(dark), "w-[7.5rem]")}
          />
        </div>
      </Segment>

      <Divider dark={dark} />

      {/* Who */}
      <Segment label="Who" dark={dark} className="sm:flex-[0.9]">
        <select
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
          aria-label="Number of guests"
          className={cn(fieldClass(dark), "cursor-pointer bg-transparent")}
        >
          <option value=""># of Guests</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "guest" : "guests"}
            </option>
          ))}
        </select>
      </Segment>

      <button
        type="submit"
        aria-label="Search"
        className="flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 sm:h-11 sm:w-11 sm:self-center"
      >
        <Search className="h-4 w-4" />
        <span className="sm:hidden">Search</span>
      </button>
    </form>
  );
}

function Segment({
  label,
  dark,
  className,
  children,
}: {
  label: string;
  dark: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 px-2 py-1", className)}>
      <div
        className={cn(
          "text-[11px] font-semibold leading-none",
          dark ? "text-white" : "text-foreground"
        )}
      >
        {label}
      </div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function Divider({ dark }: { dark: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "hidden w-px shrink-0 self-center sm:block sm:h-8",
        dark ? "bg-white/30" : "bg-border"
      )}
    />
  );
}

function fieldClass(dark: boolean) {
  return cn(
    "w-full min-w-0 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0",
    dark
      ? "text-white placeholder:text-white/70 [color-scheme:dark]"
      : "text-foreground placeholder:text-muted-foreground"
  );
}
