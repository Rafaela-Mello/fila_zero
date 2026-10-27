import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const GOOGLE_ERRORS = {
  google_not_configured: "Login com Google ainda não está configurado no servidor.",
  google_failed: "Não foi possível entrar com o Google. Tente de novo.",
};

const THEME_KEY = "filazero-theme";

export default function LoginPage() {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialMode = params.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(GOOGLE_ERRORS[params.get("error")] || "");
  const [submitting, setSubmitting] = useState(false);

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
    if (!loading && user) navigate(destFor(user), { replace: true });
  }, [user, loading, navigate, nextPath]);

  useEffect(() => {
    setMode(params.get("mode") === "register" ? "register" : "login");
  }, [params]);

  const switchMode = (next) => {
    setMode(next);
    setError("");
    navigate(next === "register" ? "/login?mode=register" : "/login", { replace: true });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const u =
        mode === "register"
          ? await register({ name, email, password })
          : await login({ email, password });
      navigate(destFor(u), { replace: true });
    } catch (err) {
      setError(err.message || "Falha na autenticação.");
    } finally {
      setSubmitting(false);
    }
  };

  const isLogin = mode === "login";

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
            <h2>Almoce sem perder tempo na fila.</h2>
            <p>
              Veja a lotação dos restaurantes self-service perto de você e escolha o melhor horário
              antes de sair do escritório.
            </p>
            <ul className="aside-points">
              <li>Grátis para quem almoça</li>
              <li>Dados em tempo real</li>
              <li>Cadastro em segundos</li>
            </ul>
          </div>

          <p className="aside-foot">Campinas — SP</p>
        </aside>

        <main className="login-main">
          <div className="login-main-inner">
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
                <h1>{isLogin ? "Entrar na sua conta" : "Criar sua conta"}</h1>
                <p className="login-lead">
                  {isLogin
                    ? "Use e-mail e senha ou continue com Google."
                    : "Crie sua conta grátis para consultar restaurantes perto de você."}
                </p>
              </header>

              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}

              <form className="auth-form" onSubmit={onSubmit}>
                {!isLogin && (
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

                <button type="submit" className="submit-btn" disabled={submitting}>
                  {submitting ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"}
                </button>
              </form>

              <div className="divider">
                <span>ou</span>
              </div>

              <a className="google-btn" href="/auth/google">
                <GoogleIcon />
                {isLogin ? "Entrar com Google" : "Cadastrar com Google"}
              </a>

              <p className="auth-switch">
                {isLogin ? (
                  <>
                    Não tem conta?{" "}
                    <button type="button" onClick={() => switchMode("register")}>
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

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 33 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.3l-6.3-5.3C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.3 5.3C39.9 36.3 44 30.7 44 24c0-1.2-.1-2.3-.4-3.5z" />
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
.card-head{margin-bottom:22px}
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

.auth-form{display:grid;gap:14px}
.auth-form label{display:grid;gap:6px;font-size:.9rem;font-weight:600;color:var(--ink-2)}
.auth-form input{
  width:100%;padding:12px 14px;border-radius:12px;border:2px solid var(--line);
  font:inherit;font-weight:500;color:var(--ink);background:var(--surface);box-sizing:border-box;
}
.auth-form input:focus{outline:none;border-color:var(--orange)}
.auth-form input::placeholder{color:var(--muted)}
.password-field{position:relative}
.password-field input{padding-right:48px}
.eye-btn{
  position:absolute;right:8px;top:50%;transform:translateY(-50%);
  display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:10px;
  background:transparent;color:var(--muted);cursor:pointer;padding:0;
}
.eye-btn:hover{color:var(--orange-dark);background:rgba(255,107,26,.08)}

.submit-btn{
  margin-top:4px;width:100%;padding:14px 18px;border:0;border-radius:999px;
  background:var(--orange);color:#fff;font-weight:700;font-size:1rem;cursor:pointer;
  box-shadow:0 10px 24px -10px rgba(255,107,26,.8);
}
.submit-btn:hover:not(:disabled){background:var(--orange-dark)}
.submit-btn:disabled{opacity:.7;cursor:wait}

.divider{
  display:flex;align-items:center;gap:12px;margin:20px 0 16px;color:var(--muted);font-size:.85rem;
}
.divider::before,.divider::after{content:"";flex:1;height:1px;background:var(--line)}

.google-btn{
  display:flex;align-items:center;justify-content:center;gap:12px;width:100%;
  padding:14px 18px;border-radius:999px;border:2px solid var(--line);background:var(--surface);
  font-weight:600;font-size:1rem;text-decoration:none;color:var(--ink);box-sizing:border-box;
  transition:transform .15s,border-color .2s,box-shadow .2s;
}
.google-btn:hover{transform:translateY(-2px);border-color:var(--orange);box-shadow:0 10px 24px -14px rgba(255,107,26,.7)}

.auth-switch{
  margin:22px 0 0;text-align:center;font-size:.95rem;color:var(--ink-2);line-height:1.5;
}
.auth-switch button{
  border:0;background:none;padding:0;font:inherit;font-weight:700;color:var(--orange-dark);
  cursor:pointer;text-decoration:underline;text-underline-offset:3px;
}
.auth-switch button:hover{color:var(--orange)}
.login-note{margin:14px 0 0;font-size:.82rem;color:var(--muted);text-align:center}

@media (min-width:900px){
  .login-page{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .login-aside{display:flex;min-height:100vh}
  .login-main{min-height:100vh;padding:clamp(32px,5vw,56px)}
  .login-main-inner{max-width:420px}
  .mobile-logo{display:none}
  .mobile-top{display:block}
}
`;
