import { useEffect, useState } from "react";
import { ArrowUpRight, Dog, Turtle, Sunset, Waves } from "lucide-react";
import {
  DOG_LINK, TURTLE_LINK, TIDE_LINK,
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
  const sunHeading = sun ? (now < sun.sunrise ? "A new day ahead" :
    now < sun.sunset ? "Time to enjoy the daylight" : "The sun has set") :
    sunState === "loading" ? "Checking sun times…" : "Sun times unavailable";
  return (
    <section id="beach-day" className="beach-day" aria-labelledby="beach-day-title">
      <div className="beach-day-inner">
        <div className="beach-day-intro">
          <div>
            <p className="beach-day-kicker">Your Sea Pines field notes</p>
            <h2 id="beach-day-title">Before your toes meet the sand.</h2>
          </div>
          <p>A quick look at the tides, daylight, and beach essentials, including a little care for the loggerheads that share our shore.</p>
        </div>
        <div className="beach-day-layout">
          <article className="beach-day-column">
            <header>
              <p className="beach-day-label"><Waves size={26} strokeWidth={1.5} aria-hidden="true" /> Tides</p>
              <h3>{tide.direction ? (tide.direction === "Water on the way in" ? "Incoming tide" : "Outgoing tide") :
                tideState === "loading" ? "Checking the tides…" : "Tide times unavailable"}</h3>
            </header>
            <div className="beach-day-column-body">
              <div className="beach-day-times" aria-live="polite">
                <div><span>Next low tide</span><strong>{tide.low ? eventTime(tide.low.at, now) : tideState === "loading" ? "Loading…" : "Check NOAA"}</strong></div>
                <div><span>Next high tide</span><strong>{tide.high ? eventTime(tide.high.at, now) : tideState === "loading" ? "Loading…" : "Check NOAA"}</strong></div>
              </div>
              <p className="beach-day-small">NOAA predictions for Port Royal Plantation, Hilton Head. Timing at Sea Pines may differ.</p>
            </div>
            <SourceLink href={TIDE_LINK}>NOAA tide table</SourceLink>
          </article>
          <article className="beach-day-column">
            <header>
              <p className="beach-day-label"><Sunset size={26} strokeWidth={1.5} aria-hidden="true" /> Daylight</p>
              <h3>{sunHeading}</h3>
            </header>
            <div className="beach-day-column-body">
              <div className="beach-day-times" aria-live="polite">
                <div><span>Sunrise</span><strong>{sun ? islandTime(sun.sunrise) : sunState === "loading" ? "Loading…" : "Unavailable"}</strong></div>
                <div><span>Sunset</span><strong>{sun ? islandTime(sun.sunset) : sunState === "loading" ? "Loading…" : "Unavailable"}</strong></div>
              </div>
              <p className="beach-day-small">Today's sun times for Sea Pines, shown in Eastern Time.</p>
            </div>
            <SourceLink href="https://sunrise-sunset.org/">Sunrise-Sunset.org</SourceLink>
          </article>
          <article className="beach-day-column">
            <header>
              <p className="beach-day-label"><Dog size={26} strokeWidth={1.5} aria-hidden="true" /> Dogs on the beach</p>
              <h3>{dogs.title}</h3>
            </header>
            <div className="beach-day-column-body">
              <p>{dogs.detail} Follow posted restrictions.</p>
              <p className="beach-day-property-note">Swallowtail does not allow pets. Beach rules are separate.</p>
            </div>
            <SourceLink href={DOG_LINK}>Town dog rules</SourceLink>
          </article>
          <article className="beach-day-column">
            <header>
              <p className="beach-day-label"><Turtle size={26} strokeWidth={1.5} aria-hidden="true" /> Sea turtles</p>
              <h3>{isTurtleSeason(now) ? "Lights out at 10 PM" : "Keep the shore dark"}</h3>
            </header>
            <div className="beach-day-column-body">
              <p>May 1–October 31: turn off or properly shield beach-visible lights from 10 PM to 6 AM. Close curtains if indoor light reaches the shore.</p>
              <p className="beach-day-small">Give loggerheads and nests space, fill sand holes, and remove beach gear each evening.</p>
            </div>
            <SourceLink href={TURTLE_LINK}>Protect our loggerheads</SourceLink>
          </article>
        </div>
        <p className="beach-day-footer">Daily tide predictions and sun times, with beach guidance from the Town of Hilton Head Island. Not a swimming-safety report. Check posted signs and local advisories before entering the water.</p>
      </div>
    </section>
  );
}
