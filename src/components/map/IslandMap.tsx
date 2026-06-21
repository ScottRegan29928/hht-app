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
}

interface IslandMapProps {
  communities: Community[];
  selectedCommunity?: string;
  height?: string;
  zoom?: number;
}

export function IslandMap({
  communities,
  selectedCommunity,
  height = "500px",
  zoom,
}: IslandMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const navigate = useNavigate();
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [SEA_PINES_CENTER.longitude, SEA_PINES_CENTER.latitude],
      zoom: zoom ?? SEA_PINES_CENTER.zoom,
      pitch: 20,
      attributionControl: false,
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

    communities.forEach((community) => {
      const isSelected = selectedCommunity === community.slug;

      // Custom marker element
      const el = document.createElement("div");
      el.className = "community-marker";
      el.style.cssText = `
        width: ${isSelected ? "44px" : "36px"};
        height: ${isSelected ? "44px" : "36px"};
        background: ${isSelected ? "oklch(0.38 0.08 220)" : "white"};
        border: 3px solid ${isSelected ? "white" : "oklch(0.38 0.08 220)"};
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: all 0.2s ease;
        font-size: 12px;
        font-weight: 700;
        color: ${isSelected ? "white" : "oklch(0.38 0.08 220)"};
      `;
      el.textContent = community.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2);

      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.15)";
        el.style.boxShadow = "0 6px 20px rgba(0,0,0,0.25)";
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
      });

      // Popup
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        maxWidth: "240px",
      }).setHTML(`
        <div style="padding: 12px 14px; font-family: Inter, sans-serif;">
          <h3 style="margin: 0 0 4px; font-size: 15px; font-weight: 600; color: oklch(0.18 0.02 250);">
            ${community.name}
          </h3>
          ${community.shortDescription ? `<p style="margin: 0 0 8px; font-size: 12px; color: oklch(0.50 0.015 250); line-height: 1.5;">${community.shortDescription}</p>` : ""}
          <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: oklch(0.38 0.08 220); font-weight: 500; cursor: pointer;">
            View community →
          </div>
        </div>
      `);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([community.longitude, community.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      el.addEventListener("click", () => {
        navigate(`/community/${community.slug}`);
      });

      markersRef.current.push(marker);
    });

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
