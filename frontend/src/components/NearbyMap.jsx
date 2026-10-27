import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const youIcon = L.divIcon({
  className: "fz-marker fz-marker-you",
  html: `<span></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function restIcon(selected, favorite) {
  const size = selected ? 24 : favorite ? 20 : 16;
  const anchor = size / 2;
  return L.divIcon({
    className: `fz-marker fz-marker-rest${selected ? " is-selected" : ""}${favorite ? " is-fav" : ""}`,
    html: favorite ? `<span class="fz-fav-dot" aria-hidden="true">★</span>` : `<span></span>`,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
  });
}

export default function NearbyMap({
  center,
  restaurants = [],
  selectedId,
  onSelect,
  radiusM = 1500,
  favoriteIds = [],
  showYou = true,
  showRadius = true,
  emptyLabel = "Ative a localização para ver o mapa.",
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const circleRef = useRef(null);
  const favSet = new Set(favoriteIds);

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

    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(containerRef.current);
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      circleRef.current = null;
    };
    // Cria o mapa uma vez quando o centro fica disponível
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(center)]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !center) return;

    layer.clearLayers();
    if (circleRef.current) {
      map.removeLayer(circleRef.current);
      circleRef.current = null;
    }

    if (showRadius && radiusM > 0) {
      circleRef.current = L.circle([center.lat, center.lng], {
        radius: radiusM,
        color: "#FF6B1A",
        weight: 1,
        fillColor: "#FF6B1A",
        fillOpacity: 0.06,
      }).addTo(map);
    }

    const bounds = [];

    if (showYou) {
      L.marker([center.lat, center.lng], { icon: youIcon, title: "Você" })
        .bindTooltip("Você está aqui", { direction: "top", offset: [0, -8] })
        .addTo(layer);
      bounds.push([center.lat, center.lng]);
    }

    for (const r of restaurants) {
      if (r.lat == null || r.lng == null) continue;
      bounds.push([r.lat, r.lng]);
      const favorite = favSet.has(r.id) || r.favorite === true;
      const tip =
        r.waitMinutes != null
          ? `${favorite ? "★ " : ""}${r.name} · ~${r.waitMinutes} min`
          : `${favorite ? "★ " : ""}${r.name}`;
      const marker = L.marker([r.lat, r.lng], {
        icon: restIcon(r.id === selectedId, favorite),
        title: favorite ? `${r.name} (favorito)` : r.name,
        zIndexOffset: favorite || r.id === selectedId ? 200 : 0,
      })
        .bindTooltip(tip, { direction: "top", offset: [0, -6] })
        .on("click", () => onSelect?.(r.id));
      marker.addTo(layer);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 16);
    } else {
      map.setView([center.lat, center.lng], 15);
    }

    requestAnimationFrame(() => map.invalidateSize());
  }, [center, restaurants, selectedId, radiusM, onSelect, favoriteIds, showYou, showRadius]);

  if (!center) {
    return <div className="map-placeholder">{emptyLabel}</div>;
  }

  return <div ref={containerRef} className="nearby-map" role="img" aria-label="Mapa dos restaurantes próximos" />;
}
