/** Overpass público (OpenStreetMap) — sem chave e sem custo */
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/** Espera estável por id até os restaurantes enviarem dados reais */
export function estimateWaitMinutes(placeId) {
  let h = 2166136261;
  for (let i = 0; i < placeId.length; i++) {
    h ^= placeId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 3 + (Math.abs(h) % 28); // 3–30 min
}

export function waitLevel(wait) {
  if (wait <= 8) return { key: "low", label: "Baixa Lotação" };
  if (wait <= 18) return { key: "mid", label: "Média Lotação" };
  return { key: "high", label: "Alta Lotação" };
}

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

function formatWalk(meters) {
  const min = Math.max(1, Math.round(meters / 80));
  return `${min} min a pé`;
}

function looksSelfService(tags = {}, name = "") {
  const text = [
    name,
    tags.cuisine,
    tags.name,
    tags.description,
    tags["diet:self_service"],
    tags.self_service,
    tags.buffet,
    tags.amenity,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (tags.self_service === "yes" || tags.buffet === "yes") return true;
  return /self[-\s]?service|buffet|por\s*quilo|por\s*kg|comida por k|self service/.test(text);
}

function elementCoords(el) {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center && typeof el.center.lat === "number") {
    return { lat: el.center.lat, lng: el.center.lon };
  }
  return null;
}

function formatAddress(tags = {}) {
  const parts = [
    tags["addr:street"],
    tags["addr:housenumber"],
    tags["addr:suburb"] || tags["addr:neighbourhood"],
    tags["addr:city"],
  ].filter(Boolean);
  if (parts.length) return parts.join(", ");
  return tags["addr:full"] || null;
}

function mapOsmElement(el, userLat, userLng) {
  const tags = el.tags || {};
  const coords = elementCoords(el);
  if (!coords) return null;

  const id = `osm-${el.type}-${el.id}`;
  const name = tags.name || tags.brand || "Restaurante sem nome";
  const distanceM = Math.round(haversineMeters(userLat, userLng, coords.lat, coords.lng));
  const waitMinutes = estimateWaitMinutes(id);
  const level = waitLevel(waitMinutes);
  const selfService = looksSelfService(tags, name);

  return {
    id,
    name,
    address: formatAddress(tags) || "Endereço não informado no OpenStreetMap",
    lat: coords.lat,
    lng: coords.lng,
    rating: null,
    userRatingsTotal: null,
    openNow: tags.opening_hours ? null : null,
    photoRef: null,
    mapsUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    directionsUrl: `https://www.openstreetmap.org/directions?to=${coords.lat}%2C${coords.lng}`,
    distanceM,
    distanceLabel: formatDistance(distanceM),
    walkLabel: formatWalk(distanceM),
    waitMinutes,
    waitLevel: level.key,
    waitLabel: level.label,
    selfService,
    cuisine: tags.cuisine || null,
    source: "openstreetmap",
  };
}

function buildOverpassQuery(lat, lng, radius) {
  // Busca ampla; filtro self-service é aplicado depois no Node (dados OSM raramente têm a tag)
  return `[out:json][timeout:25];
(
  node["amenity"="restaurant"](around:${radius},${lat},${lng});
  way["amenity"="restaurant"](around:${radius},${lat},${lng});
  node["amenity"="fast_food"](around:${radius},${lat},${lng});
  way["amenity"="fast_food"](around:${radius},${lat},${lng});
  node["amenity"="cafe"](around:${radius},${lat},${lng});
  way["amenity"="cafe"](around:${radius},${lat},${lng});
);
out center 50;`;
}

async function fetchOverpass(query) {
  let lastError;
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent": "FilaZero/0.1 (projeto IFSP; contato local)",
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!res.ok) {
        lastError = new Error(`Overpass HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      if (!Array.isArray(data.elements)) {
        lastError = new Error("Resposta Overpass inválida");
        continue;
      }
      return data.elements;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Falha ao consultar OpenStreetMap");
}

/** Fallback se Overpass estiver fora / sem resultados */
export function demoRestaurants(lat, lng) {
  const seeds = [
    { id: "demo-a", name: "Sabor da Praça", dLat: 0.0018, dLng: 0.0004, self: true },
    { id: "demo-b", name: "Cantina do Vale Buffet", dLat: -0.0022, dLng: 0.0015, self: true },
    { id: "demo-c", name: "Prato Feito & Cia", dLat: 0.0031, dLng: -0.0012, self: false },
    { id: "demo-d", name: "Self Service Centro", dLat: -0.001, dLng: -0.0024, self: true },
    { id: "demo-e", name: "Grill Express", dLat: 0.004, dLng: 0.002, self: false },
  ];

  return seeds.map((s) => {
    const latR = lat + s.dLat;
    const lngR = lng + s.dLng;
    const distanceM = Math.round(haversineMeters(lat, lng, latR, lngR));
    const waitMinutes = estimateWaitMinutes(s.id);
    const level = waitLevel(waitMinutes);
    return {
      id: s.id,
      name: s.name,
      address: "Próximo a você (modo demo)",
      lat: latR,
      lng: lngR,
      rating: null,
      userRatingsTotal: null,
      openNow: true,
      photoRef: null,
      mapsUrl: `https://www.openstreetmap.org/?mlat=${latR}&mlon=${lngR}#map=17/${latR}/${lngR}`,
      directionsUrl: null,
      distanceM,
      distanceLabel: formatDistance(distanceM),
      walkLabel: formatWalk(distanceM),
      waitMinutes,
      waitLevel: level.key,
      waitLabel: level.label,
      selfService: s.self,
      cuisine: null,
      source: "demo",
    };
  });
}

/**
 * Busca restaurantes próximos via OpenStreetMap (Overpass API) — gratuito.
 */
export async function searchNearbyRestaurants({
  lat,
  lng,
  radius = 1500,
  selfService = false,
  maxDistanceM = null,
  maxWait = null,
}) {
  let places = [];
  let source = "openstreetmap";
  let warning = null;

  try {
    const query = buildOverpassQuery(lat, lng, radius);
    const elements = await fetchOverpass(query);
    places = elements
      .map((el) => mapOsmElement(el, lat, lng))
      .filter(Boolean);

    // Dedup por id
    const seen = new Set();
    places = places.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  } catch (err) {
    console.error("[overpass]", err.message);
    places = demoRestaurants(lat, lng);
    source = "demo";
    warning =
      "OpenStreetMap temporariamente indisponível — mostrando restaurantes demo. Tente de novo em alguns segundos.";
  }

  let list = places;

  if (selfService) {
    list = list.filter((p) => p.selfService || /buffet|self/i.test(p.name));
  }

  if (maxDistanceM != null) {
    list = list.filter((p) => p.distanceM != null && p.distanceM <= maxDistanceM);
  }

  if (maxWait != null) {
    list = list.filter((p) => p.waitMinutes <= maxWait);
  }

  if (list.length === 0 && source === "openstreetmap" && selfService) {
    // Poucos POIs marcados como self-service no OSM — amplia com todos e avisa
    warning =
      "Poucos self-service mapeados nessa área. Mostrando restaurantes próximos; o filtro por nome/buffet ainda vale quando houver.";
    list = places.filter((p) =>
      maxDistanceM != null ? p.distanceM <= maxDistanceM : true
    );
    if (maxWait != null) list = list.filter((p) => p.waitMinutes <= maxWait);
  }

  if (list.length === 0 && source === "openstreetmap") {
    places = demoRestaurants(lat, lng);
    source = "demo";
    warning =
      "Nenhum restaurante encontrado no OpenStreetMap nesse raio — mostrando demo. Amplie a distância.";
    list = places;
    if (selfService) list = list.filter((p) => p.selfService);
    if (maxDistanceM != null) list = list.filter((p) => p.distanceM <= maxDistanceM);
    if (maxWait != null) list = list.filter((p) => p.waitMinutes <= maxWait);
  }

  list.sort((a, b) => {
    if (a.waitMinutes !== b.waitMinutes) return a.waitMinutes - b.waitMinutes;
    return (a.distanceM ?? 99999) - (b.distanceM ?? 99999);
  });

  return { restaurants: list, source, warning, center: { lat, lng } };
}
