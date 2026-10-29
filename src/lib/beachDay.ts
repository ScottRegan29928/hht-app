/** Independent public-data utilities. All guest-facing times use Hilton Head's zone. */
export const ISLAND_ZONE = "America/New_York";
export const TIDE_STATION = "8669167"; // NOAA: Port Royal Plantation, Hilton Head
export const TIDE_LINK = `https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=${TIDE_STATION}`;
export const DOG_LINK = "https://hiltonheadislandsc.gov/our_island/beach/animals_on_the_beach.php";
export const TURTLE_LINK = "https://hiltonheadislandsc.gov/our_island/wildlife/sea_turtle_protection.php";

export function isTurtleSeason(now: Date): boolean {
  const month = Number(islandDate(now).slice(5, 7));
  return month >= 5 && month <= 10;
}

export function islandDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ISLAND_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function islandTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ISLAND_ZONE, hour: "numeric", minute: "2-digit",
  }).format(date);
}

export function eventTime(date: Date, now: Date): string {
  return `${islandDate(date) !== islandDate(now) ? "Tomorrow, " : ""}${islandTime(date)}`;
}

export function dogRule(now: Date) {
  const date = islandDate(now);
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: ISLAND_ZONE, hour: "numeric", hourCycle: "h23",
  }).format(now));
  const lastMay = new Date(Date.UTC(year, 4, 31));
  const memorialDay = 31 - ((lastMay.getUTCDay() + 6) % 7);
  const septFirst = new Date(Date.UTC(year, 8, 1));
  const laborDay = 1 + ((8 - septFirst.getUTCDay()) % 7);
  const dayKey = Number(date.slice(5).replace("-", ""));
  const summer = dayKey >= 500 + memorialDay - 3 && dayKey <= 900 + laborDay;
  if (month >= 4 && month <= 9 && hour >= 10 && hour < 17) {
    return summer
      ? { title: "Dogs return after 5 PM", detail: "Town beaches do not allow dogs from 10 AM to 5 PM during the peak summer season." }
      : { title: "Leashes on until 5 PM", detail: "Town beach rules require a leash from 10 AM to 5 PM during this part of the season." };
  }
  return {
    title: "Leash or voice control",
    detail: month >= 10 || month <= 3
      ? "From October through March, dogs must be leashed or under positive voice control at any hour."
      : "At this hour, dogs must be leashed or under positive voice control on Town beaches.",
  };
}

export type Tide = { at: Date; type: "H" | "L" };
export function parseTides(rows: { t: string; type: string }[]): Tide[] {
  return rows
    .filter((row) => (row.type === "H" || row.type === "L") &&
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(row.t))
    .map((row) => ({ at: new Date(row.t.replace(" ", "T") + ":00Z"), type: row.type as "H" | "L" }))
    .filter((row) => Number.isFinite(row.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function tideSummary(tides: Tide[], now: Date) {
  const next = tides.find((tide) => tide.at > now);
  const previous = tides.filter((tide) => tide.at <= now).at(-1);
  return {
    events: (["H", "L"] as const)
      .map((type) => ({ type, at: tides.find((tide) => tide.type === type && tide.at > now)?.at }))
      .sort((a, b) => (a.at?.getTime() ?? Infinity) - (b.at?.getTime() ?? Infinity)),
    direction: next && previous ? (next.type === "H" ? "Water on the way in" : "Water on the way out") : null,
    high: tides.find((tide) => tide.type === "H" && tide.at > now),
    low: tides.find((tide) => tide.type === "L" && tide.at > now),
  };
}

export function tideApiUrl(now: Date): string {
  const utcDay = (offset: number) =>
    new Date(now.getTime() + offset * 86400000).toISOString().slice(0, 10).replaceAll("-", "");
  return "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?" + new URLSearchParams({
    product: "predictions", application: "SwallowtailBeachDay", begin_date: utcDay(-1),
    end_date: utcDay(2), datum: "MLLW", station: TIDE_STATION,
    time_zone: "gmt", units: "english", interval: "hilo", format: "json",
  });
}


export const WEATHER_API = "https://api.weather.gov/stations/KHXD/observations/latest";
export const WEATHER_LINK = "https://forecast.weather.gov/MapClick.php?lat=32.13&lon=-80.79";
export type Weather = { at: Date; temperature: number; description: string; wind: string | null; humidity: number | null };
type Observation = {
  timestamp?: string; textDescription?: string;
  temperature?: { value?: number | null };
  windSpeed?: { value?: number | null };
  windDirection?: { value?: number | null };
  relativeHumidity?: { value?: number | null };
};
export function parseWeather(observation: Observation | null | undefined, now: Date): Weather | null {
  if (!observation) return null;
  const at = new Date(observation.timestamp ?? "");
  const age = now.getTime() - at.getTime();
  const celsius = observation.temperature?.value;
  if (!Number.isFinite(at.getTime()) || age > 2 * 3600000 || age < -300000 ||
      typeof celsius !== "number" || !Number.isFinite(celsius)) return null;
  const speed = observation.windSpeed?.value;
  const bearing = observation.windDirection?.value;
  const direction = typeof bearing === "number" && Number.isFinite(bearing) && bearing >= 0 && bearing <= 360
    ? ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(bearing / 45) % 8] : "";
  const humidity = observation.relativeHumidity?.value;
  return {
    at, temperature: Math.round(celsius * 9 / 5 + 32),
    description: observation.textDescription?.trim() || "Current conditions",
    wind: typeof speed === "number" && Number.isFinite(speed) && speed >= 0
      ? speed === 0 ? "Calm" : `${direction ? direction + " " : ""}${Math.round(speed / 1.609344)} mph` : null,
    humidity: typeof humidity === "number" && Number.isFinite(humidity) && humidity >= 0 && humidity <= 100
      ? Math.round(humidity) : null,
  };
}
