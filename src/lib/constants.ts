// Mapbox
// Set VITE_MAPBOX_TOKEN in Vercel project env vars and in .env.local for
// local dev. Not hardcoded: this repo is public.
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

// Map center — computed to frame all 8 community pins with padding
export const SEA_PINES_CENTER = {
  latitude: 32.1259,
  longitude: -80.7998,
  zoom: 13,
};

// Inquiry email routing
export const INQUIRY_EMAILS = {
  purchase: "lisafleming@lighthouserealtyhhi.com",
  rental: "asutton@cglhhi.com",
} as const;

// Community coordinates (exact, from Google Maps)
export const COMMUNITY_COORDS: Record<string, { lat: number; lng: number }> = {
  swallowtail: { lat: 32.132637, lng: -80.801083 },
  spicebush: { lat: 32.125879, lng: -80.792846 },
  "racquet-club": { lat: 32.137202, lng: -80.805415 },
  "plantation-club": { lat: 32.128688, lng: -80.792284 },
  "night-heron": { lat: 32.134600, lng: -80.775916 },
  "port-villa": { lat: 32.113859, lng: -80.823588 },
  "twin-oaks": { lat: 32.132366, lng: -80.809103 },
  "ketch-court": { lat: 32.138006, lng: -80.809444 },
};
