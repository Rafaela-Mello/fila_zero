import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useGeolocation } from "../hooks/useGeolocation.js";
import NearbyMap from "../components/NearbyMap.jsx";
import AccountPanel from "../components/AccountPanel.jsx";
import {
  ChatAssistant,
  buildGoNowUrl,
  fetchMenu,
  fetchPlacePage,
  mergeFeedbacksWithMocks,
  sharePlace,
  submitPlaceFeedback,
  trackGoNow,
  useUserExtras,
} from "../components/AppExtras.jsx";

const DISTANCE_OPTIONS = [
  { value: 800, label: "Até 800 m" },
  { value: 1500, label: "Até 1,5 km" },
  { value: 3000, label: "Até 3 km" },
  { value: 5000, label: "Até 5 km" },
];

const WAIT_OPTIONS = [
  { value: "", label: "Qualquer espera" },
  { value: "8", label: "Baixa (até ~8 min)" },
  { value: "18", label: "Até ~18 min" },
  { value: "30", label: "Até ~30 min" },
];

const SORT_OPTIONS = [
  { value: "wait", label: "Menor espera" },
  { value: "distance", label: "Mais perto" },
];

const CUISINE_OPTIONS = [
  { value: "all", label: "Todos os tipos" },
  { value: "self_service", label: "Self-service / buffet" },
  { value: "burger", label: "Hambúrguer" },
  { value: "pizza", label: "Pizza" },
  { value: "japanese", label: "Japonês" },
  { value: "italian", label: "Italiano / massas" },
  { value: "grill", label: "Churrasco / grelhados" },
  { value: "cafe", label: "Café / padaria" },
  { value: "healthy", label: "Saudável / fit" },
  { value: "fast_food", label: "Lanches" },
  { value: "other", label: "Outros" },
];

const PRICE_OPTIONS = [
  { value: "", label: "Qualquer preço" },
  { value: "1", label: "Até barato" },
  { value: "2", label: "Até moderado" },
  { value: "3", label: "Até caro" },
];

const RATING_OPTIONS = [
  { value: "", label: "Qualquer nota" },
  { value: "3.5", label: "3,5+" },
  { value: "4", label: "4,0+" },
  { value: "4.5", label: "4,5+" },
];

const THEME_KEY = "filazero-theme";

/** Tempo de refeição estimado por tipo (min) — até haver dados reais dos parceiros */
function estimateMealMinutes(place) {
  const type = place?.cuisineType || "";
  if (place?.selfService || type === "self_service") return 28;
  if (type === "cafe" || type === "fast_food") return 22;
  if (type === "burger" || type === "healthy") return 25;
  if (type === "japanese" || type === "pizza") return 32;
  if (type === "grill" || type === "italian") return 40;
  return 35;
}

function approxDistanceM(from, to) {
  const lat1 = Number(from?.lat);
  const lng1 = Number(from?.lng);
  const lat2 = Number(to?.lat);
  const lng2 = Number(to?.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a))));
}

function placeFromFavorite(fav, origin) {
  const id = String(fav.placeId ?? fav.placeid ?? "");
  const name = fav.placeName ?? fav.placename ?? "Restaurante";
  const address = fav.placeAddress ?? fav.placeaddress ?? "—";
  const lat = fav.lat != null ? Number(fav.lat) : null;
  const lng = fav.lng != null ? Number(fav.lng) : null;
  const distanceM =
    lat != null && lng != null ? approxDistanceM(origin, { lat, lng }) : null;
  const walkMin =
    distanceM != null ? Math.max(1, Math.round(distanceM / 80)) : null;
  const query = [name, address, lat != null && lng != null ? `${lat},${lng}` : ""]
    .filter(Boolean)
    .join(" ");
  return {
    id,
    name,
    address,
    lat,
    lng,
    favorite: true,
    waitMinutes: 12,
    waitLabel: "Estimativa",
    waitLevel: "mid",
    distanceM,
    distanceLabel:
      distanceM == null
        ? "—"
        : distanceM >= 1000
          ? `${(distanceM / 1000).toFixed(1)} km`
          : `${distanceM} m`,
    walkLabel: walkMin != null ? `~${walkMin} min a pé` : "—",
    cuisineTypeLabel: "Restaurante",
    priceLabel: null,
    rating: null,
    mapsPlaceUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    googleMapsDirUrl:
      lat != null && lng != null
        ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`
        : null,
  };
}

/** Rota do Almoço Rápido: deslocamento ida+volta (pé ou carro) + fila + refeição */
function computeLunchRoute(place) {
  if (!place) return null;
  const meters = Number.isFinite(place.distanceM) ? place.distanceM : 400;
  // ~4,8 km/h a pé · ~24 km/h no trânsito urbano curto (mín. 2 min de carro)
  const walkOneWay = Math.max(1, Math.round(meters / 80));
  const driveOneWay = Math.max(2, Math.round(meters / 400));
  const queue = Math.max(0, Number(place.waitMinutes) || 0);
  const meal = estimateMealMinutes(place);
  const totalWalk = walkOneWay * 2 + queue + meal;
  const totalDrive = driveOneWay * 2 + queue + meal;
  return {
    walkOneWay,
    driveOneWay,
    queue,
    meal,
    totalWalk,
    totalDrive,
  };
}

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z" />
        </svg>
      )}
    </button>
  );
}

function sortRestaurants(list, sortBy) {
  const next = [...list];
  next.sort((a, b) => {
    const aClosed = a.openNow === false ? 1 : 0;
    const bClosed = b.openNow === false ? 1 : 0;
    if (aClosed !== bClosed) return aClosed - bClosed;
    if (sortBy === "distance") {
      const d = (a.distanceM ?? 99999) - (b.distanceM ?? 99999);
      if (d !== 0) return d;
      return (a.waitMinutes ?? 99) - (b.waitMinutes ?? 99);
    }
    const w = (a.waitMinutes ?? 99) - (b.waitMinutes ?? 99);
    if (w !== 0) return w;
    return (a.distanceM ?? 99999) - (b.distanceM ?? 99999);
  });
  return next;
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isPartner = Boolean(user?.partnerPlaceId || user?.role === "partner");
  const { coords, error: geoError, loading: geoLoading, request } = useGeolocation();

  const [maxDistance, setMaxDistance] = useState(1500);
  const [maxWait, setMaxWait] = useState("");
  const [sortBy, setSortBy] = useState("wait");
  const [cuisineType, setCuisineType] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState("");
  const [restaurants, setRestaurants] = useState([]);
  const [place, setPlace] = useState(null);
  const [meta, setMeta] = useState({ warning: null, source: null });
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [theme, setTheme] = useState(getInitialTheme);
  const [panel, setPanel] = useState("lista"); // lista | fav | hist | chat | conta
  const [menuOpen, setMenuOpen] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 861px)").matches : true
  );

  const MENU_ITEMS = [
    { id: "chat", label: "Assistente", highlight: true },
    { id: "lista", label: "Explorar" },
    { id: "fav", label: "Favoritos" },
    { id: "hist", label: "Histórico" },
  ];
  const [menu, setMenu] = useState(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [detailPanel, setDetailPanel] = useState(null); // null | "menu" | "feedback"
  const [favSelectedId, setFavSelectedId] = useState(null);
  const [histSelectedId, setHistSelectedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [placeFeedback, setPlaceFeedback] = useState(null);
  const [fbRating, setFbRating] = useState(4);
  const [fbWait, setFbWait] = useState("");
  const [fbComment, setFbComment] = useState("");
  const [fbSaving, setFbSaving] = useState(false);
  const [goingNow, setGoingNow] = useState(false);
  const extras = useUserExtras();

  useEffect(() => {
    if (location.state?.panel) {
      setPanel(location.state.panel);
    }
  }, [location.state]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (message) => setToast({ id: Date.now(), message });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  useEffect(() => {
    request();
  }, [request]);

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/geo/reverse?lat=${coords.lat}&lng=${coords.lng}`,
          { credentials: "include" }
        );
        const data = await res.json();
        if (!cancelled && data.place) setPlace(data.place);
      } catch {
        /* keep previous / fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coords]);

  const fetchRestaurants = useCallback(async () => {
    if (!coords) return;
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        lat: String(coords.lat),
        lng: String(coords.lng),
        radius: String(maxDistance),
        maxDistance: String(maxDistance),
        selfService: cuisineType === "self_service" ? "1" : "0",
      });
      if (maxWait) params.set("maxWait", maxWait);
      if (cuisineType && cuisineType !== "all") params.set("cuisineType", cuisineType);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (minRating) params.set("minRating", minRating);

      const res = await fetch(`/api/restaurants/nearby?${params}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao buscar restaurantes");

      const list = sortRestaurants(data.restaurants || [], sortBy);
      setRestaurants(list);
      setPlace(data.place || null);
      setMeta({
        warning: data.warning || null,
        source: data.source || null,
      });
      setSelectedId((prev) => {
        if (prev && list.some((r) => r.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
      setMenu(null);
    } catch (err) {
      setFetchError(err.message);
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }, [coords, maxDistance, maxWait, sortBy, cuisineType, maxPrice, minRating]);

  // Busca automática só quando a localização muda; filtros exigem clicar em Buscar
  useEffect(() => {
    if (!coords) return;
    fetchRestaurants();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional: não refetch ao mudar filtro
  }, [coords]);

  const selected = useMemo(
    () => restaurants.find((r) => r.id === selectedId) || null,
    [restaurants, selectedId]
  );

  const lunchRoute = useMemo(() => computeLunchRoute(selected), [selected]);

  useEffect(() => {
    if (!selected?.id) {
      setPlaceFeedback(null);
      setDetailPanel(null);
      return undefined;
    }
    let cancelled = false;
    setPlaceFeedback(null);
    setDetailPanel(null);
    setMenu(null);
    fetchPlacePage(selected.id)
      .then((page) => {
        if (cancelled) return;
        setPlaceFeedback(page);
        if (page.mine) {
          setFbRating(page.mine.rating || 4);
          setFbWait(page.mine.waitMinutes != null ? String(page.mine.waitMinutes) : "");
          setFbComment(page.mine.comment || "");
        } else {
          setFbRating(4);
          setFbWait("");
          setFbComment("");
        }
      })
      .catch(() => {
        if (!cancelled) setPlaceFeedback({ reviewCount: 0, avgRating: null, reviews: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  const favPlaces = useMemo(
    () =>
      extras.favorites
        .filter((f) => f.lat != null && f.lng != null)
        .map((f) => ({
          id: f.placeId,
          name: f.placeName,
          lat: Number(f.lat),
          lng: Number(f.lng),
          favorite: true,
        })),
    [extras.favorites]
  );

  const favMapCenter = useMemo(() => {
    const focused = favPlaces.find((f) => f.id === favSelectedId);
    if (focused) return { lat: focused.lat, lng: focused.lng };
    if (coords) return coords;
    if (favPlaces[0]) return { lat: favPlaces[0].lat, lng: favPlaces[0].lng };
    return null;
  }, [favPlaces, favSelectedId, coords]);

  const histPlaces = useMemo(() => {
    const seen = new Set();
    const places = [];
    for (const h of extras.history) {
      if (h.lat == null || h.lng == null) continue;
      const id = h.placeId || `hist-${h.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      places.push({
        id,
        name: h.placeName,
        lat: Number(h.lat),
        lng: Number(h.lng),
        favorite: extras.isFavorite(h.placeId),
      });
    }
    return places;
  }, [extras.history, extras.favorites]);

  const histMapCenter = useMemo(() => {
    const focused = histPlaces.find((p) => p.id === histSelectedId);
    if (focused) return { lat: focused.lat, lng: focused.lng };
    if (coords) return coords;
    if (histPlaces[0]) return { lat: histPlaces[0].lat, lng: histPlaces[0].lng };
    return null;
  }, [histPlaces, histSelectedId, coords]);

  // Só limpa a seleção se o favorito deixou de existir — não reabre automaticamente
  useEffect(() => {
    if (!favSelectedId) return;
    const stillThere = extras.favorites.some(
      (f) => String(f.placeId ?? f.placeid) === String(favSelectedId)
    );
    if (!stillThere) setFavSelectedId(null);
  }, [extras.favorites, favSelectedId]);

  useEffect(() => {
    if (panel !== "hist") return;
    if (histSelectedId && histPlaces.some((p) => p.id === histSelectedId)) return;
    setHistSelectedId(histPlaces[0]?.id || null);
  }, [panel, histPlaces, histSelectedId]);

  const firstName = user?.name?.split(" ")[0] || "você";
  const whereAddress =
    place?.line || place?.short || (coords ? "Localizando endereço…" : "Aguardando localização");

  const goPanel = (id) => {
    setPanel(id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 860px)").matches) {
      setMenuOpen(false);
    }
  };

  const selectedFavPlace = useMemo(() => {
    if (!favSelectedId) return null;
    const fromExplore = restaurants.find((r) => String(r.id) === String(favSelectedId));
    if (fromExplore) return fromExplore;
    const fav = extras.favorites.find(
      (f) => String(f.placeId ?? f.placeid) === String(favSelectedId)
    );
    return fav ? placeFromFavorite(fav, coords) : null;
  }, [favSelectedId, restaurants, extras.favorites, coords]);

  const favLunchRoute = useMemo(
    () => computeLunchRoute(selectedFavPlace),
    [selectedFavPlace]
  );

  const toggleFavoriteCard = (placeId) => {
    setFavSelectedId((prev) => (prev === placeId ? null : placeId));
  };

  return (
    <>
      <style>{css}</style>
      <div className={`app-page ${menuOpen ? "is-menu-open" : "is-menu-closed"} ${panel === "chat" ? "is-assistant" : ""}`}>
        {toast && (
          <div className="toast" role="status" aria-live="polite">
            {toast.message}
          </div>
        )}
        <aside className="side-rail" aria-label="Menu lateral">
          <div className="side-rail-head">
            <Link to="/" className="side-brand" aria-label="FilaZero — início">
              <span className="brand-mark" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="13" r="8" />
                  <path d="M12 9v4l2.5 1.5M9 2h6" />
                </svg>
              </span>
              <span className="brand-text">
                Fila<b>Zero</b>
              </span>
          </Link>
            <button
              type="button"
              className="menu-close"
              onClick={() => setMenuOpen(false)}
              aria-label="Fechar menu"
              title="Fechar menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <nav id="side-rail-nav" className="side-rail-nav">
            {MENU_ITEMS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`side-rail-item ${panel === t.id ? "is-active" : ""} ${t.highlight ? "is-ai" : ""}`}
                onClick={() => goPanel(t.id)}
                title={t.label}
              >
                <span className="side-rail-item-label">{t.label}</span>
                {t.highlight ? <span className="side-rail-badge">IA</span> : null}
              </button>
            ))}
          </nav>

          <div className="side-rail-foot">
            <button
              type="button"
              className={`side-rail-item ${panel === "conta" ? "is-active" : ""}`}
              onClick={() => goPanel("conta")}
            >
              Minha conta
            </button>
            {isPartner ? (
              <Link to="/parceiro" className="side-rail-item">
                Painel restaurante
              </Link>
            ) : (
              <Link to="/login?mode=register&tipo=restaurante" className="side-rail-item">
                Sou restaurante
              </Link>
            )}
            <button type="button" className="side-rail-logout" onClick={logout}>
              Sair
            </button>
          </div>
        </aside>

        {menuOpen && (
          <button
            type="button"
            className="menu-scrim"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
          />
        )}

        <div className="app-shell">
          <header className="app-header">
            <div className="header-inner">
              <div className="header-left">
                {!menuOpen && (
                  <button
                    type="button"
                    className="menu-open-btn"
                    onClick={() => setMenuOpen(true)}
                    aria-label="Abrir menu"
                    title="Abrir menu"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 7h16M4 12h16M4 17h16" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="header-right">
                <div className="loc-chip" title={whereAddress}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                  <span className="loc-chip-text">
                    {geoLoading ? "Localizando…" : whereAddress}
                  </span>
                </div>

                <ThemeToggle theme={theme} onToggle={toggleTheme} />

                <button
                  type="button"
                  className="user-chip"
                  title={user?.email || user?.name || ""}
                  onClick={() => goPanel("conta")}
                >
                  {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="avatar" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="avatar-fallback" aria-hidden="true">
                      {(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}
                    </span>
            )}
                  <span className="user-name">Olá, {firstName}</span>
            </button>
              </div>
          </div>
        </header>

        <main className="app-main">
            {panel === "conta" && (
              <AccountPanel showRestaurant={isPartner} />
            )}

            {panel === "fav" && (
              <section className="fav-page" aria-label="Favoritos">
                <div className="page-intro">
                  <div className="intro-copy">
                    <h1>Favoritos</h1>
                    <p className="lead">Lista dos lugares salvos — use o mapa para localizar.</p>
                  </div>
            </div>

                <div className="fav-workspace">
                  <ul className="fav-list">
                    {extras.favorites.length === 0 && (
                      <li className="empty">Nenhum favorito ainda. Favorite um restaurante em Explorar.</li>
                    )}
                    {extras.favorites.map((f, index) => {
                      const placeId = f.placeId ?? f.placeid;
                      const placeName = f.placeName ?? f.placename ?? "Restaurante";
                      const placeAddress = f.placeAddress ?? f.placeaddress;
                      const hasCoords = f.lat != null && f.lng != null;
                      const expanded = favSelectedId === placeId;
                      const detail = expanded ? selectedFavPlace : null;
                      return (
                        <li
                          key={f.id != null ? `fav-${f.id}` : `fav-${placeId}-${index}`}
                          className={`fav-row ${expanded ? "is-selected is-expanded" : ""}`}
                        >
                          <div className="fav-row-top">
                            <button
                              type="button"
                              className="fav-row-main"
                              aria-expanded={expanded}
                              aria-label={expanded ? `Fechar ${placeName}` : `Abrir ${placeName}`}
                              onClick={() => toggleFavoriteCard(placeId)}
                            >
                              <strong>★ {placeName}</strong>
                              <span>{placeAddress || "—"}</span>
                            </button>
                            <div className="fav-row-actions">
                              <button
                                type="button"
                                className="fav-icon-btn"
                                title={hasCoords ? "Ver no mapa" : "Sem localização salva"}
                                aria-label={`Ver ${placeName} no mapa`}
                                disabled={!hasCoords}
                                onClick={() => setFavSelectedId(placeId)}
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" />
                                  <circle cx="12" cy="10" r="2.5" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                className="fav-remove-btn"
                                onClick={async () => {
                                  try {
                                    await extras.toggleFavorite({
                                      id: placeId,
                                      name: placeName,
                                      address: placeAddress,
                                      lat: f.lat,
                                      lng: f.lng,
                                    });
                                    if (favSelectedId === placeId) setFavSelectedId(null);
                                    showToast("Removido dos favoritos");
                                  } catch (err) {
                                    showToast(err.message || "Não foi possível remover");
                                  }
                                }}
                              >
                                Remover
                              </button>
                            </div>
                          </div>

                          {expanded && detail && (
                            <div className="fav-row-detail">
                              <p className="detail-kicker">Favorito</p>
                              <h2>{detail.name}</h2>
                              <p className="detail-addr">{detail.address}</p>
                              <ul className="detail-meta">
                                <li>
                                  <strong>Deslocamento</strong>
                                  <span>
                                    {detail.distanceLabel}
                                    {favLunchRoute
                                      ? ` · ${favLunchRoute.walkOneWay} min a pé · ${favLunchRoute.driveOneWay} min de carro`
                                      : detail.walkLabel
                                        ? ` · ${detail.walkLabel}`
                                        : ""}
                                  </span>
                                </li>
                                <li>
                                  <strong>Espera</strong>
                                  <span>
                                    {detail.openNow === false
                                      ? "Fechado agora"
                                      : `~${detail.waitMinutes ?? "—"} min · ${detail.waitLabel || "Estimativa"}`}
                                  </span>
                                </li>
                                <li>
                                  <strong>Tipo</strong>
                                  <span>{detail.cuisineTypeLabel || "Restaurante"}</span>
                                </li>
                                <li>
                                  <strong>Preço / nota</strong>
                                  <span>
                                    {detail.priceLabel || "—"} · ★ {detail.rating ?? "—"}
                                  </span>
                                </li>
                              </ul>

                              {favLunchRoute && (
                                <div className="lunch-route fav-lunch-route" aria-label="Rota do Almoço Rápido">
                                  <div className="lunch-route-head">
                                    <p className="lunch-route-kicker">Diferencial FilaZero</p>
                                    <h3>Rota do Almoço Rápido</h3>
                                  </div>
                                  <div className="lunch-route-totals">
                                    <p className="lunch-route-total">
                                      <em>A pé</em>
                                      <strong>~{favLunchRoute.totalWalk} min</strong>
                                    </p>
                                    <p className="lunch-route-total">
                                      <em>De carro</em>
                                      <strong>~{favLunchRoute.totalDrive} min</strong>
                                    </p>
                                  </div>
                                </div>
                              )}

                              <div className="detail-actions">
                                <button
                                  type="button"
                                  className="btn-primary maps"
                                  disabled={goingNow}
                                  onClick={async () => {
                                    const mapsUrl = buildGoNowUrl(detail, coords);
                                    setGoingNow(true);
                                    try {
                                      await extras.addHistory(detail, "Vou agora");
                                      if (detail.isPartner) {
                                        trackGoNow(detail).catch(() => {});
                                      }
                                      if (mapsUrl) {
                                        window.open(mapsUrl, "_blank", "noopener,noreferrer");
                                        showToast("Rota aberta · depois conta a espera no feedback");
                                      } else {
                                        showToast("Sem coordenadas para abrir a rota");
                                      }
                                    } catch {
                                      if (mapsUrl) {
                                        window.open(mapsUrl, "_blank", "noopener,noreferrer");
                                        showToast("Rota aberta · histórico não salvo");
                                      } else {
                                        showToast("Não foi possível abrir a rota");
                                      }
                                    } finally {
                                      setGoingNow(false);
                                    }
                                  }}
                                >
                                  {goingNow ? "Abrindo…" : "Vou agora"}
                                </button>
                                <button
                                  type="button"
                                  className="btn-nav"
                                  onClick={async () => {
                                    try {
                                      const mode = await sharePlace(detail);
                                      showToast(
                                        mode === "copied" ? "Link copiado" : "Compartilhado"
                                      );
                                    } catch {
                                      showToast("Não foi possível compartilhar");
                                    }
                                  }}
                                >
                                  Compartilhar
                                </button>
                                <a
                                  className="btn-nav"
                                  href={
                                    detail.websiteUrl ||
                                    detail.mapsPlaceUrl ||
                                    detail.mapsUrl ||
                                    "#"
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {detail.websiteUrl ? "Site do lugar" : "Ver no Google"}
                                </a>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  <div className="fav-map-panel">
                    <NearbyMap
                      center={favMapCenter}
                      restaurants={favPlaces}
                      selectedId={favSelectedId}
                      onSelect={setFavSelectedId}
                      favoriteIds={favPlaces.map((f) => f.id)}
                      showRadius={false}
                      showYou={Boolean(coords)}
                      emptyLabel="Salve um favorito com localização para ver no mapa."
                    />
              </div>
            </div>
          </section>
            )}

            {panel === "hist" && (
              <section className="hist-page" aria-label="Histórico">
                <div className="page-intro">
                  <div className="intro-copy">
                    <h1>Histórico</h1>
                    <p className="lead">Onde você já foi — use “Vou agora” em Explorar.</p>
                  </div>
                </div>

                <div className="hist-workspace">
                  <ul className="hist-list">
                    {extras.history.length === 0 && (
                      <li className="empty">Sem histórico ainda. Use “Vou agora” em Explorar.</li>
                    )}
                    {extras.history.map((h) => {
                      const placeKey = h.placeId || `hist-${h.id}`;
                      const hasCoords = h.lat != null && h.lng != null;
                      const visited = new Date(h.visitedAt);
                      const when = visited.toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      return (
                        <li
                          key={h.id}
                          className={`hist-row ${histSelectedId === placeKey ? "is-selected" : ""}`}
                        >
                          <div className="hist-row-mark" aria-hidden="true">
                            <span />
                          </div>
                          <div className="hist-row-info">
                            <strong>{h.placeName}</strong>
                            <span className="hist-row-addr">{h.placeAddress || "Endereço não informado"}</span>
                            <span className="hist-row-meta">
                              <em>{h.note || "Visita"}</em>
                              <time dateTime={visited.toISOString()}>{when}</time>
                            </span>
                          </div>
                          <div className="hist-row-actions">
                            <button
                              type="button"
                              className="fav-icon-btn"
                              title={hasCoords ? "Ver no mapa" : "Sem localização salva"}
                              aria-label={`Ver ${h.placeName} no mapa`}
                              disabled={!hasCoords}
                              onClick={() => setHistSelectedId(placeKey)}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" />
                                <circle cx="12" cy="10" r="2.5" />
                              </svg>
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="hist-map-panel">
                    <NearbyMap
                      center={histMapCenter}
                      restaurants={histPlaces}
                      selectedId={histSelectedId}
                      onSelect={setHistSelectedId}
                      favoriteIds={histPlaces.filter((p) => p.favorite).map((p) => p.id)}
                      showRadius={false}
                      showYou={Boolean(coords)}
                      emptyLabel="Registre uma visita com localização para ver no mapa."
                    />
                  </div>
                </div>
              </section>
            )}

            {panel === "chat" && (
              <section className="assistant-page" aria-label="Assistente">
                <ChatAssistant restaurants={restaurants} status={extras.assistant} />
              </section>
            )}

            {panel === "lista" && (
              <>
                <section className="page-intro">
                  <div className="intro-copy">
                    <h1>Onde almoçar agora?</h1>
                    <p className="lead">
                      Compare distância e espera perto de você — sem chegar e descobrir fila enorme.
                    </p>
                  </div>
                </section>

                <section className="toolbar" aria-label="Filtros">
                  <div className="toolbar-fields">
                    <label className="field">
              Distância
              <select value={maxDistance} onChange={(e) => setMaxDistance(Number(e.target.value))}>
                {DISTANCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

                    <label className="field">
                      Tipo
                      <select value={cuisineType} onChange={(e) => setCuisineType(e.target.value)}>
                        {CUISINE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
              Espera máx.
              <select value={maxWait} onChange={(e) => setMaxWait(e.target.value)}>
                {WAIT_OPTIONS.map((o) => (
                  <option key={o.label} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

                    <label className="field">
                      Preço
                      <select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}>
                        {PRICE_OPTIONS.map((o) => (
                          <option key={o.label} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      Avaliação
                      <select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
                        {RATING_OPTIONS.map((o) => (
                          <option key={o.label} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      Ordenar por
                      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                        {SORT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
            </div>

                  <button
                    type="button"
                    className="btn-search"
                    onClick={fetchRestaurants}
                    disabled={!coords || loading}
                  >
                    {loading ? "Buscando…" : "Buscar"}
                  </button>
          </section>

                {(geoError || meta.warning || fetchError) && (
                  <div className="banners">
          {geoError && <p className="banner error">{geoError}</p>}
          {meta.warning && <p className="banner warn">{meta.warning}</p>}
          {fetchError && <p className="banner error">{fetchError}</p>}
                  </div>
                )}

                <section className="workspace">
                  <div className="side-panel">
            {selected && (
            <aside className="detail">
                          <p className="detail-kicker">Selecionado</p>
                  <h2>{selected.name}</h2>
                  <p className="detail-addr">{selected.address}</p>
                  <ul className="detail-meta">
                    <li>
                      <strong>Deslocamento</strong>
                      <span>
                        {selected.distanceLabel}
                        {lunchRoute
                          ? ` · ${lunchRoute.walkOneWay} min a pé · ${lunchRoute.driveOneWay} min de carro`
                          : ` · ${selected.walkLabel}`}
                      </span>
                    </li>
                    <li>
                      <strong>Espera</strong>
                      <span>
                        {selected.openNow === false
                          ? "Fechado agora"
                          : `~${selected.waitMinutes} min · ${selected.waitLabel}`}
                        {selected.isPartner && selected.waitUpdatedAt && selected.openNow !== false
                          ? ` · atualizado ${new Date(selected.waitUpdatedAt).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          : selected.isPartner && selected.openNow !== false
                            ? " · parceiro"
                            : ""}
                      </span>
                    </li>
                    {selected.isPartner && selected.capacityLabel ? (
                      <li>
                        <strong>Lugares</strong>
                        <span>{selected.capacityLabel}</span>
                      </li>
                    ) : null}
                    {selected.isPartner && selected.hoursLabel ? (
                      <li>
                        <strong>Horário</strong>
                        <span>{selected.hoursLabel}</span>
                      </li>
                    ) : null}
                    <li>
                              <strong>Tipo</strong>
                              <span>{selected.cuisineTypeLabel || "Restaurante"}</span>
                            </li>
                            <li>
                              <strong>Preço / nota</strong>
                      <span>
                                {selected.priceLabel || "—"} · ★ {selected.rating ?? "—"}
                      </span>
                    </li>
                  </ul>

                          {lunchRoute && (
                            <div className="lunch-route" aria-label="Rota do Almoço Rápido">
                              <div className="lunch-route-head">
                                <p className="lunch-route-kicker">Diferencial FilaZero</p>
                                <h3>Rota do Almoço Rápido</h3>
                                <p className="lunch-route-lead">
                                  O Maps só calcula o deslocamento. Aqui entra o tempo total da
                                  experiência — a pé ou de carro.
                                </p>
                              </div>
                              <div className="lunch-route-totals">
                                <p className="lunch-route-total">
                                  <em>A pé</em>
                                  <strong>~{lunchRoute.totalWalk} min</strong>
                                  <span>tempo total</span>
                                </p>
                                <p className="lunch-route-total">
                                  <em>De carro</em>
                                  <strong>~{lunchRoute.totalDrive} min</strong>
                                  <span>tempo total</span>
                                </p>
                              </div>
                              <ul className="lunch-route-breakdown">
                                {[
                                  {
                                    key: "ida",
                                    label: "Ida",
                                    value: `${lunchRoute.walkOneWay} min a pé · ${lunchRoute.driveOneWay} min carro`,
                                  },
                                  {
                                    key: "fila",
                                    label: "Tempo na fila",
                                    value: `${lunchRoute.queue} min`,
                                  },
                                  {
                                    key: "refeicao",
                                    label: "Tempo de refeição",
                                    value: `${lunchRoute.meal} min`,
                                  },
                                  {
                                    key: "volta",
                                    label: "Volta",
                                    value: `${lunchRoute.walkOneWay} min a pé · ${lunchRoute.driveOneWay} min carro`,
                                  },
                                ].map((row) => (
                                  <li key={row.key}>
                                    <span>{row.label}</span>
                                    <strong>{row.value}</strong>
                                  </li>
                                ))}
                              </ul>
                              <p className="lunch-route-formula">
                                Total = ida + fila + refeição + volta (pé ou carro)
                              </p>
                            </div>
                          )}

                          <div className="detail-actions">
                            <button
                              type="button"
                              className="btn-primary maps"
                              disabled={goingNow}
                              onClick={async () => {
                                const mapsUrl = buildGoNowUrl(selected, coords);
                                setGoingNow(true);
                                try {
                                  await extras.addHistory(selected, "Vou agora");
                                  if (selected.isPartner) {
                                    trackGoNow(selected).catch(() => {});
                                  }
                                  if (mapsUrl) {
                                    window.open(mapsUrl, "_blank", "noopener,noreferrer");
                                  } else {
                                    showToast("Sem coordenadas para abrir a rota");
                                    return;
                                  }
                                  showToast("Rota aberta · depois conta a espera no feedback");
                                } catch {
                                  if (mapsUrl) {
                                    window.open(mapsUrl, "_blank", "noopener,noreferrer");
                                    showToast("Rota aberta · histórico não salvo");
                                  } else {
                                    showToast("Não foi possível abrir a rota");
                                  }
                                } finally {
                                  setGoingNow(false);
                                }
                              }}
                            >
                              {goingNow ? "Abrindo…" : "Vou agora"}
                            </button>
                            <button
                              type="button"
                              className="btn-nav"
                              onClick={async () => {
                                const wasFav = extras.isFavorite(selected.id);
                                try {
                                  await extras.toggleFavorite(selected);
                                  showToast(wasFav ? "Removido dos favoritos" : "Salvo nos favoritos");
                                } catch (err) {
                                  showToast(err.message || "Não foi possível favoritar");
                                }
                              }}
                            >
                              {extras.isFavorite(selected.id) ? "Remover favorito" : "Favoritar"}
                            </button>
                            <button
                              type="button"
                              className="btn-nav"
                              onClick={async () => {
                                try {
                                  const mode = await sharePlace(selected);
                                  showToast(
                                    mode === "copied" ? "Link copiado" : "Compartilhado"
                                  );
                                } catch {
                                  showToast("Não foi possível compartilhar");
                                }
                              }}
                            >
                              Compartilhar
                            </button>
                            <a
                              className="btn-nav"
                              href={selected.websiteUrl || selected.mapsPlaceUrl || selected.mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {selected.websiteUrl ? "Site do lugar" : "Ver no Google"}
                            </a>
                            <button
                              type="button"
                              className={`btn-nav ${detailPanel === "menu" ? "is-open" : ""}`}
                              disabled={menuLoading}
                              aria-expanded={detailPanel === "menu"}
                              onClick={async () => {
                                if (detailPanel === "menu") {
                                  setDetailPanel(null);
                                  return;
                                }
                                setDetailPanel("menu");
                                if (menu) return;
                                setMenuLoading(true);
                                try {
                                  setMenu(await fetchMenu(selected));
                                } catch (err) {
                                  setMenu({ items: [], error: err.message });
                                } finally {
                                  setMenuLoading(false);
                                }
                              }}
                            >
                              {menuLoading
                                ? "Carregando…"
                                : detailPanel === "menu"
                                  ? "Fechar cardápio"
                                  : "Ver cardápio"}
                            </button>
                            <button
                              type="button"
                              className={`btn-nav ${detailPanel === "feedback" ? "is-open" : ""}`}
                              aria-expanded={detailPanel === "feedback"}
                              onClick={() => {
                                setDetailPanel((prev) => (prev === "feedback" ? null : "feedback"));
                              }}
                            >
                              {detailPanel === "feedback" ? "Fechar feedback" : "Dar feedback"}
                            </button>
                          </div>

                          {detailPanel === "feedback" && (
                            <div className="feedback-box">
                              <div className="feedback-head">
                                <p className="menu-title">Feedback</p>
                                <span className="feedback-avg">
                                  {placeFeedback?.avgRating != null
                                    ? `★ ${Number(placeFeedback.avgRating).toFixed(1)} · ${placeFeedback.reviewCount} avaliação${placeFeedback.reviewCount === 1 ? "" : "ões"}`
                                    : "Sem avaliações ainda"}
                                </span>
                              </div>
                              <form
                                className="feedback-form"
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  setFbSaving(true);
                                  try {
                                    const next = await submitPlaceFeedback(selected, {
                                      rating: fbRating,
                                      waitMinutes: fbWait === "" ? null : fbWait,
                                      comment: fbComment,
                                    });
                                    setPlaceFeedback(next);
                                    showToast(
                                      placeFeedback?.mine
                                        ? "Feedback atualizado"
                                        : "Feedback enviado"
                                    );
                                  } catch (err) {
                                    showToast(err.message || "Falha ao enviar feedback");
                                  } finally {
                                    setFbSaving(false);
                                  }
                                }}
                              >
                                <label>
                                  Nota
                                  <select
                                    value={fbRating}
                                    onChange={(e) => setFbRating(Number(e.target.value))}
                                  >
                                    {[5, 4, 3, 2, 1].map((n) => (
                                      <option key={n} value={n}>
                                        {n} estrela{n === 1 ? "" : "s"}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label>
                                  Espera real (min)
                                  <input
                                    type="number"
                                    min={0}
                                    max={180}
                                    placeholder="Ex.: 10"
                                    value={fbWait}
                                    onChange={(e) => setFbWait(e.target.value)}
                                  />
                                </label>
                                <label className="feedback-full">
                                  Comentário
                                  <textarea
                                    rows={2}
                                    maxLength={800}
                                    placeholder="Fila, atendimento, comida…"
                                    value={fbComment}
                                    onChange={(e) => setFbComment(e.target.value)}
                                  />
                                </label>
                                <button type="submit" className="btn-nav" disabled={fbSaving}>
                                  {fbSaving
                                    ? "Enviando…"
                                    : placeFeedback?.mine
                                      ? "Atualizar feedback"
                                      : "Enviar feedback"}
                                </button>
                              </form>
                              <ul className="feedback-list">
                                {mergeFeedbacksWithMocks(placeFeedback?.reviews)
                                  .slice(0, 5)
                                  .map((r, index) => (
                                    <li
                                      key={r.isMock ? `mock-${r.id}` : `fb-${r.id ?? index}`}
                                      className={r.isMock ? "is-mock" : ""}
                                    >
                                      <strong>
                                        {(r.userName || "Alguém").split(/\s+/)[0]} · ★ {r.rating}
                                        {r.isMock ? (
                                          <em className="fb-tag">Exemplo</em>
                                        ) : (
                                          <em className="fb-tag real">Real</em>
                                        )}
                                      </strong>
                                      {r.waitMinutes != null && (
                                        <span>espera ~{r.waitMinutes} min</span>
                                      )}
                                      {r.comment ? <p>{r.comment}</p> : null}
                                    </li>
                                  ))}
                              </ul>
          </div>
                          )}

                          {detailPanel === "menu" && (
                            <div className="menu-box">
                              <div className="menu-head">
                                <p className="menu-title">Cardápio do dia</p>
                                {menu?.menuDate && (
                                  <span className="menu-date">
                                    {new Date(`${menu.menuDate}T12:00:00`).toLocaleDateString("pt-BR")}
                                  </span>
                                )}
                              </div>
                              {menuLoading && !menu ? (
                                <p className="fine">Carregando cardápio…</p>
                              ) : menu?.error ? (
                                <p className="fine">{menu.error}</p>
                              ) : (
                                <ul className="menu-grid">
                                  {(menu?.items || []).map((item, index) => {
                                    const dish =
                                      typeof item === "string"
                                        ? { id: index, name: item, description: "", priceLabel: "—", image: null }
                                        : item;
                                    return (
                                      <li key={dish.id || `${dish.name}-${index}`} className="menu-item">
                                        <div className="menu-item-media">
                                          {dish.image ? (
                                            <img src={dish.image} alt="" loading="lazy" />
                                          ) : (
                                            <span className="menu-item-fallback" aria-hidden="true">
                                              {String(dish.name || "?").slice(0, 1)}
                                            </span>
                                          )}
                                        </div>
                                        <div className="menu-item-body">
                                          <strong>{dish.name}</strong>
                                          {dish.description ? <span>{dish.description}</span> : null}
                                          <em>{dish.priceLabel || "Consulte"}</em>
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          )}
            </aside>
            )}

                    {loading || geoLoading ? (
                      <div className="list-loading" role="status" aria-live="polite" aria-label="Buscando restaurantes">
                        <span className="list-spinner" aria-hidden="true" />
                        <span>Buscando restaurantes…</span>
          </div>
                    ) : (
            <ul className="rest-list">
                      {restaurants.length === 0 && coords && !fetchError && (
                <li className="empty">
                          Nada encontrado com esses filtros. Amplie a distância ou mude o tipo.
                </li>
              )}
                      {!coords && (
                        <li className="empty">Ative a localização para ver restaurantes perto de você.</li>
                      )}
              {restaurants.map((r, index) => (
                <li key={r.id != null ? String(r.id) : `rest-${index}`}>
                  <button
                    type="button"
                    className={`rest ${selectedId === r.id ? "is-selected" : ""}`}
                            onClick={() => {
                              setSelectedId(r.id);
                              setMenu(null);
                              setDetailPanel(null);
                            }}
                  >
                    <div className="rest-info">
                              <strong>
                                {extras.isFavorite(r.id) ? "★ " : ""}
                                {r.name}
                              </strong>
                      <span>
                        {r.distanceLabel} · {r.walkLabel}
                                {r.cuisineTypeLabel ? ` · ${r.cuisineTypeLabel}` : ""}
                                {r.priceLabel ? ` · ${r.priceLabel}` : ""}
                                {r.rating != null ? ` · ★ ${r.rating}` : ""}
                      </span>
                    </div>
                    <div className="rest-status">
                              <span className={`badge badge-${r.waitLevel || "mid"}`}>{r.waitLabel}</span>
                              {r.openNow === false ? (
                                <span className="wait">Fora do expediente</span>
                              ) : (
                      <span className="wait">~{r.waitMinutes} min</span>
                              )}
                              {r.capacityLabel ? (
                                <span className="wait-updated">{r.capacityLabel}</span>
                              ) : null}
                              {r.hoursLabel ? (
                                <span className="wait-updated">{r.hoursLabel}</span>
                              ) : null}
                              {r.isPartner && r.waitUpdatedAt && r.openNow !== false ? (
                                <span className="wait-updated">
                                  Atualizado{" "}
                                  {new Date(r.waitUpdatedAt).toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              ) : r.isPartner && !r.capacityLabel ? (
                                <span className="wait-updated">Parceiro FilaZero</span>
                              ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
                    )}
                  </div>

                  <div className="map-panel">
                    <NearbyMap
                      center={coords}
                      restaurants={restaurants}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      radiusM={maxDistance}
                      favoriteIds={extras.favorites.map((f) => f.placeId)}
                    />
                  </div>
                </section>
              </>
            )}
        </main>
        </div>
      </div>
    </>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');

:root{
  --ink:#1F2328; --ink-2:#4B5563; --muted:#6B7280;
  --bg:#FFF9F2; --surface:#fff; --cream:#FFF7EE; --line:#F0E6DA;
  --orange:#FF6B1A; --orange-dark:#E5560A; --yellow:#FFB400;
  --pad-x: clamp(16px, 4vw, 40px);
  --gap: clamp(14px, 2.5vw, 22px);
  --rail-w: 220px;
}
html[data-theme="dark"]{
  --ink:#F3F4F6; --ink-2:#CBD5E1; --muted:#94A3B8;
  --bg:#0F1216; --surface:#171C22; --cream:#1A1F26; --line:#2A313A;
  color-scheme:dark;
}

*{box-sizing:border-box}
.app-page{
  min-height:100vh;font-family:'DM Sans',system-ui,sans-serif;color:var(--ink);
  background:
    radial-gradient(720px 340px at 100% -10%,#FFE2C2 0,transparent 55%),
    radial-gradient(520px 280px at 0% 100%,#FFF0D1 0,transparent 50%),
    var(--bg);
}
html[data-theme="dark"] .app-page{
  background:
    radial-gradient(720px 340px at 100% -10%,rgba(255,107,26,.14) 0,transparent 55%),
    radial-gradient(520px 280px at 0% 100%,rgba(255,180,0,.08) 0,transparent 50%),
    var(--bg);
}

.side-rail{
  position:fixed;top:0;left:0;bottom:0;z-index:50;
  width:var(--rail-w);
  display:flex;flex-direction:column;gap:8px;
  padding:12px 10px;
  background:var(--surface);border-right:1px solid var(--line);
  box-shadow:8px 0 28px -24px rgba(31,35,40,.45);
  transform:translateX(0);
  transition:transform .22s ease, box-shadow .22s ease;
}
.app-page.is-menu-closed .side-rail{
  transform:translateX(-100%);
  box-shadow:none;pointer-events:none;
}
.side-rail-head{
  display:flex;align-items:center;justify-content:space-between;gap:8px;
  margin-bottom:10px;padding:2px 2px 10px;border-bottom:1px solid var(--line);
}
.side-brand{display:inline-flex;align-items:center;gap:8px;text-decoration:none;color:inherit;min-width:0}
.side-brand .brand-text{font-size:1.05rem}
.menu-close{
  display:grid;place-items:center;width:36px;height:36px;flex:none;
  border:1px solid var(--line);border-radius:10px;background:transparent;
  color:var(--ink-2);cursor:pointer;padding:0;
}
.menu-close:hover{border-color:var(--orange);color:var(--orange-dark);background:var(--cream)}
.side-rail-nav{display:flex;flex-direction:column;gap:4px;overflow:auto;flex:1;min-height:0}
.side-rail-item{
  border:0;background:transparent;color:var(--ink-2);border-radius:12px;
  padding:12px 14px;font:inherit;font-size:.95rem;font-weight:600;cursor:pointer;text-align:left;width:100%;
  display:flex;align-items:center;justify-content:space-between;gap:8px;
}
.side-rail-item:hover{background:var(--cream);color:var(--orange-dark)}
.side-rail-item.is-active{background:rgba(255,107,26,.12);color:var(--orange-dark)}
.side-rail-item.is-ai{
  background:linear-gradient(135deg,rgba(255,107,26,.14),rgba(255,180,0,.1));
  border:1px solid rgba(255,107,26,.28);color:var(--orange-dark);margin-bottom:6px;
}
.side-rail-item.is-ai.is-active{
  background:linear-gradient(135deg,rgba(255,107,26,.22),rgba(255,180,0,.16));
  border-color:var(--orange);
}
.side-rail-badge{
  flex:none;font-size:.65rem;font-weight:800;letter-spacing:.04em;
  padding:3px 7px;border-radius:999px;background:var(--orange);color:#fff;
}
.side-rail-foot{
  margin-top:auto;padding-top:10px;border-top:1px solid var(--line);
  display:flex;flex-direction:column;gap:4px;
}
.side-rail-logout{
  border:0;background:transparent;color:#B91C1C;border-radius:12px;
  padding:12px 14px;font:inherit;font-size:.95rem;font-weight:700;cursor:pointer;text-align:left;width:100%;
}
.side-rail-logout:hover{background:#FEE2E2;color:#991B1B}
html[data-theme="dark"] .side-rail-logout{color:#FCA5A5}
html[data-theme="dark"] .side-rail-logout:hover{background:#7F1D1D;color:#FECACA}
.menu-scrim{display:none}

.app-shell{
  min-height:100vh;
  margin-left:var(--rail-w);
  transition:margin-left .22s ease;
  display:flex;flex-direction:column;
}
.app-page.is-menu-closed .app-shell{margin-left:0}
.app-page.is-assistant .app-shell{height:100vh;max-height:100vh;overflow:hidden}
.app-page.is-assistant .app-main{
  flex:1;min-height:0;padding:0;display:flex;flex-direction:column;
}

.app-header{
  position:sticky;top:0;z-index:40;
  background:rgba(255,255,255,.88);backdrop-filter:blur(12px);
  border-bottom:1px solid var(--line);
}
html[data-theme="dark"] .app-header{background:rgba(15,18,22,.9)}
.header-inner{
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  min-height:58px;padding:10px var(--pad-x);width:100%;
}
.header-left{display:flex;align-items:center;min-width:0;min-height:36px}
.menu-open-btn{
  display:grid;place-items:center;width:36px;height:36px;
  border:1px solid var(--line);border-radius:10px;
  background:var(--surface);color:var(--ink-2);cursor:pointer;padding:0;
}
.menu-open-btn:hover{border-color:var(--orange);color:var(--orange-dark);background:var(--cream)}
.brand-mark{
  display:grid;place-items:center;width:30px;height:30px;border-radius:9px;
  background:linear-gradient(135deg,var(--orange),var(--yellow));
}
.brand-text{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:1.15rem;letter-spacing:-.03em}
.brand-text b{color:var(--orange)}
.header-right{
  display:flex;align-items:center;gap:8px;
  flex:none;margin-left:auto;justify-content:flex-end;min-width:0;
}
.loc-chip{
  display:none;align-items:center;gap:6px;width:max-content;max-width:none;
  padding:7px 12px;border-radius:999px;border:1px solid var(--line);
  background:var(--surface);color:var(--ink-2);font:inherit;font-size:.82rem;font-weight:600;
  cursor:default;user-select:none;pointer-events:none;flex:none;
}
.loc-chip svg{flex:none;color:var(--orange)}
.loc-chip-text{white-space:nowrap}
.theme-toggle{
  display:grid;place-items:center;width:36px;height:36px;border-radius:10px;
  border:1px solid var(--line);background:transparent;color:var(--ink-2);cursor:pointer;padding:0;
}
.theme-toggle:hover{color:var(--orange-dark);border-color:var(--orange);background:var(--cream)}
.user-chip{
  display:flex;align-items:center;gap:8px;padding:4px 10px 4px 4px;
  border:1px solid var(--line);border-radius:999px;background:var(--surface);font-size:.88rem;
  font:inherit;color:inherit;cursor:pointer;
}
.user-chip:hover{border-color:var(--orange)}
.account-page{width:100%;max-width:none;display:grid;gap:var(--gap);justify-items:stretch}
.account-page .page-intro{margin-bottom:0;justify-content:flex-start;text-align:left}
.account-page .intro-copy{width:100%}
.account-page .lead{max-width:none;margin-inline:0;white-space:normal}
.account-workspace{
  display:grid;gap:var(--gap);align-items:stretch;width:100%;
}
.account-aside{display:grid;gap:var(--gap);align-content:start;min-width:0}
.account-panel{min-width:0;display:grid;align-content:stretch}
.account-profile{
  display:flex;align-items:center;gap:16px;padding:20px 22px;
  background:var(--surface);border:1px solid var(--line);border-radius:18px;width:100%;
}
.account-tabs{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:6px;
  background:var(--cream);border:1px solid var(--line);border-radius:14px;width:100%;
}
.account-tab{
  border:0;background:transparent;color:var(--ink-2);border-radius:10px;
  padding:11px 12px;font:inherit;font-size:.88rem;font-weight:700;cursor:pointer;width:100%;text-align:center;
}
.account-tab:hover{color:var(--orange-dark);background:rgba(255,107,26,.08)}
.account-tab.is-active{background:var(--surface);color:var(--orange-dark);box-shadow:0 1px 0 rgba(31,35,40,.06)}
.account-tab.danger{color:#B91C1C}
.account-tab.danger:hover{color:#991B1B;background:#FEE2E2}
.account-tab.danger.is-active{color:#991B1B;background:#FEE2E2}
html[data-theme="dark"] .account-tab.danger{color:#FCA5A5}
html[data-theme="dark"] .account-tab.danger:hover,
html[data-theme="dark"] .account-tab.danger.is-active{background:#7F1D1D;color:#FECACA}
.account-avatar{
  width:72px;height:72px;border-radius:50%;object-fit:cover;flex:none;
}
.account-avatar.fallback{
  display:grid;place-items:center;background:linear-gradient(135deg,var(--orange),var(--yellow));
  color:#fff;font-weight:800;font-size:1.6rem;
}
.account-profile-copy{min-width:0;display:grid;gap:4px}
.account-profile-copy strong{
  font-family:'Bricolage Grotesque',sans-serif;font-size:1.25rem;letter-spacing:-.02em;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.account-profile-copy > span{font-size:.9rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.account-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.account-tag{
  display:inline-flex;font-style:normal;font-size:.72rem;font-weight:700;
  padding:4px 9px;border-radius:999px;background:var(--cream);color:var(--ink-2);
}
.account-tag.ok{background:rgba(22,163,74,.12);color:#166534}
html[data-theme="dark"] .account-tag.ok{background:#14532D;color:#86EFAC}
.account-card{
  display:grid;gap:14px;padding:clamp(22px,3vw,28px) clamp(22px,3vw,32px);
  background:var(--surface);border:1px solid var(--line);border-radius:18px;width:100%;
  align-content:start;min-height:100%;
}
.account-card-head{display:grid;gap:4px;margin-bottom:2px}
.account-card-head h3{margin:0;font-size:1.1rem}
.account-card-head p{margin:0;font-size:.9rem;color:var(--muted);line-height:1.4}
.account-fields{display:grid;gap:14px}
.account-field-full{grid-column:1/-1}
.account-rest-head{margin-top:8px;padding-top:14px;border-top:1px solid var(--line)}
.account-cep-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.account-cep-msg{font-size:.85rem;font-weight:500;color:var(--muted);font-style:normal}
.account-check{display:flex;align-items:center;gap:8px;font-size:.9rem;font-weight:600;color:var(--ink-2)}
.btn-nav-light{
  border:1.5px solid var(--line);background:transparent;color:var(--ink-2);
  border-radius:12px;min-height:40px;padding:0 14px;font:inherit;font-weight:700;cursor:pointer;
}
.btn-nav-light:hover{border-color:var(--orange);color:var(--orange-dark)}
.account-card label{
  display:grid;gap:6px;font-size:.75rem;font-weight:700;color:var(--muted);
  text-transform:uppercase;letter-spacing:.04em;
}
.account-card input{
  padding:12px 14px;border-radius:12px;border:1.5px solid var(--line);
  font:inherit;font-size:.95rem;font-weight:500;text-transform:none;letter-spacing:0;
  background:var(--bg);color:var(--ink);width:100%;
}
.account-card input:focus{outline:none;border-color:var(--orange);background:var(--surface)}
.account-hint{
  margin:0;padding:10px 12px;border-radius:12px;background:var(--cream);
  font-size:.85rem;color:var(--muted);line-height:1.45;font-weight:500;
}
.account-hint.danger{background:#FEE2E2;color:#991B1B}
html[data-theme="dark"] .account-hint.danger{background:#7F1D1D;color:#FECACA}
.account-msg{margin:0;font-size:.85rem;font-weight:600}
.account-msg.error{color:#991B1B}
.account-msg.ok{color:#166534}
html[data-theme="dark"] .account-msg.error{color:#FCA5A5}
html[data-theme="dark"] .account-msg.ok{color:#86EFAC}
.account-card .btn-search,
.account-card .btn-danger,
.account-card .about-link{width:fit-content;min-width:180px;margin-top:4px;justify-self:start}
.account-card-danger{border-color:#FECACA}
html[data-theme="dark"] .account-card-danger{border-color:#7F1D1D}
.btn-danger{
  border:0;background:#DC2626;color:#fff;border-radius:12px;
  min-height:42px;padding:0 22px;font:inherit;font-size:.95rem;font-weight:700;
  cursor:pointer;
}
.btn-danger:hover:not(:disabled){background:#B91C1C}
.btn-danger:disabled{opacity:.55;cursor:not-allowed}
.about-list{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.about-list li{
  display:grid;gap:4px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--bg);
}
.about-list strong{font-size:.9rem}
.about-list span{font-size:.88rem;color:var(--muted);line-height:1.45}
.about-link{
  display:inline-flex;align-items:center;justify-content:center;
  padding:11px 16px;border-radius:12px;border:1.5px solid var(--orange);
  color:var(--orange-dark);text-decoration:none;font-weight:700;font-size:.9rem;
}
.about-link:hover{background:var(--orange);color:#fff}
.avatar,.avatar-fallback{
  width:28px;height:28px;border-radius:50%;object-fit:cover;flex:none;
}
.avatar-fallback{
  display:grid;place-items:center;background:linear-gradient(135deg,var(--orange),var(--yellow));
  color:#fff;font-weight:700;font-size:.75rem;
}
.user-name{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:var(--ink-2)}
.btn-ghost{
  border:1.5px solid var(--orange);background:transparent;color:var(--orange-dark);
  border-radius:999px;padding:7px 14px;font-weight:600;cursor:pointer;font:inherit;font-size:.85rem;
}
.btn-ghost:hover{background:var(--orange);color:#fff}

.app-main{padding:clamp(20px,3vw,32px) var(--pad-x) clamp(40px,6vw,64px);width:100%}

.page-intro{
  display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:12px 24px;
  margin-bottom:clamp(14px,2vw,20px);
}
.intro-copy h1{
  font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(1.7rem,3.5vw,2.35rem);
  margin:0 0 8px;letter-spacing:-.02em;line-height:1.12;
}
.lead{
  margin:0;color:var(--ink-2);line-height:1.55;font-size:.98rem;
  max-width:none;white-space:nowrap;
}

.toolbar{
  display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;
  padding:14px 16px;background:var(--surface);border:1px solid var(--line);
  border-radius:16px;margin-bottom:var(--gap);
}
.toolbar-fields{
  display:flex;flex-wrap:wrap;align-items:end;gap:12px 14px;flex:1;min-width:0;
}
.field{display:grid;gap:6px;font-size:.75rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.field select{
  min-width:160px;padding:10px 12px;border-radius:12px;border:1.5px solid var(--line);
  font:inherit;font-size:.9rem;font-weight:500;text-transform:none;letter-spacing:0;
  background:var(--surface);color:var(--ink);cursor:pointer;
}
.field select:focus{outline:none;border-color:var(--orange)}
.btn-search{
  border:0;background:var(--orange);color:#fff;border-radius:12px;
  min-height:42px;padding:0 22px;font:inherit;font-size:.95rem;font-weight:700;
  cursor:pointer;box-shadow:0 8px 20px -12px rgba(255,107,26,.8);white-space:nowrap;flex:none;
}
.btn-search:hover:not(:disabled){background:var(--orange-dark)}
.btn-search:disabled{opacity:.65;cursor:not-allowed}

.extra-card{
  display:grid;gap:4px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface);
}
.extra-card strong{font-size:.95rem}
.extra-card span{font-size:.82rem;color:var(--muted)}
.linkish{border:0;background:none;color:var(--orange-dark);font:inherit;font-size:.82rem;font-weight:700;cursor:pointer;padding:0;text-align:left;margin-top:4px}
.assistant-page{
  width:100%;flex:1;min-height:0;display:flex;flex-direction:column;
}
.assistant-shell{
  display:grid;gap:0;flex:1;min-height:0;width:100%;height:100%;
  background:var(--surface);border:0;border-radius:0;overflow:hidden;
}
.assistant-history{
  display:flex;flex-direction:column;justify-content:flex-start;align-items:stretch;
  gap:10px;padding:14px;
  border-bottom:1px solid var(--line);background:var(--cream);min-height:0;
}
.assistant-new{
  border:0;background:var(--orange);color:#fff;border-radius:12px;
  padding:11px 14px;font:inherit;font-size:.9rem;font-weight:700;cursor:pointer;width:100%;
  flex:none;
}
.assistant-new:hover{background:var(--orange-dark)}
.assistant-thread-list{
  list-style:none;margin:0;padding:0;display:flex;flex-direction:column;justify-content:flex-start;
  gap:6px;overflow:auto;max-height:180px;flex:1;min-height:0;align-content:flex-start;
}
.assistant-thread{
  width:100%;border:1px solid transparent;background:var(--surface);color:inherit;
  border-radius:12px;padding:10px 12px;text-align:left;cursor:pointer;font:inherit;
  display:grid;gap:3px;
}
.assistant-thread strong{
  font-size:.86rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.assistant-thread span{font-size:.72rem;color:var(--muted)}
.assistant-thread:hover{border-color:#FFD0AE}
.assistant-thread.is-active{border-color:var(--orange);background:rgba(255,107,26,.08)}
.assistant-main{
  display:flex;flex-direction:column;gap:12px;
  padding:16px clamp(14px,2.5vw,28px) 18px;min-height:0;min-width:0;height:100%;
}
.assistant-main .chat-form{margin-top:auto;padding-top:4px}
.chat-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.assistant-sub{margin:4px 0 0;font-size:.82rem;color:var(--muted);line-height:1.4}
.ai-pill{font-size:.72rem;font-weight:700;padding:4px 8px;border-radius:999px;border:1px solid var(--line);flex:none}
.ai-pill.on{background:rgba(22,163,74,.12);color:#166534}
.ai-pill.off{background:var(--cream);color:var(--muted)}
.assistant-welcome{
  flex:1;display:grid;align-content:start;justify-items:center;gap:10px;
  text-align:center;padding:8px 8px 12px;min-height:0;overflow:auto;
}
.assistant-welcome h2{
  margin:0;font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(1.35rem,2.5vw,1.7rem);
  letter-spacing:-.02em;
}
.assistant-welcome p{margin:0;color:var(--muted);font-size:.92rem}
.suggestion-grid{
  display:flex;flex-wrap:wrap;justify-content:center;gap:10px;
  margin-top:10px;max-width:560px;
}
.suggestion-chip{
  border:1.5px solid var(--line);background:var(--cream);color:var(--ink-2);
  border-radius:999px;padding:10px 14px;font:inherit;font-size:.88rem;font-weight:600;
  cursor:pointer;opacity:0;animation:suggest-in .45s ease forwards;
}
.suggestion-chip:hover:not(:disabled){
  border-color:var(--orange);color:var(--orange-dark);background:rgba(255,107,26,.08);
  transform:translateY(-2px);
}
.suggestion-chip:disabled{opacity:.55;cursor:wait;animation:none}
@keyframes suggest-in{
  from{opacity:0;transform:translateY(12px) scale(.96)}
  to{opacity:1;transform:translateY(0) scale(1)}
}
.chat-log{flex:1;overflow:auto;display:grid;gap:8px;min-height:280px;max-height:none;align-content:start}
.chat-msg{margin:0;padding:10px 12px;border-radius:12px;font-size:.88rem;line-height:1.45}
.chat-msg.user{background:rgba(255,107,26,.12);color:var(--ink);justify-self:end;max-width:90%}
.chat-msg.assistant{background:var(--cream);color:var(--ink-2);max-width:95%}
.chat-msg.is-typing{opacity:.75;font-style:italic}
.chat-form{display:flex;gap:8px}
.chat-form input{flex:1;padding:10px 12px;border-radius:12px;border:1.5px solid var(--line);font:inherit;background:var(--surface);color:var(--ink)}
.chat-form button{border:0;background:var(--orange);color:#fff;border-radius:12px;padding:0 14px;font-weight:700;cursor:pointer}
.menu-more{margin:12px 0 0;font-size:.82rem;color:#94A3B8;line-height:1.45}
.menu-more a{color:var(--yellow);font-weight:700}
.detail-actions{display:grid;gap:8px;margin-bottom:10px}
.btn-nav{
  display:inline-flex;align-items:center;justify-content:center;text-decoration:none;
  border:1.5px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;
  border-radius:999px;padding:10px 14px;font:inherit;font-size:.88rem;font-weight:600;cursor:pointer;
}
.btn-nav:hover{border-color:var(--yellow);color:var(--yellow)}
.btn-nav.is-open{border-color:var(--yellow);color:var(--yellow);background:rgba(255,214,10,.12)}
.toast{
  position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:80;
  padding:12px 18px;border-radius:999px;background:#14171A;color:#fff;
  font-size:.9rem;font-weight:700;box-shadow:0 14px 36px -16px rgba(0,0,0,.55);
  border:1px solid rgba(255,255,255,.08);max-width:min(90vw,360px);text-align:center;
  animation:toast-in .22s ease;
}
@keyframes toast-in{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}
.menu-box{margin-top:10px;padding:12px;border-radius:12px;background:rgba(255,255,255,.06)}
.feedback-box{margin-top:10px;padding:12px;border-radius:12px;background:rgba(255,255,255,.06);display:grid;gap:10px}
.feedback-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 10px}
.feedback-avg{font-size:.78rem;color:#94A3B8}
.feedback-form{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.feedback-form label{
  display:grid;gap:4px;font-size:.68rem;font-weight:700;color:#94A3B8;
  text-transform:uppercase;letter-spacing:.04em;
}
.feedback-full{grid-column:1/-1}
.feedback-form input,.feedback-form select,.feedback-form textarea{
  width:100%;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.14);
  background:rgba(0,0,0,.25);color:#fff;font:inherit;font-size:.85rem;font-weight:500;
  text-transform:none;letter-spacing:0;resize:vertical;
}
.feedback-form button{grid-column:1/-1}
.feedback-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.feedback-list li{
  padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.2);
  border:1px solid rgba(255,255,255,.06);display:grid;gap:2px;
}
.feedback-list li.is-mock{border-style:dashed;opacity:.9}
.feedback-list strong{font-size:.82rem;color:#E5E7EB;display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.feedback-list .fb-tag{
  font-style:normal;font-size:.62rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
  padding:2px 6px;border-radius:999px;background:rgba(255,255,255,.08);color:#94A3B8;
}
.feedback-list .fb-tag.real{background:rgba(134,239,172,.15);color:#86EFAC}
.feedback-list span{font-size:.75rem;color:#94A3B8}
.feedback-list p{margin:4px 0 0;font-size:.82rem;color:#CBD5E1;line-height:1.35}
.menu-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
.menu-title{margin:0;font-size:.78rem;font-weight:700;color:var(--yellow);text-transform:uppercase;letter-spacing:.05em}
.menu-date{font-size:.72rem;color:#94A3B8}
.menu-grid{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.menu-item{
  display:grid;grid-template-columns:80px minmax(0,1fr);gap:10px;align-items:center;
  padding:8px;border-radius:12px;background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.06);
}
.menu-item-media{
  width:80px;height:80px;border-radius:12px;overflow:hidden;background:#1F2328;flex:none;
}
.menu-item-media img{width:100%;height:100%;object-fit:cover;display:block}
.menu-item-fallback{
  display:grid;place-items:center;width:100%;height:100%;
  color:#94A3B8;font-weight:800;font-size:1.2rem;
}
.menu-item-body{display:grid;gap:3px;min-width:0}
.menu-item-body strong{font-size:.9rem;color:#F3F4F6;line-height:1.25}
.menu-item-body span{font-size:.78rem;color:#94A3B8;line-height:1.35}
.menu-item-body em{font-style:normal;font-size:.88rem;font-weight:700;color:var(--yellow);margin-top:2px}

.banners{display:grid;gap:8px;margin-bottom:var(--gap)}
.banner{padding:11px 14px;border-radius:12px;font-size:.9rem;margin:0}
.banner.error{background:#FEE2E2;color:#991B1B}
.banner.warn{background:#FEF3C7;color:#92400E}
html[data-theme="dark"] .banner.error{background:#7F1D1D;color:#FECACA}
html[data-theme="dark"] .banner.warn{background:#78350F;color:#FDE68A}

.workspace{display:grid;gap:var(--gap);align-items:stretch}
.map-panel{
  border-radius:18px;overflow:hidden;border:1px solid var(--line);
  box-shadow:0 16px 36px -28px rgba(31,35,40,.35);background:#E8EEF2;
  min-height:280px;height:100%;display:flex;flex-direction:column;
}
.nearby-map{width:100%;flex:1;min-height:280px;height:100%;z-index:1}
.map-placeholder{
  flex:1;min-height:280px;display:grid;place-items:center;color:var(--muted);font-size:.95rem;padding:24px;text-align:center;
}
.fz-marker{background:transparent;border:0}
.fz-marker span{
  display:block;width:100%;height:100%;border-radius:50%;
  box-shadow:0 2px 8px rgba(0,0,0,.25);border:2px solid #fff;
}
.fz-marker-you span{background:#2563EB}
.fz-marker-rest span{background:var(--orange)}
.fz-marker-rest.is-selected span{background:var(--orange-dark);outline:3px solid rgba(255,107,26,.35)}
.fz-marker-rest.is-fav .fz-fav-dot{
  display:grid;place-items:center;width:100%;height:100%;border-radius:50%;
  background:#FFB400;color:#14171A;font-size:11px;font-weight:800;line-height:1;
  box-shadow:0 2px 8px rgba(0,0,0,.25);border:2px solid #fff;
}
.fz-marker-rest.is-fav.is-selected .fz-fav-dot{outline:3px solid rgba(255,180,0,.4);background:var(--orange)}

.list-page{width:100%;max-width:820px;margin:0 auto}
.list-page-grid{list-style:none;margin:0;padding:0;display:grid;gap:12px}

.fav-page{width:100%}
.fav-workspace{display:grid;gap:var(--gap);align-items:stretch}
.fav-list{list-style:none;margin:0;padding:0;display:grid;gap:10px;align-content:start}
.fav-row{
  display:flex;flex-direction:column;gap:0;
  padding:8px 10px 8px 8px;border:1.5px solid var(--line);border-radius:14px;background:var(--surface);
}
.fav-row.is-selected{border-color:var(--orange);background:var(--cream)}
.fav-row-top{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%}
.fav-row-main{
  min-width:0;flex:1;display:grid;gap:3px;text-align:left;
  border:0;background:transparent;padding:6px 8px;border-radius:10px;
  font:inherit;color:inherit;cursor:pointer;
}
.fav-row-main:hover{background:rgba(255,107,26,.08)}
.fav-row-main:focus-visible{outline:2px solid var(--orange);outline-offset:1px}
.fav-row-main strong{font-size:.95rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fav-row-main span{font-size:.82rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fav-row-actions{display:flex;align-items:center;gap:8px;flex:none}
.fav-row-detail{
  margin-top:8px;padding:12px 10px 8px;border-top:1px solid var(--line);
  display:grid;gap:10px;
}
.fav-row-detail h2{
  margin:0;font-family:'Bricolage Grotesque',sans-serif;font-size:1.15rem;letter-spacing:-.02em;
}
.fav-row-detail .detail-kicker{margin:0}
.fav-row-detail .detail-addr{margin:0}
.fav-row-detail .detail-meta{margin:0}
.fav-lunch-route{margin-top:2px}
.fav-lunch-route .lunch-route-totals{margin-bottom:0}
.fav-icon-btn{
  display:grid;place-items:center;width:38px;height:38px;padding:0;
  border:1px solid var(--line);border-radius:10px;background:var(--cream);
  color:var(--orange-dark);cursor:pointer;
}
.fav-icon-btn:hover:not(:disabled){border-color:var(--orange);background:rgba(255,107,26,.1)}
.fav-icon-btn:disabled{opacity:.4;cursor:not-allowed}
.fav-remove-btn{
  border:1px solid var(--line);background:transparent;color:#B91C1C;
  border-radius:10px;padding:8px 12px;font:inherit;font-size:.82rem;font-weight:700;cursor:pointer;
}
.fav-remove-btn:hover{background:#FEE2E2;border-color:#FECACA}
html[data-theme="dark"] .fav-remove-btn{color:#FCA5A5}
html[data-theme="dark"] .fav-remove-btn:hover{background:#7F1D1D;border-color:#991B1B}
.fav-map-panel{
  border-radius:18px;overflow:hidden;border:1px solid var(--line);
  background:#E8EEF2;min-height:280px;height:100%;display:flex;flex-direction:column;
}
.fav-map-panel .nearby-map,.fav-map-panel .map-placeholder{min-height:280px;flex:1}

.hist-page{width:100%}
.hist-workspace{display:grid;gap:var(--gap);align-items:stretch}
.hist-list{list-style:none;margin:0;padding:0;display:grid;gap:10px;align-content:start}
.hist-row{
  display:grid;grid-template-columns:14px minmax(0,1fr) auto;gap:12px;align-items:center;
  padding:12px 14px;border:1.5px solid var(--line);border-radius:14px;background:var(--surface);
}
.hist-row.is-selected{border-color:var(--orange);background:var(--cream)}
.hist-row-mark{
  display:grid;place-items:center;align-self:stretch;position:relative;
}
.hist-row-mark span{
  width:10px;height:10px;border-radius:50%;background:var(--orange);
  box-shadow:0 0 0 4px rgba(255,107,26,.15);
}
.hist-row-info{min-width:0;display:grid;gap:3px}
.hist-row-info strong{font-size:.95rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hist-row-addr{font-size:.82rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hist-row-meta{
  display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:2px;
  font-size:.78rem;color:var(--muted);
}
.hist-row-meta em{
  font-style:normal;font-weight:700;color:var(--orange-dark);
  background:rgba(255,107,26,.1);border-radius:999px;padding:2px 8px;
}
.hist-row-meta time{font-weight:600}
.hist-row-actions{display:flex;align-items:center;gap:8px;flex:none}
.hist-map-panel{
  border-radius:18px;overflow:hidden;border:1px solid var(--line);
  background:#E8EEF2;min-height:280px;height:100%;display:flex;flex-direction:column;
}
.hist-map-panel .nearby-map,.hist-map-panel .map-placeholder{min-height:280px;flex:1}

@media (min-width:860px){
  .assistant-shell{grid-template-columns:260px minmax(0,1fr)}
  .assistant-history{
    border-bottom:0;border-right:1px solid var(--line);
    height:100%;min-height:0;
  }
  .assistant-thread-list{max-height:none;flex:1}
  .fav-workspace,.hist-workspace{
    grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);
    min-height:520px;
  }
  .fav-map-panel,.fav-map-panel .nearby-map,.fav-map-panel .map-placeholder,
  .hist-map-panel,.hist-map-panel .nearby-map,.hist-map-panel .map-placeholder{min-height:520px}
  .account-workspace{
    grid-template-columns:minmax(240px,300px) minmax(0,1fr);
    min-height:min(560px,70vh);
  }
  .account-profile{flex-direction:column;align-items:flex-start;text-align:left}
  .account-profile-copy{width:100%}
  .account-tabs{grid-template-columns:1fr}
  .account-tab{text-align:left;padding:12px 14px}
  .account-fields{grid-template-columns:1fr 1fr}
  .about-list{grid-template-columns:1fr 1fr}
  .account-card .btn-search,
  .account-card .btn-danger,
  .account-card .about-link{min-width:200px}
}
@media (max-width:859px){
  .account-tabs{grid-template-columns:1fr 1fr}
}
@media (max-width:480px){
  .account-tabs{grid-template-columns:1fr}
}

.side-panel{display:flex;flex-direction:column;gap:var(--gap);min-height:0}
.rest-list{list-style:none;margin:0;padding:0;display:grid;gap:10px;flex:1;min-height:180px;max-height:min(360px,42vh);overflow:auto}
.list-loading{
  flex:1;min-height:180px;display:grid;place-content:center;justify-items:center;gap:12px;
  padding:28px;border:1px dashed var(--line);border-radius:14px;background:var(--surface);
  color:var(--muted);font-size:.92rem;font-weight:600;
}
.list-spinner{
  width:36px;height:36px;border-radius:50%;
  border:3px solid var(--line);border-top-color:var(--orange);
  animation:spin .7s linear infinite;
}
@keyframes spin{to{transform:rotate(360deg)}}
.empty{
  padding:22px;background:var(--surface);border:1px dashed var(--line);
  border-radius:14px;color:var(--muted);font-size:.92rem;line-height:1.45;
}
.rest{
  width:100%;display:flex;flex-direction:column;gap:10px;text-align:left;padding:13px 14px;
  border:1.5px solid var(--line);border-radius:14px;background:var(--surface);
  cursor:pointer;font:inherit;color:inherit;transition:border-color .15s,background .15s,transform .15s;
}
.rest:hover{transform:translateY(-1px);border-color:#FFD0AE}
.rest.is-selected{border-color:var(--orange);background:var(--cream)}
.rest-info strong{display:block;font-size:.98rem}
.rest-info span{font-size:.8rem;color:var(--muted)}
.rest-status{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.wait{font-size:.84rem;font-weight:600;color:var(--ink-2)}
.wait-updated{font-size:.72rem;font-weight:600;color:var(--orange-dark)}
.badge{display:inline-flex;font-size:.75rem;font-weight:600;padding:4px 10px;border-radius:999px}
.badge-low{background:#DCFCE7;color:#166534}
.badge-mid{background:#FEF3C7;color:#B45309}
.badge-high{background:#FEE2E2;color:#991B1B}
.badge-closed{background:#E2E8F0;color:#475569}
html[data-theme="dark"] .badge-low{background:#14532D;color:#86EFAC}
html[data-theme="dark"] .badge-mid{background:#78350F;color:#FBBF24}
html[data-theme="dark"] .badge-high{background:#7F1D1D;color:#FECACA}
html[data-theme="dark"] .badge-closed{background:#334155;color:#CBD5E1}

.detail{
  background:#14171A;color:#fff;border-radius:18px;padding:20px 20px 22px;
}
.detail-kicker{margin:0;font-size:.72rem;color:var(--yellow);font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.detail h2{font-family:'Bricolage Grotesque',sans-serif;font-size:1.3rem;margin:8px 0 6px;line-height:1.2}
.detail-addr{margin:0 0 14px;color:#CBD5E1;font-size:.88rem;line-height:1.4}
.detail-meta{list-style:none;margin:0 0 16px;padding:0;display:grid;gap:8px}
.detail-meta li{
  display:flex;justify-content:space-between;gap:12px;font-size:.88rem;
  border-top:1px solid rgba(255,255,255,.08);padding-top:9px;
}
.detail-meta strong{color:#E5E7EB}
.detail-meta span{color:#94A3B8;text-align:right}
.lunch-route{
  margin:0 0 14px;padding:14px 14px 12px;border-radius:14px;
  background:linear-gradient(160deg,rgba(255,107,26,.18),rgba(255,214,10,.08));
  border:1px solid rgba(255,214,10,.22);
}
.lunch-route-head{margin-bottom:10px}
.lunch-route-kicker{
  margin:0 0 4px;font-size:.68rem;font-weight:700;letter-spacing:.06em;
  text-transform:uppercase;color:var(--yellow);
}
.lunch-route h3{
  margin:0 0 4px;font-family:'Bricolage Grotesque',sans-serif;
  font-size:1.05rem;letter-spacing:-.02em;color:#fff;
}
.lunch-route-lead{margin:0;font-size:.78rem;color:#CBD5E1;line-height:1.4}
.lunch-route-totals{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 10px}
.lunch-route-total{
  display:grid;gap:2px;margin:0;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.28);
}
.lunch-route-total em{font-style:normal;font-size:.68rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#94A3B8}
.lunch-route-total strong{font-size:1.35rem;color:var(--yellow);letter-spacing:-.02em}
.lunch-route-total span{font-size:.72rem;color:#94A3B8;font-weight:600}
.lunch-route-breakdown{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.lunch-route-breakdown li{
  display:flex;justify-content:space-between;gap:10px;
  font-size:.82rem;color:#CBD5E1;
}
.lunch-route-breakdown strong{color:#F3F4F6;font-variant-numeric:tabular-nums}
.lunch-route-formula{
  margin:10px 0 0;font-size:.72rem;color:#94A3B8;line-height:1.35;
  border-top:1px solid rgba(255,255,255,.08);padding-top:8px;
}
.btn-primary{
  border:0;background:var(--orange);color:#fff;border-radius:999px;padding:12px 18px;
  font-weight:700;cursor:pointer;font:inherit;box-shadow:0 10px 24px -12px rgba(255,107,26,.8);
}
.btn-primary.maps{
  display:inline-flex;align-items:center;justify-content:center;width:100%;
  text-decoration:none;border:0;font:inherit;cursor:pointer;
}
.btn-primary.maps:disabled{opacity:.7;cursor:wait}
.btn-primary:hover:not(:disabled){background:var(--orange-dark)}
.fine{margin:12px 0 0;font-size:.74rem;color:#94A3B8;line-height:1.45}

@media (min-width:640px){
  .rest{flex-direction:row;align-items:center;justify-content:space-between}
  .rest-status{flex-direction:column;align-items:flex-end}
}
@media (min-width:780px){
  .loc-chip{display:inline-flex}
}
@media (min-width:960px){
  .workspace{
    grid-template-columns:minmax(0,.9fr) minmax(0,1.15fr);
    align-items:stretch;
    min-height:560px;
  }
  .map-panel,.nearby-map,.map-placeholder{min-height:560px;height:100%}
  .side-panel{min-height:560px}
  .rest-list{max-height:none;flex:1;min-height:0}
  .detail{flex:none}
}
@media (max-width:860px){
  .app-shell{margin-left:0}
  .app-page.is-menu-open .app-shell{margin-left:0}
  .side-rail{box-shadow:12px 0 40px -12px rgba(31,35,40,.45)}
  .app-page.is-menu-open .menu-scrim{
    display:block;position:fixed;inset:0;z-index:45;border:0;padding:0;margin:0;
    background:rgba(15,18,22,.35);cursor:pointer;
  }
}
@media (max-width:640px){
  .user-name{display:none}
  .user-chip{padding:3px}
  .lead{white-space:normal}
  .toolbar{flex-direction:column;align-items:stretch}
  .toolbar-fields{flex-direction:column;align-items:stretch}
  .field select,.btn-search{width:100%}
}
`;
