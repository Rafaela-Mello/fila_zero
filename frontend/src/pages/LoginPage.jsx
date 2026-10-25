import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const GOOGLE_ERRORS = {
  google_not_configured: "Login com Google ainda não está configurado no servidor.",
  google_failed: "Não foi possível entrar com o Google. Tente de novo.",
};

export default function LoginPage() {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState("login"); // login | register
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(GOOGLE_ERRORS[params.get("error")] || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/app", { replace: true });
  }, [user, loading, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "register") {
        await register({ name, email, password });
      } else {
        await login({ email, password });
      }
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err.message || "Falha na autenticação.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <style>{loginCss}</style>
      <div className="login-page">
        <div className="login-bg" aria-hidden="true" />
        <div className="login-shell">
          <header className="login-top">
            <Link to="/" className="back-link">
              <span aria-hidden="true">←</span> Página inicial
            </Link>
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
          </header>

          <div className="login-card">
          <h1>{mode === "login" ? "Entrar na sua conta" : "Criar sua conta"}</h1>
          <p className="login-lead">
            Use e-mail e senha ou continue com Google.
          </p>

          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? "is-active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={mode === "register" ? "is-active" : ""}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              Cadastrar
            </button>
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <form className="auth-form" onSubmit={onSubmit}>
            {mode === "register" && (
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
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Sua senha"}
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
              {submitting
                ? "Aguarde..."
                : mode === "login"
                  ? "Entrar"
                  : "Criar conta"}
            </button>
          </form>

          <div className="divider">
            <span>ou</span>
          </div>

          <a className="google-btn" href="/auth/google">
            <GoogleIcon />
            Entrar com Google
          </a>

          <p className="login-note">
            Ao continuar, você concorda com os Termos de Uso do FilaZero.
          </p>
          </div>
        </div>
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
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');

.login-page{
  min-height:100vh;display:grid;place-items:center;padding:20px;position:relative;
  font-family:'DM Sans',system-ui,sans-serif;color:#1F2328;
}
.login-bg{
  position:fixed;inset:0;z-index:-1;
  background:
    radial-gradient(700px 360px at 90% -10%,#FFE2C2 0,transparent 60%),
    radial-gradient(520px 280px at 0% 100%,#FFF0D1 0,transparent 55%),
    linear-gradient(160deg,#FFF9F2,#fff 45%,#FFF7EE);
}
.login-shell{width:100%;max-width:440px;display:grid;gap:14px}
.login-top{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:4px 4px 0;
}
.back-link{
  display:inline-flex;align-items:center;gap:6px;color:#E5560A;font-weight:600;font-size:.92rem;
  text-decoration:none;padding:8px 0;
}
.back-link:hover{text-decoration:underline}
.login-logo{display:inline-flex;align-items:center;gap:8px;text-decoration:none;color:inherit}
.login-mark{
  display:grid;place-items:center;width:34px;height:34px;border-radius:10px;
  background:linear-gradient(135deg,#FF6B1A,#FFB400);
}
.login-brand{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:1.2rem;letter-spacing:-.03em}
.login-brand b{color:#FF6B1A}
.login-card{
  width:100%;background:#fff;border:1px solid #F0E6DA;
  border-radius:28px;padding:28px 28px 32px;box-shadow:0 24px 60px -28px rgba(31,35,40,.28);
}
.login-card h1{
  font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(1.55rem,4vw,1.9rem);
  line-height:1.15;letter-spacing:-.02em;margin:0 0 8px;
}
.login-lead{margin:0 0 22px;color:#4B5563;line-height:1.5;font-size:.98rem}
.tabs{
  display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:6px;margin-bottom:18px;
  background:#FFF7EE;border-radius:999px;border:1px solid #F0E6DA;
}
.tabs button{
  border:0;background:transparent;padding:10px 12px;border-radius:999px;
  font-weight:600;color:#6B7280;cursor:pointer;
}
.tabs button.is-active{background:#fff;color:#E5560A;box-shadow:0 4px 14px -8px rgba(0,0,0,.25)}
.login-error{
  background:#FEE2E2;color:#991B1B;border-radius:12px;padding:12px 14px;
  font-size:.9rem;margin:0 0 14px;
}
.auth-form{display:grid;gap:14px}
.auth-form label{display:grid;gap:6px;font-size:.9rem;font-weight:600;color:#374151}
.auth-form input{
  width:100%;padding:12px 14px;border-radius:12px;border:2px solid #E5E7EB;
  font:inherit;font-weight:500;color:#1F2328;background:#fff;
}
.auth-form input:focus{outline:none;border-color:#FF6B1A}
.password-field{position:relative}
.password-field input{padding-right:48px}
.eye-btn{
  position:absolute;right:8px;top:50%;transform:translateY(-50%);
  display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:10px;
  background:transparent;color:#6B7280;cursor:pointer;padding:0;
}
.eye-btn:hover{color:#E5560A;background:#FFF7EE}
.submit-btn{
  margin-top:4px;width:100%;padding:14px 18px;border:0;border-radius:999px;
  background:#FF6B1A;color:#fff;font-weight:700;font-size:1rem;cursor:pointer;
  box-shadow:0 10px 24px -10px rgba(255,107,26,.8);
}
.submit-btn:hover:not(:disabled){background:#E5560A}
.submit-btn:disabled{opacity:.7;cursor:wait}
.divider{
  display:flex;align-items:center;gap:12px;margin:20px 0 16px;color:#9CA3AF;font-size:.85rem;
}
.divider::before,.divider::after{content:"";flex:1;height:1px;background:#E5E7EB}
.google-btn{
  display:flex;align-items:center;justify-content:center;gap:12px;width:100%;
  padding:14px 18px;border-radius:999px;border:2px solid #E5E7EB;background:#fff;
  font-weight:600;font-size:1rem;text-decoration:none;color:#1F2328;
  transition:transform .15s,border-color .2s,box-shadow .2s;
}
.google-btn:hover{transform:translateY(-2px);border-color:#FF6B1A;box-shadow:0 10px 24px -14px rgba(255,107,26,.7)}
.login-note{margin:18px 0 0;font-size:.82rem;color:#6B7280;text-align:center}
`;
