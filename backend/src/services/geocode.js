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
  const house = address.house_number;
  const postcode = address.postcode;

  const street = [road, house].filter(Boolean).join(", ");

  let short = null;
  if (neighborhood && city) short = `${neighborhood}, ${city}`;
  else if (city && state) short = `${city} — ${state}`;
  else if (city) short = city;
  else if (street && city) short = `${street}, ${city}`;
  else if (displayName) short = displayName.split(",").slice(0, 3).join(",").trim();

  // Header: rua, bairro, cidade e CEP
  const line = [street || road, neighborhood, city, postcode].filter(Boolean).join(" · ");
  const full =
    displayName ||
    [street || road, neighborhood, city, state, postcode].filter(Boolean).join(", ") ||
    short ||
    null;

  return {
    short: short || "Localização atual",
    line: line || short || "Localização atual",
    city: city || null,
    neighborhood: neighborhood || null,
    state: state || null,
    road: road || null,
    houseNumber: house || null,
    postcode: postcode || null,
    full,
  };
}

export async function reverseGeocode(lat, lng) {
  await throttle();

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");
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

/** Busca CEP no ViaCEP e tenta lat/lng no Nominatim. */
export async function lookupCep(rawCep) {
  const cep = String(rawCep || "").replace(/\D/g, "");
  if (cep.length !== 8) {
    const err = new Error("CEP deve ter 8 dígitos.");
    err.status = 400;
    throw err;
  }

  const viaRes = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    headers: { Accept: "application/json" },
  });
  if (!viaRes.ok) {
    throw new Error(`ViaCEP HTTP ${viaRes.status}`);
  }
  const via = await viaRes.json();
  if (via.erro) {
    const err = new Error("CEP não encontrado.");
    err.status = 404;
    throw err;
  }

  const street = via.logradouro || "";
  const neighborhood = via.bairro || "";
  const city = via.localidade || "";
  const state = via.uf || "";
  const formattedCep = via.cep || `${cep.slice(0, 5)}-${cep.slice(5)}`;

  let lat = null;
  let lng = null;
  try {
    await throttle();
    const q = [street, neighborhood, city, state, "Brasil"].filter(Boolean).join(", ");
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "br");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "pt-BR");

    const nomRes = await fetch(url, {
      headers: {
        "User-Agent": "FilaZero/0.1 (projeto IFSP; uso educacional)",
        Accept: "application/json",
      },
    });
    if (nomRes.ok) {
      const results = await nomRes.json();
      if (Array.isArray(results) && results[0]) {
        lat = Number(results[0].lat);
        lng = Number(results[0].lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          lat = null;
          lng = null;
        }
      }
    }
  } catch {
    /* coords opcionais */
  }

  return {
    cep: formattedCep,
    street,
    neighborhood,
    city,
    state,
    complement: via.complemento || "",
    lat,
    lng,
    source: "viacep",
  };
}
