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

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

export function formatWalk(meters) {
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

/** Categorias amigáveis a partir de tags OSM / nome */
export function categorizeCuisine(cuisine, name = "", selfService = false) {
  const t = `${cuisine || ""} ${name}`.toLowerCase();
  if (selfService || /self|buffet|por\s*kg|quilo/.test(t)) return "self_service";
  if (/burger|hambur|smash/.test(t)) return "burger";
  if (/pizza/.test(t)) return "pizza";
  if (/sushi|japanese|japon|temaki|yakisoba/.test(t)) return "japanese";
  if (/pasta|italian|italia|massa|cantina/.test(t)) return "italian";
  if (/churras|steak|grill|churrasco/.test(t)) return "grill";
  if (/cafe|coffee|padaria|bakery/.test(t)) return "cafe";
  if (/fit|saudav|salad|veg/.test(t)) return "healthy";
  if (/fast_food|lanches|snack/.test(t)) return "fast_food";
  return "other";
}

export const CUISINE_TYPE_LABELS = {
  self_service: "Self-service / buffet",
  burger: "Hambúrguer",
  pizza: "Pizza",
  japanese: "Japonês",
  italian: "Italiano / massas",
  grill: "Churrasco / grelhados",
  cafe: "Café / padaria",
  healthy: "Saudável / fit",
  fast_food: "Lanches",
  other: "Outros",
};

function stableInt(seed, mod) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % mod;
}

const PRICE_LEVEL_LABELS = {
  1: "Barato",
  2: "Moderado",
  3: "Caro",
};

/** OSM quase não tem preço/nota — estimativa estável por id até parceiros enviarem dados reais */
function enrichCommerce(id) {
  const priceLevel = 1 + stableInt(`${id}-price`, 3); // 1–3
  const rating = Math.round((3.2 + stableInt(`${id}-rating`, 18) / 10) * 10) / 10; // 3.2–4.9
  return {
    priceLevel,
    rating,
    priceLabel: PRICE_LEVEL_LABELS[priceLevel] || PRICE_LEVEL_LABELS[2],
  };
}

function navUrls(lat, lng, name = "", address = "") {
  const latN = Number(lat);
  const lngN = Number(lng);
  const coord = `${latN},${lngN}`;
  const realAddress =
    address && !/não informado|modo demo/i.test(address) ? String(address).trim() : "";
  // Nome + coords evita o Maps “grudar” num POI vizinho errado
  const destParts = [name, realAddress, coord].filter(Boolean);
  const dest = destParts.join(", ");
  const q = encodeURIComponent(name || dest);
  return {
    // Deep links gratuitos — abrem Google Maps / Waze (app ou web). Sem API paga de roteamento.
    googleMapsDirUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=walking`,
    wazeUrl: `https://waze.com/ul?ll=${encodeURIComponent(coord)}&navigate=yes&q=${q}`,
  };
}

function normalizeHttpUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function placeLinks(tags = {}, name = "", lat, lng) {
  const websiteUrl =
    normalizeHttpUrl(tags.website) ||
    normalizeHttpUrl(tags["contact:website"]) ||
    normalizeHttpUrl(tags.url) ||
    null;
  const mapsPlaceUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${name} ${lat},${lng}`
  )}`;
  const menuInfoUrl =
    websiteUrl ||
    `https://www.google.com/search?q=${encodeURIComponent(`${name} cardápio`)}`;
  return { websiteUrl, mapsPlaceUrl, menuInfoUrl };
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

  const name = String(tags.name || tags.brand || "").trim();
  // OSM costuma ter POIs sem nome — não listamos
  if (!name) return null;

  const id = `osm-${el.type}-${el.id}`;
  const distanceM = Math.round(haversineMeters(userLat, userLng, coords.lat, coords.lng));
  const waitMinutes = estimateWaitMinutes(id);
  const level = waitLevel(waitMinutes);
  const selfService = looksSelfService(tags, name);
  const cuisineType = categorizeCuisine(tags.cuisine, name, selfService);
  const { priceLevel, rating, priceLabel } = enrichCommerce(id);
  const address = formatAddress(tags) || "Endereço não informado no OpenStreetMap";
  const nav = navUrls(coords.lat, coords.lng, name, address);
  const links = placeLinks(tags, name, coords.lat, coords.lng);

  return {
    id,
    name,
    address,
    lat: coords.lat,
    lng: coords.lng,
    rating,
    priceLevel,
    priceLabel,
    userRatingsTotal: null,
    openNow: tags.opening_hours ? null : null,
    photoRef: null,
    mapsUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    directionsUrl: `https://www.openstreetmap.org/directions?to=${coords.lat}%2C${coords.lng}`,
    googleMapsDirUrl: nav.googleMapsDirUrl,
    wazeUrl: nav.wazeUrl,
    websiteUrl: links.websiteUrl,
    mapsPlaceUrl: links.mapsPlaceUrl,
    menuInfoUrl: links.menuInfoUrl,
    distanceM,
    distanceLabel: formatDistance(distanceM),
    walkLabel: formatWalk(distanceM),
    waitMinutes,
    waitLevel: level.key,
    waitLabel: level.label,
    selfService,
    cuisine: tags.cuisine || null,
    cuisineType,
    cuisineTypeLabel: CUISINE_TYPE_LABELS[cuisineType] || CUISINE_TYPE_LABELS.other,
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
    { id: "demo-a", name: "Sabor da Praça", dLat: 0.0018, dLng: 0.0004, self: true, cuisine: "buffet" },
    { id: "demo-b", name: "Cantina do Vale Buffet", dLat: -0.0022, dLng: 0.0015, self: true, cuisine: "buffet" },
    { id: "demo-c", name: "Burger do Centro", dLat: 0.0031, dLng: -0.0012, self: false, cuisine: "burger" },
    { id: "demo-d", name: "Self Service Centro", dLat: -0.001, dLng: -0.0024, self: true, cuisine: "buffet" },
    { id: "demo-e", name: "Pizzaria Forno Alto", dLat: 0.004, dLng: 0.002, self: false, cuisine: "pizza" },
    { id: "demo-f", name: "Temaki Express", dLat: -0.0028, dLng: 0.003, self: false, cuisine: "japanese" },
  ];

  return seeds.map((s) => {
    const latR = lat + s.dLat;
    const lngR = lng + s.dLng;
    const distanceM = Math.round(haversineMeters(lat, lng, latR, lngR));
    const waitMinutes = estimateWaitMinutes(s.id);
    const level = waitLevel(waitMinutes);
    const cuisineType = categorizeCuisine(s.cuisine, s.name, s.self);
    const { priceLevel, rating, priceLabel } = enrichCommerce(s.id);
    const address = "Próximo a você (modo demo)";
    const nav = navUrls(latR, lngR, s.name, address);
    const links = placeLinks({}, s.name, latR, lngR);
    return {
      id: s.id,
      name: s.name,
      address,
      lat: latR,
      lng: lngR,
      rating,
      priceLevel,
      priceLabel,
      userRatingsTotal: null,
      openNow: true,
      photoRef: null,
      mapsUrl: `https://www.openstreetmap.org/?mlat=${latR}&mlon=${lngR}#map=17/${latR}/${lngR}`,
      directionsUrl: null,
      googleMapsDirUrl: nav.googleMapsDirUrl,
      wazeUrl: nav.wazeUrl,
      websiteUrl: links.websiteUrl,
      mapsPlaceUrl: links.mapsPlaceUrl,
      menuInfoUrl: links.menuInfoUrl,
      distanceM,
      distanceLabel: formatDistance(distanceM),
      walkLabel: formatWalk(distanceM),
      waitMinutes,
      waitLevel: level.key,
      waitLabel: level.label,
      selfService: s.self,
      cuisine: s.cuisine,
      cuisineType,
      cuisineTypeLabel: CUISINE_TYPE_LABELS[cuisineType] || CUISINE_TYPE_LABELS.other,
      source: "demo",
    };
  });
}

async function mergePartnerRestaurants(list, lat, lng, radius) {
  try {
    const { fetchPublishedPartners, partnerToPlaceDto } = await import("../routes/partners.js");
    const partners = await fetchPublishedPartners();
    const byId = new Map(list.map((p) => [p.id, p]));
    const maxR = radius || 5000;

    for (const row of partners) {
      const dto = partnerToPlaceDto(row, lat, lng);
      if (!dto) continue;
      if (dto.distanceM > maxR) continue;
      // Parceiro sempre sobrescreve / entra na lista com espera real
      byId.set(dto.id, dto);
    }
    return [...byId.values()];
  } catch (err) {
    console.error("[partners merge]", err.message);
    return list;
  }
}

/**
 * Busca restaurantes próximos via OpenStreetMap (Overpass API) — gratuito.
 * Parceiros cadastrados entram com espera real (wait_updated_at).
 */
export async function searchNearbyRestaurants({
  lat,
  lng,
  radius = 1500,
  selfService = false,
  maxDistanceM = null,
  maxWait = null,
  cuisineType = null,
  maxPrice = null,
  minRating = null,
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

  places = await mergePartnerRestaurants(places, lat, lng, radius);

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

  if (cuisineType && cuisineType !== "all") {
    list = list.filter((p) => p.cuisineType === cuisineType);
  }

  if (maxPrice != null) {
    list = list.filter((p) => (p.priceLevel ?? 3) <= maxPrice);
  }

  if (minRating != null) {
    list = list.filter((p) => (p.rating ?? 0) >= minRating);
  }

  if (list.length === 0 && source === "openstreetmap" && selfService) {
    // Poucos POIs marcados como self-service no OSM — amplia com todos e avisa
    warning =
      "Poucos self-service mapeados nessa área. Mostrando restaurantes próximos; o filtro por nome/buffet ainda vale quando houver.";
    list = places.filter((p) =>
      maxDistanceM != null ? p.distanceM <= maxDistanceM : true
    );
    if (maxWait != null) list = list.filter((p) => p.waitMinutes <= maxWait);
    if (cuisineType && cuisineType !== "all") {
      list = list.filter((p) => p.cuisineType === cuisineType);
    }
    if (maxPrice != null) list = list.filter((p) => (p.priceLevel ?? 3) <= maxPrice);
    if (minRating != null) list = list.filter((p) => (p.rating ?? 0) >= minRating);
  }

  if (list.length === 0 && source === "openstreetmap") {
    places = demoRestaurants(lat, lng);
    source = "demo";
    warning =
      "Nenhum restaurante encontrado no OpenStreetMap nesse raio — mostrando demo. Amplie a distância.";
    places = await mergePartnerRestaurants(places, lat, lng, radius);
    list = places;
    if (selfService) list = list.filter((p) => p.selfService);
    if (maxDistanceM != null) list = list.filter((p) => p.distanceM <= maxDistanceM);
    if (maxWait != null) list = list.filter((p) => p.waitMinutes <= maxWait);
    if (cuisineType && cuisineType !== "all") {
      list = list.filter((p) => p.cuisineType === cuisineType);
    }
    if (maxPrice != null) list = list.filter((p) => (p.priceLevel ?? 3) <= maxPrice);
    if (minRating != null) list = list.filter((p) => (p.rating ?? 0) >= minRating);
  }

  list.sort((a, b) => {
    // Parceiros com dado real primeiro em empate de espera
    if (a.waitMinutes !== b.waitMinutes) return a.waitMinutes - b.waitMinutes;
    if (Boolean(a.isPartner) !== Boolean(b.isPartner)) return a.isPartner ? -1 : 1;
    return (a.distanceM ?? 99999) - (b.distanceM ?? 99999);
  });

  return { restaurants: list, source, warning, center: { lat, lng } };
}
