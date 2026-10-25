/**
 * Reverse geocode via Nominatim (OpenStreetMap) — gratuito.
 * Política: 1 req/s, User-Agent identificável.
 */

let lastCallAt = 0;

async function throttle() {
  const wait = 1100 - (Date.now() - lastCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

function pickLabel(address = {}, displayName = "") {
  const neighborhood =
    address.suburb ||
    address.neighbourhood ||
    address.city_district ||
    address.quarter ||
    address.hamlet ||
    address.residential;
  const city =
    address.city || address.town || address.village || address.municipality || address.county;
  const state = address.state;
  const road = address.road || address.pedestrian;

  let short = null;
  if (neighborhood && city) short = `${neighborhood}, ${city}`;
  else if (city && state) short = `${city} — ${state}`;
  else if (city) short = city;
  else if (road && city) short = `${road}, ${city}`;
  else if (displayName) short = displayName.split(",").slice(0, 3).join(",").trim();

  const line = [road, neighborhood, city].filter(Boolean).join(" · ");

  return {
    short: short || "Localização atual",
    line: line || short || displayName,
    city: city || null,
    neighborhood: neighborhood || null,
    state: state || null,
    road: road || null,
    full: displayName || short || null,
  };
}

export async function reverseGeocode(lat, lng) {
  await throttle();

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "16");
  url.searchParams.set("accept-language", "pt-BR");

  const res = await fetch(url, {
    headers: {
      "User-Agent": "FilaZero/0.1 (projeto IFSP; uso educacional)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Nominatim HTTP ${res.status}`);
  }

  const data = await res.json();
  const label = pickLabel(data.address || {}, data.display_name || "");

  return {
    ...label,
    lat,
    lng,
    source: "openstreetmap",
  };
}
