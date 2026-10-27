import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const THEME_KEY = "filazero-theme";

const CUISINES = [
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

function formatCepInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function buildAddressLine({ street, number, neighborhood, city, state, cep }) {
  const streetPart = [street, number].filter(Boolean).join(", ");
  return [streetPart, neighborhood, city, state, cep].filter(Boolean).join(" — ");
}

export default function PartnerRegisterPage() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [cuisineType, setCuisineType] = useState("self_service");
  const [selfService, setSelfService] = useState(true);
  const [waitMinutes, setWaitMinutes] = useState(10);
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMsg, setCepMsg] = useState("");
  const [geoMsg, setGeoMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const addressPreview = useMemo(
    () => buildAddressLine({ street, number, neighborhood, city, state: stateUf, cep }),
    [street, number, neighborhood, city, stateUf, cep]
  );

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  useEffect(() => {
    if (!loading && user?.partnerPlaceId) {
      navigate("/parceiro", { replace: true });
    }
  }, [user, loading, navigate]);

  const lookupCep = async (raw) => {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.length !== 8) {
      setCepMsg("Digite um CEP com 8 dígitos.");
      return;
    }
    setCepLoading(true);
    setCepMsg("Buscando CEP…");
    setError("");
    try {
      const res = await fetch(`/api/geo/cep?cep=${digits}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "CEP não encontrado");
      const place = data.place || {};
      setCep(formatCepInput(place.cep || digits));
      setStreet(place.street || "");
      setNeighborhood(place.neighborhood || "");
      setCity(place.city || "");
      setStateUf(place.state || "");
      if (place.lat != null && place.lng != null) {
        setLat(Number(place.lat));
        setLng(Number(place.lng));
        setGeoMsg("Coordenadas estimadas pelo endereço — ajuste se precisar.");
      } else {
        setGeoMsg("CEP ok, mas sem coordenadas. Use a localização ou ajuste o endereço.");
      }
      setCepMsg("Endereço preenchido — confira e corrija se estiver errado.");
    } catch (err) {
      setCepMsg(err.message || "Falha ao buscar CEP");
    } finally {
      setCepLoading(false);
    }
  };

  const useMyLocation = () => {
    setGeoMsg("Obtendo localização…");
    if (!navigator.geolocation) {
      setGeoMsg("Geolocalização não disponível neste navegador.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGeoMsg("Localização capturada — ajuste o endereço se precisar.");
      },
      () => setGeoMsg("Não foi possível obter a localização. Permita o acesso no navegador."),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const address = addressPreview || street;
      const payload = {
        restaurantName,
        address,
        lat,
        lng,
        websiteUrl,
        cuisineType,
        selfService,
        waitMinutes: Number(waitMinutes) || 10,
      };
      if (!user) {
        payload.name = name;
        payload.email = email;
        payload.password = password;
      }
      const res = await fetch("/api/partners/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha no cadastro");
      await refresh();
      navigate("/parceiro", { replace: true });
    } catch (err) {
      setError(err.message || "Falha no cadastro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pr-page">
      <header className="pr-top">
        <Link to="/" className="pr-brand">
          Fila<b>Zero</b>
        </Link>
        <Link to={user ? "/parceiro" : "/login"} className="pr-link">
          {user ? "Painel" : "Já tenho conta"}
        </Link>
      </header>

      <main className="pr-main">
        <p className="pr-kicker">Para restaurantes</p>
        <h1>Cadastre seu restaurante</h1>
        <p className="pr-lead">
          Informe o CEP para preencher o endereço. Se algo vier errado, edite os campos.
        </p>

        <form className="pr-form" onSubmit={onSubmit}>
          {!user && (
            <fieldset>
              <legend>Sua conta</legend>
              <label>
                Nome
                <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
              </label>
              <label>
                E-mail
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label>
                Senha
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </label>
            </fieldset>
          )}

          <fieldset>
            <legend>Restaurante</legend>
            <label className="pr-full">
              Nome do restaurante
              <input
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                required
                minLength={2}
              />
            </label>

            <label>
              CEP
              <input
                value={cep}
                onChange={(e) => setCep(formatCepInput(e.target.value))}
                onBlur={() => {
                  if (String(cep).replace(/\D/g, "").length === 8) lookupCep(cep);
                }}
                inputMode="numeric"
                placeholder="00000-000"
                autoComplete="postal-code"
                required
              />
            </label>
            <div className="pr-cep-actions">
              <button
                type="button"
                className="pr-secondary"
                disabled={cepLoading}
                onClick={() => lookupCep(cep)}
              >
                {cepLoading ? "Buscando…" : "Buscar CEP"}
              </button>
              {cepMsg ? <em>{cepMsg}</em> : null}
            </div>

            <label className="pr-full">
              Rua / logradouro
              <input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                required
                placeholder="Preenchido pelo CEP"
              />
            </label>
            <label>
              Número
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Ex.: 120"
                required
              />
            </label>
            <label>
              Bairro
              <input
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                required
              />
            </label>
            <label>
              Cidade
              <input value={city} onChange={(e) => setCity(e.target.value)} required />
            </label>
            <label>
              UF
              <input
                value={stateUf}
                onChange={(e) => setStateUf(e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
                required
                placeholder="SP"
              />
            </label>

            {addressPreview ? (
              <p className="pr-preview pr-full">
                Endereço que será salvo: <strong>{addressPreview}</strong>
              </p>
            ) : null}

            <label>
              Tipo
              <select value={cuisineType} onChange={(e) => setCuisineType(e.target.value)}>
                {CUISINES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Espera atual (min)
              <input
                type="number"
                min={0}
                max={90}
                value={waitMinutes}
                onChange={(e) => setWaitMinutes(e.target.value)}
              />
            </label>
            <label className="pr-full">
              Site (opcional)
              <input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://"
              />
            </label>
            <label className="pr-check">
              <input
                type="checkbox"
                checked={selfService}
                onChange={(e) => setSelfService(e.target.checked)}
              />
              Self-service / buffet
            </label>
            <div className="pr-geo pr-full">
              <button type="button" className="pr-secondary" onClick={useMyLocation}>
                Usar minha localização no mapa
              </button>
              <span>
                {lat != null && lng != null
                  ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                  : "Sem coordenadas ainda — busque o CEP ou use a localização"}
              </span>
              {geoMsg ? <em>{geoMsg}</em> : null}
            </div>
          </fieldset>

          {error && <p className="pr-error">{error}</p>}
          <button type="submit" disabled={saving || lat == null || lng == null}>
            {saving ? "Cadastrando…" : "Criar painel do restaurante"}
          </button>
        </form>
      </main>

      <style>{`
        .pr-page{min-height:100vh;background:var(--bg,#F7F4EF);color:var(--ink,#1F2328);font-family:'DM Sans',system-ui,sans-serif}
        html[data-theme="dark"] .pr-page{--bg:#0F1216;--ink:#E8EAED;--muted:#9AA0A6;--surface:#1A1F24;--line:#2A3138}
        .pr-top{display:flex;justify-content:space-between;align-items:center;padding:14px clamp(16px,4vw,40px);border-bottom:1px solid var(--line,#E5E1DA);background:var(--surface,#fff);position:sticky;top:0}
        .pr-brand{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:1.2rem;text-decoration:none;color:inherit;letter-spacing:-.03em}
        .pr-brand b{color:#FF6B1A}
        .pr-link{color:#FF6B1A;font-weight:700;text-decoration:none}
        .pr-main{max-width:720px;margin:0 auto;padding:clamp(24px,4vw,40px) clamp(16px,4vw,40px) 64px}
        .pr-kicker{margin:0 0 6px;font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#FF6B1A}
        .pr-main h1{font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(1.7rem,3.5vw,2.2rem);margin:0 0 8px;letter-spacing:-.02em}
        .pr-lead{margin:0 0 24px;color:var(--muted,#5C6570);line-height:1.5}
        .pr-form{display:grid;gap:18px}
        .pr-form fieldset{margin:0;padding:18px;border:1px solid var(--line,#E5E1DA);border-radius:16px;background:var(--surface,#fff);display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .pr-form legend{padding:0 6px;font-weight:800;font-size:.9rem}
        .pr-form label{display:grid;gap:6px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#5C6570)}
        .pr-full{grid-column:1/-1}
        .pr-form input,.pr-form select{padding:11px 12px;border-radius:12px;border:1.5px solid var(--line,#E5E1DA);font:inherit;font-size:.95rem;font-weight:500;text-transform:none;letter-spacing:0;background:var(--bg,#F7F4EF);color:inherit;width:100%}
        .pr-check{display:flex;align-items:center;gap:8px;text-transform:none;font-size:.9rem;letter-spacing:0;grid-column:1/-1}
        .pr-check input{width:auto}
        .pr-cep-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px;grid-column:2 / -1}
        .pr-cep-actions em,.pr-geo em,.pr-geo span{font-size:.85rem;font-weight:500;text-transform:none;letter-spacing:0;color:var(--muted,#5C6570);font-style:normal}
        .pr-preview{margin:0;font-size:.85rem;font-weight:500;text-transform:none;letter-spacing:0;color:var(--muted,#5C6570);line-height:1.4}
        .pr-preview strong{color:inherit;font-weight:700}
        .pr-geo{display:grid;gap:6px}
        .pr-secondary{border:1.5px solid #FF6B1A;background:transparent;color:#E55A0F;border-radius:12px;min-height:40px;padding:0 14px;font:inherit;font-weight:700;cursor:pointer;width:fit-content}
        .pr-secondary:disabled{opacity:.6;cursor:wait}
        .pr-form > button{border:0;background:#FF6B1A;color:#fff;border-radius:12px;min-height:46px;padding:0 22px;font:inherit;font-weight:700;cursor:pointer;justify-self:start}
        .pr-form > button:disabled{opacity:.55;cursor:not-allowed}
        .pr-error{color:#B91C1C;font-weight:600;margin:0}
        @media (max-width:640px){
          .pr-form fieldset{grid-template-columns:1fr}
          .pr-cep-actions{grid-column:1 / -1}
        }
      `}</style>
    </div>
  );
}
