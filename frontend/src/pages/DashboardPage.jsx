import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useGeolocation } from "../hooks/useGeolocation.js";
import NearbyMap from "../components/NearbyMap.jsx";

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

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { coords, error: geoError, loading: geoLoading, request } = useGeolocation();

  const [selfService, setSelfService] = useState(true);
  const [maxDistance, setMaxDistance] = useState(1500);
  const [maxWait, setMaxWait] = useState("");
  const [restaurants, setRestaurants] = useState([]);
  const [place, setPlace] = useState(null);
  const [meta, setMeta] = useState({ warning: null, waitNote: null, source: null });
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

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
        selfService: selfService ? "1" : "0",
      });
      if (maxWait) params.set("maxWait", maxWait);

      const res = await fetch(`/api/restaurants/nearby?${params}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao buscar restaurantes");

      setRestaurants(data.restaurants || []);
      setPlace(data.place || null);
      setMeta({
        warning: data.warning || null,
        waitNote: data.waitNote || null,
        source: data.source || null,
      });
      setSelectedId((prev) => {
        const list = data.restaurants || [];
        if (prev && list.some((r) => r.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (err) {
      setFetchError(err.message);
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }, [coords, maxDistance, maxWait, selfService]);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  const selected = useMemo(
    () => restaurants.find((r) => r.id === selectedId) || null,
    [restaurants, selectedId]
  );

  const firstName = user?.name?.split(" ")[0] || "você";
  const whereLabel = place?.short || (coords ? "Localizando endereço…" : "Aguardando localização");
  const whereDetail = place?.line || place?.full || null;

  return (
    <>
      <style>{css}</style>
      <div className="app-page">
        <header className="app-header">
          <Link to="/" className="brand">
            Fila<span>Zero</span>
          </Link>
          <div className="user-box">
            {user?.avatar_url && (
              <img src={user.avatar_url} alt="" className="avatar" referrerPolicy="no-referrer" />
            )}
            <span className="user-name">{user?.name || user?.email}</span>
            <button type="button" className="btn-ghost" onClick={logout}>
              Sair
            </button>
          </div>
        </header>

        <main className="app-main">
          <section className="hero-block">
            <div>
              <p className="eyebrow">Olá, {firstName}</p>
              <h1>Onde almoçar agora?</h1>
              <p className="lead">
                Compare distância e tempo de espera estimado perto de você — sem chegar e descobrir
                fila enorme.
              </p>
            </div>

            <div className="place-card">
              <div className="place-top">
                <span className="place-pin" aria-hidden="true">📍</span>
                <div>
                  <p className="place-kicker">Você está em</p>
                  <p className="place-title">{whereLabel}</p>
                  {whereDetail && whereDetail !== whereLabel && (
                    <p className="place-sub">{whereDetail}</p>
                  )}
                </div>
              </div>
              <div className="place-actions">
                <button type="button" className="btn-primary" onClick={request} disabled={geoLoading}>
                  {geoLoading ? "Localizando…" : "Atualizar localização"}
                </button>
                <span className="place-meta">
                  {meta.source === "demo"
                    ? "Lista demo (mapa OSM indisponível)"
                    : "Mapa e locais via OpenStreetMap"}
                </span>
              </div>
            </div>
          </section>

          <section className="filters" aria-label="Filtros">
            <label className="check">
              <input
                type="checkbox"
                checked={selfService}
                onChange={(e) => setSelfService(e.target.checked)}
              />
              Preferir self-service / buffet
            </label>

            <label>
              Distância
              <select value={maxDistance} onChange={(e) => setMaxDistance(Number(e.target.value))}>
                {DISTANCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Espera máx.
              <select value={maxWait} onChange={(e) => setMaxWait(e.target.value)}>
                {WAIT_OPTIONS.map((o) => (
                  <option key={o.label} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="filter-status">
              {loading ? (
                <span className="pulse">Buscando por perto…</span>
              ) : (
                <span>
                  {restaurants.length} lugar{restaurants.length === 1 ? "" : "es"} na área
                </span>
              )}
            </div>
          </section>

          {geoError && <p className="banner error">{geoError}</p>}
          {meta.warning && <p className="banner warn">{meta.warning}</p>}
          {fetchError && <p className="banner error">{fetchError}</p>}

          <div className="map-panel">
            <NearbyMap
              center={coords}
              restaurants={restaurants}
              selectedId={selectedId}
              onSelect={setSelectedId}
              radiusM={maxDistance}
            />
          </div>

          <div className="layout">
            <ul className="rest-list">
              {!loading && restaurants.length === 0 && coords && !fetchError && (
                <li className="empty">
                  Nada encontrado com esses filtros. Amplie a distância ou a espera máxima.
                </li>
              )}
              {restaurants.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`rest ${selectedId === r.id ? "is-selected" : ""}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <div className="rest-info">
                      <strong>{r.name}</strong>
                      <span>
                        {r.distanceLabel} · {r.walkLabel}
                        {r.cuisine ? ` · ${r.cuisine}` : ""}
                      </span>
                    </div>
                    <div className="rest-status">
                      <span className={`badge badge-${r.waitLevel}`}>{r.waitLabel}</span>
                      <span className="wait">~{r.waitMinutes} min</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <aside className="detail">
              {selected ? (
                <>
                  <p className="detail-kicker">Escolhido</p>
                  <h2>{selected.name}</h2>
                  <p className="detail-addr">{selected.address}</p>
                  <ul className="detail-meta">
                    <li>
                      <strong>A pé</strong>
                      <span>
                        {selected.distanceLabel} · {selected.walkLabel}
                      </span>
                    </li>
                    <li>
                      <strong>Espera</strong>
                      <span>
                        ~{selected.waitMinutes} min · {selected.waitLabel}
                      </span>
                    </li>
                    <li>
                      <strong>Perfil</strong>
                      <span>
                        {selected.selfService ? "Self-service / buffet (provável)" : "Restaurante"}
                      </span>
                    </li>
                  </ul>
                  <a className="btn-primary maps" href={selected.mapsUrl} target="_blank" rel="noreferrer">
                    Abrir no mapa
                  </a>
                  {meta.waitNote && <p className="fine">{meta.waitNote}</p>}
                </>
              ) : (
                <p className="detail-empty">Toque em um restaurante na lista ou no mapa.</p>
              )}
            </aside>
          </div>
        </main>
      </div>
    </>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');

.app-page{
  min-height:100vh;font-family:'DM Sans',system-ui,sans-serif;color:#1F2328;
  background:
    radial-gradient(700px 320px at 100% -10%,#FFE2C2 0,transparent 55%),
    linear-gradient(160deg,#FFF9F2,#fff 50%,#FFF7EE);
}
.app-header{
  display:flex;justify-content:space-between;align-items:center;gap:16px;
  padding:14px 20px;border-bottom:1px solid #F0E6DA;background:rgba(255,255,255,.9);
  backdrop-filter:blur(10px);position:sticky;top:0;z-index:30;
}
.brand{
  font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:1.25rem;
  text-decoration:none;color:inherit;letter-spacing:-.03em;
}
.brand span{color:#FF6B1A}
.user-box{display:flex;align-items:center;gap:10px;font-size:.92rem}
.avatar{width:34px;height:34px;border-radius:50%;object-fit:cover}
.user-name{max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.btn-ghost{
  border:2px solid #FF6B1A;background:transparent;color:#E5560A;border-radius:999px;
  padding:8px 14px;font-weight:600;cursor:pointer;font:inherit;
}
.app-main{max-width:1120px;margin:0 auto;padding:28px 20px 56px}
.hero-block{
  display:grid;gap:18px;margin-bottom:18px;
}
@media (min-width:900px){
  .hero-block{grid-template-columns:1.2fr .9fr;align-items:stretch}
}
.eyebrow{
  margin:0 0 8px;font-size:.8rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#E5560A;
}
.hero-block h1{
  font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(1.9rem,4vw,2.55rem);
  margin:0 0 10px;letter-spacing:-.02em;line-height:1.12;
}
.lead{margin:0;color:#4B5563;line-height:1.55;max-width:46ch}
.place-card{
  background:#fff;border:1px solid #F0E6DA;border-radius:20px;padding:18px 18px 16px;
  box-shadow:0 18px 40px -28px rgba(31,35,40,.35);display:flex;flex-direction:column;justify-content:space-between;gap:14px;
}
.place-top{display:flex;gap:12px;align-items:flex-start}
.place-pin{font-size:1.3rem;line-height:1.2}
.place-kicker{margin:0;font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF}
.place-title{margin:4px 0 0;font-family:'Bricolage Grotesque',sans-serif;font-size:1.25rem;line-height:1.2}
.place-sub{margin:6px 0 0;font-size:.88rem;color:#6B7280;line-height:1.4}
.place-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.place-meta{font-size:.78rem;color:#9CA3AF}
.filters{
  display:flex;flex-wrap:wrap;gap:12px 14px;align-items:end;margin-bottom:14px;
  padding:14px 16px;background:#fff;border:1px solid #F0E6DA;border-radius:18px;
}
.filters label{display:grid;gap:6px;font-size:.82rem;font-weight:600;color:#374151}
.filters select{
  min-width:150px;padding:10px 12px;border-radius:12px;border:2px solid #E5E7EB;
  font:inherit;background:#fff;
}
.check{display:flex!important;align-items:center;gap:8px;grid-auto-flow:column;padding-bottom:10px}
.check input{width:18px;height:18px;accent-color:#FF6B1A}
.filter-status{margin-left:auto;font-size:.85rem;color:#6B7280;padding-bottom:10px}
.btn-primary{
  border:0;background:#FF6B1A;color:#fff;border-radius:999px;padding:12px 18px;
  font-weight:700;cursor:pointer;font:inherit;box-shadow:0 10px 24px -12px rgba(255,107,26,.8);
}
.btn-primary:disabled{opacity:.7;cursor:wait}
.btn-primary.maps{display:inline-flex;text-decoration:none;margin-top:4px;justify-content:center}
.banner{padding:12px 14px;border-radius:12px;font-size:.9rem;margin:0 0 12px}
.banner.error{background:#FEE2E2;color:#991B1B}
.banner.warn{background:#FEF3C7;color:#92400E}
.pulse{color:#E5560A;font-weight:600}
.map-panel{
  margin-bottom:18px;border-radius:20px;overflow:hidden;border:1px solid #F0E6DA;
  box-shadow:0 18px 40px -28px rgba(31,35,40,.3);background:#E8EEF2;
}
.nearby-map{width:100%;height:min(42vh,360px);min-height:240px;z-index:1}
.map-placeholder{
  height:240px;display:grid;place-items:center;color:#6B7280;font-size:.95rem;padding:24px;text-align:center;
}
.fz-marker{background:transparent;border:0}
.fz-marker span{
  display:block;width:100%;height:100%;border-radius:50%;
  box-shadow:0 2px 8px rgba(0,0,0,.25);border:2px solid #fff;
}
.fz-marker-you span{background:#2563EB}
.fz-marker-rest span{background:#FF6B1A}
.fz-marker-rest.is-selected span{background:#E5560A;outline:3px solid rgba(255,107,26,.35)}
.layout{display:grid;gap:18px}
@media (min-width:900px){.layout{grid-template-columns:1.15fr .85fr;align-items:start}}
.rest-list{list-style:none;margin:0;padding:0;display:grid;gap:10px;max-height:560px;overflow:auto}
.empty{padding:24px;background:#fff;border:1px dashed #F0E6DA;border-radius:16px;color:#6B7280}
.rest{
  width:100%;display:flex;flex-direction:column;gap:10px;text-align:left;padding:14px;
  border:2px solid #F0E6DA;border-radius:16px;background:#fff;cursor:pointer;font:inherit;color:inherit;
  transition:border-color .15s,background .15s,transform .15s;
}
.rest:hover{transform:translateY(-1px);border-color:#FFD0AE}
.rest.is-selected{border-color:#FF6B1A;background:#FFF7EE}
.rest-info strong{display:block;font-size:1rem}
.rest-info span{font-size:.82rem;color:#6B7280}
.rest-status{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.wait{font-size:.85rem;font-weight:600;color:#4B5563}
.badge{display:inline-flex;font-size:.78rem;font-weight:600;padding:5px 11px;border-radius:999px}
.badge-low{background:#DCFCE7;color:#166534}
.badge-mid{background:#FEF3C7;color:#B45309}
.badge-high{background:#FEE2E2;color:#991B1B}
@media (min-width:640px){
  .rest{flex-direction:row;align-items:center;justify-content:space-between}
  .rest-status{flex-direction:column;align-items:flex-end}
}
.detail{
  background:#1F2328;color:#fff;border-radius:20px;padding:22px;position:sticky;top:84px;
}
.detail-kicker{margin:0;font-size:.78rem;color:#FFB400;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.detail h2{font-family:'Bricolage Grotesque',sans-serif;font-size:1.45rem;margin:8px 0 6px}
.detail-addr{margin:0 0 16px;color:#CBD5E1;font-size:.92rem}
.detail-meta{list-style:none;margin:0 0 18px;padding:0;display:grid;gap:10px}
.detail-meta li{display:flex;justify-content:space-between;gap:12px;font-size:.9rem;border-top:1px solid rgba(255,255,255,.08);padding-top:10px}
.detail-meta strong{color:#E5E7EB}
.detail-meta span{color:#94A3B8;text-align:right}
.fine{margin:14px 0 0;font-size:.75rem;color:#94A3B8;line-height:1.45}
.detail-empty{margin:0;color:#94A3B8}
@media (max-width:640px){
  .user-name{display:none}
  .filters{flex-direction:column;align-items:stretch}
  .filters select,.btn-primary{width:100%}
  .filter-status{margin-left:0;padding-bottom:0}
}
`;
