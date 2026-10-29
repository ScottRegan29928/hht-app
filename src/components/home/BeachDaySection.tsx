import { useEffect, useState } from "react";
import { ArrowUpRight, Dog, Turtle, Sunrise, Sunset, Waves } from "lucide-react";
import {
  DOG_LINK, TURTLE_LINK, TIDE_LINK, ISLAND_ZONE,
  dogRule, eventTime, islandDate, islandTime, isTurtleSeason, parseTides, tideApiUrl, tideSummary,
  type Tide,
} from "@/lib/beachDay";
import "./beach-day.css";

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="beach-day-link">
    {children}<ArrowUpRight size={16} aria-hidden="true" />
  </a>;
}

async function getJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Public data: ${response.status}`);
  return response.json();
}

export default function BeachDaySection() {
  const [now, setNow] = useState(() => new Date());
  const [tides, setTides] = useState<Tide[]>([]);
  const [tideState, setTideState] = useState("loading");
  const [sun, setSun] = useState<{ sunrise: Date; sunset: Date } | null>(null);
  const [sunState, setSunState] = useState("loading");
  const date = islandDate(now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    const update = () => { if (!document.hidden) setNow(new Date()); };
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    setTides([]); setSun(null); setTideState("loading"); setSunState("loading");
    getJson(tideApiUrl(new Date()), controller.signal)
      .then((data) => {
        const rows = parseTides(data.predictions ?? []);
        if (!rows.length) throw new Error("No tide predictions");
        setTides(rows); setTideState("ready");
      })
      .catch(() => { if (active) setTideState("unavailable"); });
    getJson(`https://api.sunrise-sunset.org/json?lat=32.13&lng=-80.79&date=${date}&formatted=0`, controller.signal)
      .then((data) => {
        const sunrise = new Date(data.results?.sunrise);
        const sunset = new Date(data.results?.sunset);
        if (data.status !== "OK" || !Number.isFinite(sunrise.getTime()) ||
            !Number.isFinite(sunset.getTime()) || islandDate(sunset) !== date) throw new Error("No sun times");
        setSun({ sunrise, sunset }); setSunState("ready");
      })
      .catch(() => { if (active) setSunState("unavailable"); });
    let active = true;
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [date]);

  const tide = tideSummary(tides, now);
  const dogs = dogRule(now);
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: ISLAND_ZONE, weekday: "long", month: "long", day: "numeric",
  }).format(now);
  const sunHeading = sun ? (now < sun.sunrise ? "First light, then a full day" :
    now < sun.sunset ? "Save a moment for sunset" : "The sun has set for today") : "A little more time outside";
  return (
    <section id="beach-day" className="beach-day" aria-labelledby="beach-day-title">
      <div className="beach-day-inner">
        <div className="beach-day-intro">
          <div>
            <p className="beach-day-kicker">Your Sea Pines field notes</p>
            <h2 id="beach-day-title">Before your toes<br className="beach-day-break" /> meet the sand.</h2>
          </div>
          <p>A quick look at the tides, daylight, and beach essentials, including a little care for the loggerheads that share our shore.</p>
        </div>
        <div className="beach-day-dateline"><span>{dateLabel}</span><span>Hilton Head Island · Eastern Time</span></div>
        <div className="beach-day-layout">
          <div className="beach-day-water">
            <div className="beach-day-tide">
              <p className="beach-day-label"><Waves size={22} aria-hidden="true" /> The rhythm of the water</p>
              <h3>{tide.direction ?? (tideState === "loading" ? "Checking the tides…" : "Tide times unavailable")}</h3>
              <p className="beach-day-station">NOAA reference: Port Royal Plantation, Hilton Head</p>
              <div className="beach-day-times" aria-live="polite">
                <div><span>Next low tide</span><strong>{tide.low ? eventTime(tide.low.at, now) : tideState === "loading" ? "Loading…" : "Check NOAA"}</strong></div>
                <div><span>Next high tide</span><strong>{tide.high ? eventTime(tide.high.at, now) : tideState === "loading" ? "Loading…" : "Check NOAA"}</strong></div>
              </div>
              <SourceLink href={TIDE_LINK}>Open the NOAA tide table</SourceLink>
              <p className="beach-day-small">Predicted tides, not measured conditions. Timing at Sea Pines may differ.</p>
            </div>
            <div className="beach-day-sun">
              <Sunset size={38} strokeWidth={1.25} aria-hidden="true" />
              <div>
                <h3>{sunHeading}</h3>
                <p>{sun ? <><Sunrise size={16} aria-hidden="true" /> Sunrise {islandTime(sun.sunrise)}<span>·</span>Sunset {islandTime(sun.sunset)}</> :
                  sunState === "loading" ? "Checking today's sunrise and sunset…" : "Sun times are unavailable right now."}</p>
                <SourceLink href="https://sunrise-sunset.org/">Sun times by Sunrise-Sunset.org</SourceLink>
              </div>
            </div>
          </div>
          <div className="beach-day-notes">
            <article className="beach-day-note">
              <div className="beach-day-note-heading"><Dog size={24} strokeWidth={1.5} aria-hidden="true" /><p className="beach-day-label">Paws on the shoreline</p></div>
              <h3>{dogs.title}</h3>
              <p>{dogs.detail} Follow posted restrictions, and keep wildlife undisturbed.</p>
              <p className="beach-day-property-note">Beach rules are separate from resort rules. Swallowtail does not allow pets.</p>
              <SourceLink href={DOG_LINK}>Read the Town's dog rules</SourceLink>
            </article>
            <article className="beach-day-note">
              <div className="beach-day-note-heading"><Turtle size={24} strokeWidth={1.5} aria-hidden="true" /><p className="beach-day-label">Share the shore with loggerheads</p></div>
              <h3>{isTurtleSeason(now) ? "Turtle season: lights out at 10 PM" : "A darker shore. A safer journey."}</h3>
              <p>May 1 through October 31: turn off or properly shield lights visible from the beach from 10 PM to 6 AM. Close curtains if indoor light reaches the shore.</p>
              <p>Give turtles and nests space, fill in sand holes, and take beach gear home each evening.</p>
              <SourceLink href={TURTLE_LINK}>Help protect Hilton Head's sea turtles</SourceLink>
            </article>
          </div>
        </div>
        <p className="beach-day-footer">Tides and sun times load for the island's current date. Beach rules: Town of Hilton Head Island. This is a planning guide, not a surf or swimming-safety report. Check posted signs and local advisories before entering the water.</p>
      </div>
    </section>
  );
}
