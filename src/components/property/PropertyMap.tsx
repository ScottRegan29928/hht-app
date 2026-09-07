import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { MAPBOX_TOKEN } from "@/lib/constants";

interface PropertyMapProps {
  latitude: number;
  longitude: number;
  address: string;
  communityName: string;
}

export function PropertyMap({
  latitude,
  longitude,
  address,
  communityName,
}: PropertyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [longitude, latitude],
      zoom: 16,
      interactive: true,
      scrollZoom: false,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right"
    );

    // Add marker
    const el = document.createElement("div");
    el.className = "property-map-marker";
    el.innerHTML = `
      <div style="
        width: 40px; height: 40px;
        background: #0c6e4f;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `;

    new mapboxgl.Marker(el)
      .setLngLat([longitude, latitude])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div style="padding:4px 0">
            <strong style="font-size:14px">${address}</strong><br/>
            <span style="color:#666;font-size:12px">${communityName} · Sea Pines</span>
          </div>`
        )
      )
      .addTo(map.current);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [latitude, longitude, address, communityName]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-72 sm:h-80 rounded-xl overflow-hidden border border-border"
    />
  );
}
