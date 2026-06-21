// Mapbox
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

// Sea Pines Resort center
export const SEA_PINES_CENTER = {
  latitude: 32.1287,
  longitude: -80.7753,
  zoom: 13.5,
};

// Inquiry email routing
export const INQUIRY_EMAILS = {
  purchase: "lisafleming@lighthouserealtyhhi.com",
  rental: "asutton@cglhhi.com",
} as const;

// Community coordinates (approximate centers within Sea Pines)
export const COMMUNITY_COORDS: Record<string, { lat: number; lng: number }> = {
  swallowtail: { lat: 32.1295, lng: -80.7800 },
  spicebush: { lat: 32.1310, lng: -80.7785 },
  "racquet-club": { lat: 32.1325, lng: -80.7760 },
  "plantation-club": { lat: 32.1340, lng: -80.7740 },
  "night-heron": { lat: 32.1305, lng: -80.7755 },
  "port-villa": { lat: 32.1280, lng: -80.7730 },
  "twin-oaks": { lat: 32.1318, lng: -80.7770 },
  "ketch-court": { lat: 32.1268, lng: -80.7745 },
};
