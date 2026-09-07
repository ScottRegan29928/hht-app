import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN, SEA_PINES_CENTER } from "@/lib/constants";

interface Community {
  _id: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  shortDescription?: string | null;
  propertyCount?: number | null;
  heroImageUrl?: string | null;
  bedroomMin?: number | null;
  bedroomMax?: number | null;
  bathroomMin?: number | null;
  bathroomMax?: number | null;
}

interface IslandMapProps {
  communities: Community[];
  selectedCommunity?: string;
  height?: string;
  zoom?: number;
}

const LABEL_ZOOM_THRESHOLD = 14.5;

export function IslandMap({
  communities,
  selectedCommunity,
  height = "500px",
  zoom,
}: IslandMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const labelsRef = useRef<HTMLDivElement[]>([]);
  const navigate = useNavigate();
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [SEA_PINES_CENTER.longitude, SEA_PINES_CENTER.latitude],
      zoom: zoom ?? SEA_PINES_CENTER.zoom,
      pitch: 30,
      bearing: -10,
      attributionControl: false,
      scrollZoom: false,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      map.current?.remove();
      map.current = null;
    };
  }, [zoom]);

  // Add community markers
  useEffect(() => {
    if (!map.current || !mapLoaded || communities.length === 0) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    labelsRef.current = [];

    const currentZoom = map.current.getZoom();
    const showLabels = currentZoom >= LABEL_ZOOM_THRESHOLD;

    communities.forEach((community) => {
      const isSelected = selectedCommunity === community.slug;

      // Outer wrapper
      const el = document.createElement("div");
      el.className = "community-marker";
      el.style.cursor = "pointer";

      // Pin container
      const pin = document.createElement("div");
      pin.style.cssText = `
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        transition: transform 0.2s ease;
      `;

      // Circle
      const circle = document.createElement("div");
      const size = isSelected ? 46 : 38;
      circle.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        background: ${isSelected ? "oklch(0.38 0.08 220)" : "white"};
        border: 3px solid ${isSelected ? "white" : "oklch(0.38 0.08 220)"};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2), 0 1px 4px rgba(0,0,0,0.1);
        font-size: 12px;
        font-weight: 700;
        color: ${isSelected ? "white" : "oklch(0.38 0.08 220)"};
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      `;

      const abbr = community.name.split(" ")[0].slice(0, 2);
      circle.textContent = abbr;

      // Label below pin — only visible at higher zoom levels
      const label = document.createElement("div");
      label.style.cssText = `
        margin-top: 4px;
        padding: 2px 8px;
        background: white;
        border-radius: 6px;
        font-size: 10px;
        font-weight: 600;
        color: oklch(0.25 0.02 250);
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        letter-spacing: 0.01em;
        display: ${showLabels ? "block" : "none"};
        transition: opacity 0.3s ease;
      `;
      label.textContent = community.name;

      pin.appendChild(circle);
      pin.appendChild(label);
      el.appendChild(pin);

      // Track labels for zoom toggling
      labelsRef.current.push(label);

      el.addEventListener("mouseenter", () => {
        pin.style.transform = "scale(1.12) translateY(-3px)";
        circle.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.15)";
      });
      el.addEventListener("mouseleave", () => {
        pin.style.transform = "scale(1) translateY(0)";
        circle.style.boxShadow = "0 4px 16px rgba(0,0,0,0.2), 0 1px 4px rgba(0,0,0,0.1)";
      });

      // Build bed/bath detail string
      const bedStr =
        community.bedroomMin != null && community.bedroomMax != null
          ? community.bedroomMin === community.bedroomMax
            ? `${community.bedroomMin} Bed`
            : `${community.bedroomMin}–${community.bedroomMax} Bed`
          : null;
      const bathStr =
        community.bathroomMin != null && community.bathroomMax != null
          ? community.bathroomMin === community.bathroomMax
            ? `${community.bathroomMin % 1 === 0 ? community.bathroomMin : community.bathroomMin.toFixed(1)} Bath`
            : `${community.bathroomMin % 1 === 0 ? community.bathroomMin : community.bathroomMin.toFixed(1)}–${community.bathroomMax % 1 === 0 ? community.bathroomMax : community.bathroomMax.toFixed(1)} Bath`
          : null;
      const detailParts = [bedStr, bathStr].filter(Boolean);
      if (community.propertyCount)
        detailParts.push(
          `${community.propertyCount} villa${community.propertyCount !== 1 ? "s" : ""}`
        );
      const detailLine = detailParts.join(" · ");

      // Force popup direction
      // On community (interior) pages, all popups open to the right
      // On the homepage map, use per-community overrides for edge cases
      let popupAnchor: mapboxgl.Anchor | undefined;
      if (selectedCommunity) {
        popupAnchor = "left"; // all open to the right on interior pages
      } else {
        const anchorOverrides: Record<string, mapboxgl.Anchor> = {
          spicebush: "left",          // popup opens to the right
          "plantation-club": "left",  // popup opens to the right
          "night-heron": "right",     // popup opens to the left
        };
        popupAnchor = anchorOverrides[community.slug] ?? undefined;
      }

      // Popup
      const popup = new mapboxgl.Popup({
        offset: 20,
        closeButton: true,
        maxWidth: "260px",
        anchor: popupAnchor as any,
      }).setHTML(`
        <div style="padding: 14px 16px; font-family: Inter, sans-serif;">
          ${community.heroImageUrl ? `<img src="${community.heroImageUrl}" alt="${community.name}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;" />` : ""}
          <h3 style="margin: 0 0 4px; font-size: 15px; font-weight: 700; color: oklch(0.18 0.02 250);">
            ${community.name}
          </h3>
          ${detailLine ? `<p style="margin: 0 0 6px; font-size: 12px; font-weight: 500; color: oklch(0.38 0.02 250);">${detailLine}</p>` : ""}
          ${community.shortDescription ? `<p style="margin: 0 0 8px; font-size: 12px; color: oklch(0.50 0.015 250); line-height: 1.5;">${community.shortDescription}</p>` : ""}
          ${selectedCommunity !== community.slug ? `<a href="/community/${community.slug}" style="display: inline; font-size: 12px; color: oklch(0.38 0.08 220); font-weight: 600; cursor: pointer; text-decoration: none;">View community →</a>` : ""}
          <div style="display: flex; gap: 10px; margin-top: 8px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${community.latitude},${community.longitude}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: oklch(0.45 0.06 220); text-decoration: none; display: flex; align-items: center; gap: 3px;" onclick="event.stopPropagation();">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
              Google Maps
            </a>
            <a href="https://waze.com/ul?ll=${community.latitude},${community.longitude}&navigate=yes" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: oklch(0.45 0.06 220); text-decoration: none; display: flex; align-items: center; gap: 3px;" onclick="event.stopPropagation();">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              Waze
            </a>
          </div>
        </div>
      `);

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([community.longitude, community.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      // Show popup on hover with delay for mouseover to popup
      let hideTimeout: ReturnType<typeof setTimeout> | null = null;

      const showPopup = () => {
        if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }
        if (!marker.getPopup().isOpen()) marker.togglePopup();
      };
      const scheduleHide = () => {
        hideTimeout = setTimeout(() => {
          if (marker.getPopup().isOpen()) marker.togglePopup();
        }, 300);
      };

      el.addEventListener("mouseenter", showPopup);
      el.addEventListener("mouseleave", scheduleHide);

      // Keep popup open when hovering over the popup itself
      marker.getPopup().on("open", () => {
        const popupEl = marker.getPopup().getElement();
        if (popupEl) {
          popupEl.addEventListener("mouseenter", showPopup);
          popupEl.addEventListener("mouseleave", scheduleHide);
        }
      });

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        navigate(`/community/${community.slug}`);
      });

      markersRef.current.push(marker);
    });

    // Toggle labels based on zoom level
    const onZoom = () => {
      const z = map.current?.getZoom() ?? 0;
      const show = z >= LABEL_ZOOM_THRESHOLD;
      labelsRef.current.forEach((lbl) => {
        lbl.style.display = show ? "block" : "none";
      });
    };

    map.current.on("zoom", onZoom);

    // If a community is selected, fly to it
    if (selectedCommunity) {
      const selected = communities.find((c) => c.slug === selectedCommunity);
      if (selected) {
        map.current.flyTo({
          center: [selected.longitude, selected.latitude],
          zoom: 16,
          duration: 1500,
        });
      }
    }

    return () => {
      map.current?.off("zoom", onZoom);
    };
  }, [communities, mapLoaded, selectedCommunity, navigate]);

  if (!MAPBOX_TOKEN) {
    return (
      <div
        className="flex items-center justify-center bg-muted text-muted-foreground"
        style={{ height }}
      >
        <p className="text-sm">Map requires Mapbox configuration</p>
      </div>
    );
  }

  return (
    <div
      ref={mapContainer}
      style={{ height }}
      className="w-full rounded-xl"
    />
  );
}
