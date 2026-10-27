import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const GOOGLE_ERRORS = {
  google_not_configured: "Login com Google ainda não está configurado no servidor.",
  google_failed: "Não foi possível entrar com o Google. Tente de novo.",
};

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

export default function LoginPage() {
  const { user, loading, login, register, refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialMode = params.get("mode") === "register" ? "register" : "login";
  const initialType =
    params.get("tipo") === "restaurante" || params.get("role") === "partner"
      ? "restaurante"
      : "cliente";

  const [mode, setMode] = useState(initialMode);
  const [accountType, setAccountType] = useState(initialType);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(GOOGLE_ERRORS[params.get("error")] || "");
  const [submitting, setSubmitting] = useState(false);

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

  const isLogin = mode === "login";
  const isRestaurant = !isLogin && accountType === "restaurante";
  const upgradingPartner = Boolean(user && !user.partnerPlaceId && isRestaurant);

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

  const nextPath = (() => {
    const raw = params.get("next");
    if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
    return raw;
  })();

  const destFor = (u) => {
    if (nextPath) return nextPath;
    if (u?.partnerPlaceId || u?.role === "partner") return "/parceiro";
    return "/app";
  };

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (user.partnerPlaceId || user.role === "partner") {
      navigate("/parceiro", { replace: true });
      return;
    }
    // Cliente logado só permanece se estiver completando cadastro de restaurante
    if (!(mode === "register" && accountType === "restaurante")) {
      navigate(destFor(user), { replace: true });
    }
  }, [user, loading, navigate, nextPath, mode, accountType]);

  useEffect(() => {
    setMode(params.get("mode") === "register" ? "register" : "login");
    setAccountType(
      params.get("tipo") === "restaurante" || params.get("role") === "partner"
        ? "restaurante"
        : "cliente"
    );
  }, [params]);

  const switchMode = (next, type = accountType) => {
    setMode(next);
    setAccountType(type);
    setError("");
    const q = new URLSearchParams();
    if (next === "register") q.set("mode", "register");
    if (next === "register" && type === "restaurante") q.set("tipo", "restaurante");
    if (nextPath) q.set("next", nextPath);
    const qs = q.toString();
    navigate(qs ? `/login?${qs}` : "/login", { replace: true });
  };

  const setType = (type) => {
    setAccountType(type);
    setError("");
    const q = new URLSearchParams();
    q.set("mode", "register");
    if (type === "restaurante") q.set("tipo", "restaurante");
    if (nextPath) q.set("next", nextPath);
    navigate(`/login?${q.toString()}`, { replace: true });
  };

  const lookupCep = async (raw) => {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.length !== 8) {
      setCepMsg("Digite um CEP com 8 dígitos.");
      return;
    }
    setCepLoading(true);
    setCepMsg("Buscando CEP…");
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

  const registerPartner = async () => {
    if (lat == null || lng == null) {
      throw new Error("Informe a localização (CEP ou GPS).");
    }
    const payload = {
      restaurantName,
      address: addressPreview || street,
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
    if (!res.ok) throw new Error(data.error || "Falha no cadastro do restaurante");
    await refresh();
    return data.user || { role: "partner", partnerPlaceId: true };
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isLogin) {
        const u = await login({ email, password });
        navigate(destFor(u), { replace: true });
        return;
      }
      if (isRestaurant) {
        await registerPartner();
        navigate("/parceiro", { replace: true });
        return;
      }
      const u = await register({ name, email, password });
      navigate(destFor(u), { replace: true });
    } catch (err) {
      setError(err.message || "Falha na autenticação.");
    } finally {
      setSubmitting(false);
    }
  };

  const title = isLogin
    ? "Entrar na sua conta"
    : upgradingPartner
      ? "Cadastrar seu restaurante"
      : isRestaurant
        ? "Criar conta de restaurante"
        : "Criar sua conta";

  const lead = isLogin
    ? "Entre com e-mail e senha."
    : upgradingPartner
      ? "Complete os dados do lugar para abrir o painel parceiro."
      : isRestaurant
        ? "Cadastre a conta e o restaurante juntos — depois gerencie espera e cardápio no painel."
        : "Escolha se você almoça ou se é um restaurante parceiro.";

  return (
    <>
      <style>{loginCss}</style>
      <div className="login-page">
        <aside className="login-aside" aria-hidden="false">
          <Link to="/" className="login-logo" aria-label="FilaZero — início">
            <span className="login-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2.5 1.5M9 2h6" />
              </svg>
            </span>
            <span className="login-brand">
              Fila<b>Zero</b>
            </span>
          </Link>

          <div className="aside-copy">
            <h2>
              {isRestaurant
                ? "Publique a espera real e atraia quem está perto."
                : "Almoce sem perder tempo na fila."}
            </h2>
            <p>
              {isRestaurant
                ? "Painel simples para espera, cardápio, horários e quem vem agora — no mesmo cadastro do app."
                : "Veja a lotação dos restaurantes perto de você e escolha o melhor horário antes de sair."}
            </p>
            <ul className="aside-points">
              {isRestaurant ? (
                <>
                  <li>Espera ao vivo no Explorar</li>
                  <li>Cardápio do dia com foto</li>
                  <li>Relatório semanal</li>
                </>
              ) : (
                <>
                  <li>Grátis para quem almoça</li>
                  <li>Dados em tempo real</li>
                  <li>Cadastro em segundos</li>
                </>
              )}
            </ul>
          </div>

          <p className="aside-foot">Campinas — SP</p>
        </aside>

        <main className="login-main">
          <div className={`login-main-inner ${isRestaurant ? "is-wide" : ""}`}>
            <div className="mobile-top">
              <Link to="/" className="login-logo mobile-logo" aria-label="FilaZero — início">
                <span className="login-mark">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="13" r="8" />
                    <path d="M12 9v4l2.5 1.5M9 2h6" />
                  </svg>
                </span>
                <span className="login-brand mobile-brand-text">
                  Fila<b>Zero</b>
                </span>
              </Link>
              <Link to="/" className="back-link">
                <span aria-hidden="true">←</span> Voltar ao início
              </Link>
            </div>

            <div className="login-card">
              <header className="card-head">
                <h1>{title}</h1>
                <p className="login-lead">{lead}</p>
              </header>

              {!isLogin && !upgradingPartner && (
                <div className="account-type" role="tablist" aria-label="Tipo de conta">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={accountType === "cliente"}
                    className={`account-type-btn ${accountType === "cliente" ? "is-active" : ""}`}
                    onClick={() => setType("cliente")}
                  >
                    <strong>Cliente</strong>
                    <span>Quero achar onde almoçar</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={accountType === "restaurante"}
                    className={`account-type-btn ${accountType === "restaurante" ? "is-active" : ""}`}
                    onClick={() => setType("restaurante")}
                  >
                    <strong>Restaurante</strong>
                    <span>Quero publicar minha espera</span>
                  </button>
                </div>
              )}

              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}

              <form className="auth-form" onSubmit={onSubmit}>
                {!isLogin && !upgradingPartner && (
                  <label>
                    Nome
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      minLength={2}
                      placeholder="Seu nome"
                    />
                  </label>
                )}

                {!upgradingPartner && (
                  <>
                    <label>
                      E-mail
                      <input
                        type="email"
                        name="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="voce@email.com"
                      />
                    </label>
                    <label>
                      Senha
                      <div className="password-field">
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          autoComplete={isLogin ? "current-password" : "new-password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          placeholder={isLogin ? "Sua senha" : "Mínimo 6 caracteres"}
                        />
                        <button
                          type="button"
                          className="eye-btn"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      </div>
                    </label>
                  </>
                )}

                {isRestaurant && (
                  <div className="rest-block">
                    <p className="rest-block-title">Dados do restaurante</p>
                    <label className="full">
                      Nome do restaurante
                      <input
                        value={restaurantName}
                        onChange={(e) => setRestaurantName(e.target.value)}
                        required
                        minLength={2}
                        placeholder="Ex.: Cantina do Centro"
                      />
                    </label>
                    <div className="rest-grid">
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
                      <div className="cep-actions">
                        <button
                          type="button"
                          className="secondary-btn"
                          disabled={cepLoading}
                          onClick={() => lookupCep(cep)}
                        >
                          {cepLoading ? "Buscando…" : "Buscar CEP"}
                        </button>
                        {cepMsg ? <em>{cepMsg}</em> : null}
                      </div>
                      <label className="full">
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
                          required
                          placeholder="Ex.: 120"
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
                      <label>
                        Tipo
                        <select
                          value={cuisineType}
                          onChange={(e) => {
                            setCuisineType(e.target.value);
                            setSelfService(e.target.value === "self_service");
                          }}
                        >
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
                      <label className="full">
                        Site (opcional)
                        <input
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          placeholder="https://"
                        />
                      </label>
                    </div>
                    {addressPreview ? (
                      <p className="address-preview">
                        Endereço salvo: <strong>{addressPreview}</strong>
                      </p>
                    ) : null}
                    <div className="geo-row">
                      <button type="button" className="secondary-btn" onClick={useMyLocation}>
                        Usar minha localização
                      </button>
                      <span>
                        {lat != null && lng != null
                          ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                          : "Sem coordenadas — busque o CEP ou use o GPS"}
                      </span>
                      {geoMsg ? <em>{geoMsg}</em> : null}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={
                    submitting || (isRestaurant && (lat == null || lng == null))
                  }
                >
                  {submitting
                    ? "Aguarde..."
                    : isLogin
                      ? "Entrar"
                      : isRestaurant
                        ? "Criar painel do restaurante"
                        : "Criar conta"}
                </button>
              </form>

              <p className="auth-switch">
                {isLogin ? (
                  <>
                    Não tem conta?{" "}
                    <button type="button" onClick={() => switchMode("register", "cliente")}>
                      Cadastre-se aqui
                    </button>
                  </>
                ) : (
                  <>
                    Já tem conta?{" "}
                    <button type="button" onClick={() => switchMode("login")}>
                      Clique aqui para entrar
                    </button>
                  </>
                )}
              </p>

              <p className="login-note">
                Ao continuar, você concorda com os Termos de Uso do FilaZero.
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.8 21.8 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a21.8 21.8 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

const loginCss = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');

:root{
  --ink:#1F2328; --ink-2:#4B5563; --muted:#6B7280;
  --bg:#FFF9F2; --surface:#fff; --line:#F0E6DA;
  --orange:#FF6B1A; --orange-dark:#E5560A; --yellow:#FFB400;
  --pad: clamp(16px, 4vw, 40px);
}
html[data-theme="dark"]{
  --ink:#F3F4F6; --ink-2:#CBD5E1; --muted:#94A3B8;
  --bg:#0F1216; --surface:#171C22; --line:#2A313A;
  color-scheme:dark;
}

.login-page{
  min-height:100vh;display:grid;grid-template-columns:1fr;
  font-family:'DM Sans',system-ui,sans-serif;color:var(--ink);background:var(--bg);
}

.login-aside{
  display:none;flex-direction:column;justify-content:space-between;
  padding:clamp(28px,4vw,48px);color:#fff;
  background:
    radial-gradient(600px 320px at 10% 0%,rgba(255,180,0,.35),transparent 60%),
    radial-gradient(500px 280px at 100% 100%,rgba(255,107,26,.4),transparent 55%),
    #14171A;
}
.aside-copy{max-width:420px;margin:48px 0}
.aside-copy h2{
  font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(1.8rem,3vw,2.6rem);
  line-height:1.15;letter-spacing:-.02em;margin:0 0 16px;color:#fff;
}
.aside-copy p{margin:0;color:#CBD5E1;font-size:1.05rem;line-height:1.6}
.aside-points{list-style:none;margin:28px 0 0;padding:0;display:grid;gap:12px}
.aside-points li{
  display:flex;align-items:center;gap:10px;color:#E5E7EB;font-weight:500;font-size:.95rem;
}
.aside-points li::before{
  content:"";width:8px;height:8px;border-radius:50%;background:var(--orange);flex:none;
}
.aside-foot{margin:0;font-size:.85rem;color:#94A3B8}

.login-main{
  display:flex;align-items:center;justify-content:center;
  padding:var(--pad);min-height:100vh;
  background:
    radial-gradient(560px 280px at 100% 0%,#FFE2C2 0,transparent 60%),
    radial-gradient(420px 240px at 0% 100%,#FFF0D1 0,transparent 55%),
    var(--bg);
}
html[data-theme="dark"] .login-main{
  background:
    radial-gradient(560px 280px at 100% 0%,rgba(255,107,26,.12) 0,transparent 60%),
    radial-gradient(420px 240px at 0% 100%,rgba(255,180,0,.08) 0,transparent 55%),
    var(--bg);
}
.login-main-inner{width:100%;max-width:440px;display:grid;gap:16px}
.login-main-inner.is-wide{max-width:560px}

.back-link{
  display:inline-flex;align-items:center;gap:6px;width:fit-content;
  color:var(--orange-dark);font-weight:600;font-size:.92rem;text-decoration:none;padding:4px 0;
}
.back-link:hover{text-decoration:underline}

.login-logo{display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:inherit;width:fit-content}
.login-mark{
  display:grid;place-items:center;width:36px;height:36px;border-radius:10px;
  background:linear-gradient(135deg,var(--orange),var(--yellow));
}
.login-brand{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:1.25rem;letter-spacing:-.03em;color:#fff}
.login-brand b{color:var(--yellow)}
.mobile-top{display:flex;flex-direction:column;gap:10px}
.mobile-logo .login-brand{color:var(--ink)}
.mobile-logo .login-brand b{color:var(--orange)}

.login-card{
  width:100%;background:var(--surface);border:1px solid var(--line);
  border-radius:24px;padding:clamp(24px,4vw,32px);
  box-shadow:0 24px 60px -28px rgba(31,35,40,.28);
}
.card-head{margin-bottom:18px}
.login-card h1{
  font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(1.5rem,4vw,1.85rem);
  line-height:1.15;letter-spacing:-.02em;margin:0 0 8px;color:var(--ink);
}
.login-lead{margin:0;color:var(--ink-2);line-height:1.5;font-size:.98rem}
.login-error{
  background:#FEE2E2;color:#991B1B;border-radius:12px;padding:12px 14px;
  font-size:.9rem;margin:0 0 16px;
}
html[data-theme="dark"] .login-error{background:#7F1D1D;color:#FECACA}

.account-type{
  display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 18px;padding:6px;
  border:1px solid var(--line);border-radius:16px;background:rgba(255,247,238,.7);
}
html[data-theme="dark"] .account-type{background:rgba(26,31,38,.8)}
.account-type-btn{
  display:grid;gap:4px;text-align:left;border:1.5px solid transparent;border-radius:12px;
  padding:12px 12px;background:transparent;color:inherit;font:inherit;cursor:pointer;
}
.account-type-btn strong{font-size:.95rem}
.account-type-btn span{font-size:.78rem;color:var(--muted);line-height:1.35}
.account-type-btn:hover{border-color:#FFD0AE}
.account-type-btn.is-active{
  background:var(--surface);border-color:var(--orange);box-shadow:0 1px 0 rgba(31,35,40,.05);
}
.account-type-btn.is-active strong{color:var(--orange-dark)}

.auth-form{display:grid;gap:14px}
.auth-form label{display:grid;gap:6px;font-size:.9rem;font-weight:600;color:var(--ink-2)}
.auth-form input,.auth-form select{
  width:100%;padding:12px 14px;border-radius:12px;border:2px solid var(--line);
  font:inherit;font-weight:500;color:var(--ink);background:var(--surface);box-sizing:border-box;
}
.auth-form input:focus,.auth-form select:focus{outline:none;border-color:var(--orange)}
.auth-form input::placeholder{color:var(--muted)}
.password-field{position:relative}
.password-field input{padding-right:48px}
.eye-btn{
  position:absolute;right:8px;top:50%;transform:translateY(-50%);
  display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:10px;
  background:transparent;color:var(--muted);cursor:pointer;padding:0;
}
.eye-btn:hover{color:var(--orange-dark);background:rgba(255,107,26,.08)}

.rest-block{
  display:grid;gap:12px;padding:14px;border-radius:16px;border:1px solid var(--line);
  background:rgba(255,247,238,.55);
}
html[data-theme="dark"] .rest-block{background:rgba(26,31,38,.65)}
.rest-block-title{
  margin:0;font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--orange);
}
.rest-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.rest-grid .full,.rest-block .full{grid-column:1 / -1}
.cep-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;grid-column:1 / -1}
.cep-actions em,.geo-row em,.geo-row span,.address-preview{
  font-size:.82rem;font-weight:500;color:var(--muted);font-style:normal;line-height:1.4;
}
.address-preview{margin:0}
.address-preview strong{color:var(--ink-2)}
.check-row{
  display:flex!important;align-items:center;gap:8px;font-size:.9rem!important;font-weight:600!important;
}
.check-row input{width:auto}
.geo-row{display:grid;gap:6px}
.secondary-btn{
  border:1.5px solid var(--orange);background:transparent;color:var(--orange-dark);
  border-radius:12px;min-height:40px;padding:0 14px;font:inherit;font-weight:700;cursor:pointer;width:fit-content;
}
.secondary-btn:disabled{opacity:.6;cursor:wait}

.submit-btn{
  margin-top:4px;width:100%;padding:14px 18px;border:0;border-radius:999px;
  background:var(--orange);color:#fff;font-weight:700;font-size:1rem;cursor:pointer;
  box-shadow:0 10px 24px -10px rgba(255,107,26,.8);
}
.submit-btn:hover:not(:disabled){background:var(--orange-dark)}
.submit-btn:disabled{opacity:.7;cursor:not-allowed}

.auth-switch{
  margin:22px 0 0;text-align:center;font-size:.95rem;color:var(--ink-2);line-height:1.5;
}
.auth-switch button{
  border:0;background:none;padding:0;font:inherit;font-weight:700;color:var(--orange-dark);
  cursor:pointer;text-decoration:underline;text-underline-offset:3px;
}
.auth-switch button:hover{color:var(--orange)}
.login-note{margin:14px 0 0;font-size:.82rem;color:var(--muted);text-align:center}

@media (max-width:640px){
  .rest-grid{grid-template-columns:1fr}
  .account-type{grid-template-columns:1fr}
}

@media (min-width:900px){
  .login-page{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .login-aside{display:flex;min-height:100vh}
  .login-main{min-height:100vh;padding:clamp(32px,5vw,56px)}
  .login-main-inner{max-width:420px}
  .login-main-inner.is-wide{max-width:560px}
  .mobile-logo{display:none}
  .mobile-top{display:block}
}
`;
