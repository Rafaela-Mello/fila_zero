import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const youIcon = L.divIcon({
  className: "fz-marker fz-marker-you",
  html: `<span></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function restIcon(selected) {
  return L.divIcon({
    className: `fz-marker fz-marker-rest${selected ? " is-selected" : ""}`,
    html: `<span></span>`,
    iconSize: selected ? [22, 22] : [16, 16],
    iconAnchor: selected ? [11, 11] : [8, 8],
  });
}

export default function NearbyMap({
  center,
  restaurants = [],
  selectedId,
  onSelect,
  radiusM = 1500,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const circleRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !center) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([center.lat, center.lng], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      circleRef.current = null;
    };
  }, [center]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !center) return;

    layer.clearLayers();
    if (circleRef.current) {
      map.removeLayer(circleRef.current);
      circleRef.current = null;
    }

    circleRef.current = L.circle([center.lat, center.lng], {
      radius: radiusM,
      color: "#FF6B1A",
      weight: 1,
      fillColor: "#FF6B1A",
      fillOpacity: 0.06,
    }).addTo(map);

    L.marker([center.lat, center.lng], { icon: youIcon, title: "Você" })
      .bindTooltip("Você está aqui", { direction: "top", offset: [0, -8] })
      .addTo(layer);

    const bounds = [[center.lat, center.lng]];

    for (const r of restaurants) {
      if (r.lat == null || r.lng == null) continue;
      bounds.push([r.lat, r.lng]);
      const marker = L.marker([r.lat, r.lng], {
        icon: restIcon(r.id === selectedId),
        title: r.name,
      })
        .bindTooltip(`${r.name} · ~${r.waitMinutes} min`, { direction: "top", offset: [0, -6] })
        .on("click", () => onSelect?.(r.id));
      marker.addTo(layer);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
    } else {
      map.setView([center.lat, center.lng], 15);
    }
  }, [center, restaurants, selectedId, radiusM, onSelect]);

  if (!center) {
    return <div className="map-placeholder">Ative a localização para ver o mapa.</div>;
  }

  return <div ref={containerRef} className="nearby-map" role="img" aria-label="Mapa dos restaurantes próximos" />;
}
