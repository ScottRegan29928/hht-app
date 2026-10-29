import { useEffect, useState } from "react";
import { ArrowUpRight, CloudSun, Turtle, Sunrise, Sunset, Waves } from "lucide-react";
import {
  TURTLE_LINK, TIDE_LINK, WEATHER_API, WEATHER_LINK, parseWeather,
  eventTime, islandDate, islandTime, isTurtleSeason, parseTides, tideApiUrl, tideSummary,
  type Tide, type Weather,
} from "@/lib/beachDay";
import "./beach-day.css";

function TideIcon({ high }: { high: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className="beach-day-event-icon" aria-hidden="true">
      <path d="M12 3v9" />
      <path d={high ? "m8 7 4-4 4 4" : "m8 8 4 4 4-4"} />
      <path d="M3 16c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0M3 21c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0" />
    </svg>
  );
}

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="beach-day-link sb-btn-maroon">
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
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherState, setWeatherState] = useState("loading");
  const weatherRefresh = Math.floor(now.getTime() / 600000);
  const date = islandDate(now);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    setWeather(null); setWeatherState("loading");
    getJson(WEATHER_API, controller.signal)
      .then((data) => {
        const observation = parseWeather(data.properties, new Date());
        if (!observation) throw new Error("No recent weather observation");
        if (active) { setWeather(observation); setWeatherState("ready"); }
      })
      .catch(() => { if (active) setWeatherState("unavailable"); });
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [weatherRefresh]);
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
                <div><span className="beach-day-event-label"><TideIcon high={false} />Next low tide</span><strong>{tide.low ? eventTime(tide.low.at, now) : tideState === "loading" ? "Loading…" : "Check NOAA"}</strong></div>
                <div><span className="beach-day-event-label"><TideIcon high />Next high tide</span><strong>{tide.high ? eventTime(tide.high.at, now) : tideState === "loading" ? "Loading…" : "Check NOAA"}</strong></div>
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
                <div><span className="beach-day-event-label"><Sunrise className="beach-day-event-icon" strokeWidth={1.5} aria-hidden="true" />Sunrise</span><strong>{sun ? islandTime(sun.sunrise) : sunState === "loading" ? "Loading…" : "Unavailable"}</strong></div>
                <div><span className="beach-day-event-label"><Sunset className="beach-day-event-icon" strokeWidth={1.5} aria-hidden="true" />Sunset</span><strong>{sun ? islandTime(sun.sunset) : sunState === "loading" ? "Loading…" : "Unavailable"}</strong></div>
              </div>
              <p className="beach-day-small">Today's sun times for Sea Pines, shown in Eastern Time.</p>
            </div>
            <SourceLink href="https://sunrise-sunset.org/">Sunrise-Sunset.org</SourceLink>
          </article>
          <article className="beach-day-column">
            <header>
              <p className="beach-day-label"><CloudSun size={26} strokeWidth={1.5} aria-hidden="true" /> Current weather</p>
              <h3 aria-live="polite">{weather ? `${weather.temperature}°F · ${weather.description}` :
                weatherState === "loading" ? "Checking the weather…" : "Weather unavailable"}</h3>
            </header>
            <div className="beach-day-column-body">
              <div className="beach-day-times" aria-live="polite">
                <div><span>Wind</span><strong>{weather?.wind ?? "Unavailable"}</strong></div>
                <div><span>Humidity</span><strong>{weather?.humidity != null ? `${weather.humidity}%` : "Unavailable"}</strong></div>
              </div>
              <p className="beach-day-small">{weather
                ? `Observed at Hilton Head Island Airport at ${islandTime(weather.at)} Eastern Time. National Weather Service data.`
                : "Current airport observations are unavailable. Check the National Weather Service for local conditions."}</p>
            </div>
            <SourceLink href={WEATHER_LINK}>Local forecast</SourceLink>
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
