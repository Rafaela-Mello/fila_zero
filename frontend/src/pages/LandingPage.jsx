import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/* ============================================================
   FilaZero — Landing Page
   ============================================================ */

const BRAND = "FilaZero";

const NAV = [
  { id: "como-funciona", label: "Como Funciona" },
  { id: "restaurantes", label: "Restaurantes" },
  { id: "para-restaurantes", label: "Para Restaurantes" },
  { id: "faq", label: "FAQ" },
];

const INITIAL_RESTAURANTS = [
  { id: "a", name: "Sabor da Praça", dist: "250 m", walk: "3 min a pé", wait: 5, menu: "Feijoada leve, grelhados e 18 saladas" },
  { id: "b", name: "Cantina do Vale", dist: "400 m", walk: "5 min a pé", wait: 15, menu: "Massas, risoto do dia e churrasco" },
  { id: "c", name: "Prato Feito & Cia", dist: "600 m", walk: "8 min a pé", wait: 25, menu: "Prato executivo, peixe e opções fit" },
];

function levelFor(wait) {
  if (wait <= 8) return { key: "low", emoji: "🟢", label: "Baixa Lotação" };
  if (wait <= 18) return { key: "mid", emoji: "🟡", label: "Média Lotação" };
  return { key: "high", emoji: "🔴", label: "Alta Lotação" };
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/* ---------------- Ícones simples (SVG inline) ---------------- */
const Icon = {
  Pin: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
  ),
  Scale: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0L5 7zm14 0l-3 7a3 3 0 0 0 6 0l-3-7z" /></svg>
  ),
  Coffee: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8zM17 9h2a2 2 0 0 1 0 5h-2M7 2v2M11 2v2M15 2v2" /></svg>
  ),
  Check: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
  ),
  Clock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  ),
};

/* ---------------- Logo ---------------- */
function Logo() {
  return (
    <a href="#topo" className="logo" aria-label={`${BRAND} — início`}>
      <span className="logo-mark" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M9 2h6" /></svg>
      </span>
      <span className="logo-text">Fila<b>Zero</b></span>
    </a>
  );
}

/* ---------------- Tema ---------------- */
const THEME_KEY = "filazero-theme";

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

/* ---------------- Header ---------------- */
function Header({ theme, onToggleTheme }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const authButtons = user ? (
    <Link to="/app" className="btn btn-auth btn-auth-primary" onClick={() => setOpen(false)}>
      Minha conta
    </Link>
  ) : (
    <>
      <Link to="/login" className="btn btn-auth btn-auth-outline" onClick={() => setOpen(false)}>
        Entrar
      </Link>
      <Link to="/login?mode=register" className="btn btn-auth btn-auth-primary" onClick={() => setOpen(false)}>
        Cadastre-se
      </Link>
    </>
  );

  return (
    <header className={`header ${scrolled ? "is-scrolled" : ""}`} id="topo">
      <div className="header-inner">
        <Logo />

        <nav className={`nav ${open ? "is-open" : ""}`} aria-label="Navegação principal">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} onClick={() => setOpen(false)}>
              {n.label}
            </a>
          ))}
          <div className="nav-auth-mobile">{authButtons}</div>
        </nav>

        <div className="header-actions">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <div className="header-auth">{authButtons}</div>
          <button
            className="burger"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>
    </header>
  );
}

/* ---------------- Mockup interativo ---------------- */
function LiveCard({ id = "restaurantes-demo" }) {
  const [list, setList] = useState(INITIAL_RESTAURANTS);
  const [selected, setSelected] = useState("a");
  const [seconds, setSeconds] = useState(0);

  // Simula atualização em tempo real
  useEffect(() => {
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    const update = setInterval(() => {
      setList((prev) =>
        prev.map((r) => {
          const base = INITIAL_RESTAURANTS.find((x) => x.id === r.id).wait;
          const delta = Math.round((Math.random() - 0.5) * 4);
          return { ...r, wait: clamp(base + delta, 2, 32) };
        })
      );
      setSeconds(0);
    }, 6000);
    return () => {
      clearInterval(tick);
      clearInterval(update);
    };
  }, []);

  const current = useMemo(() => list.find((r) => r.id === selected), [list, selected]);

  return (
    <div className="phone" id={id}>
      <div className="phone-top">
        <div>
          <p className="phone-eyebrow">Perto de você • Centro, Campinas</p>
          <h3>Almoço agora</h3>
        </div>
        <span className="live"><i /> Ao vivo</span>
      </div>

      <ul className="rest-list">
        {list.map((r) => {
          const lv = levelFor(r.wait);
          return (
            <li key={r.id}>
              <button
                className={`rest ${selected === r.id ? "is-selected" : ""}`}
                onClick={() => setSelected(r.id)}
                aria-pressed={selected === r.id}
              >
                <div className="rest-info">
                  <strong>{r.name}</strong>
                  <span>{r.dist} • {r.walk}</span>
                </div>
                <div className="rest-status">
                  <span className={`badge badge-${lv.key}`}>
                    <span aria-hidden="true">{lv.emoji}</span> {lv.label}
                  </span>
                  <span className="wait">~{r.wait} min de espera</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="detail">
        <p className="detail-title">Hoje no {current.name}</p>
        <p className="detail-text">{current.menu}</p>
        <p className="detail-foot"><Icon.Clock /> Atualizado há {seconds}s</p>
      </div>
    </div>
  );
}

/* ---------------- Hero ---------------- */
function Hero() {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <span className="pill">⚡ Para quem não quer gastar o almoço na fila</span>
          <h1>
            Não perca seu horário de almoço <span className="hl">na fila.</span>
          </h1>
          <p className="lead">
            Descubra o tempo de espera e o nível de lotação dos restaurantes self-service mais
            próximos antes de sair do escritório.
          </p>
          <div className="cta-row">
            <Link to="/login" className="btn btn-primary">Consultar Restaurantes Próximos</Link>
            <Link to="/login?mode=register&tipo=restaurante" className="btn btn-ghost">Sou um Restaurante</Link>
          </div>
          <ul className="trust">
            <li><Icon.Check /> Grátis para quem almoça</li>
            <li><Icon.Check /> Dados em tempo real</li>
            <li><Icon.Check /> Cadastro rápido em segundos</li>
          </ul>
        </div>
        <div className="hero-visual">
          <LiveCard />
        </div>
      </div>
    </section>
  );
}

/* ---------------- Como funciona ---------------- */
const STEPS = [
  { icon: <Icon.Pin />, title: "Consulte no escritório", text: "Veja o status de lotação atualizado em tempo real, sem sair da sua mesa." },
  { icon: <Icon.Scale />, title: "Escolha seu destino", text: "Compare distância, tempo de espera e cardápio e decida em segundos." },
  { icon: <Icon.Coffee />, title: "Aproveite seu tempo", text: "Almoce sem estresse e ainda tenha tempo para um café antes de voltar." },
];

function HowItWorks() {
  return (
    <section id="como-funciona" className="section">
      <div className="container">
        <header className="section-head">
          <span className="eyebrow">Como funciona</span>
          <h2>Do escritório ao prato em 3 passos</h2>
          <p>Sem filas surpresa, sem caminhada à toa.</p>
        </header>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li className="step" key={s.title}>
              <span className="step-num">{i + 1}</span>
              <span className="step-icon">{s.icon}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------- Restaurantes (para trabalhadores) ---------------- */
const LOTACAO_EXAMPLES = [
  { k: "low", t: "Baixa", d: "Até ~8 min", name: "Sabor da Praça", tip: "Ideal pra sair agora" },
  { k: "mid", t: "Média", d: "~9 a 18 min", name: "Cantina do Vale", tip: "Vale a pena se estiver perto" },
  { k: "high", t: "Alta", d: "Mais de ~18 min", name: "Prato Feito & Cia", tip: "Melhor deixar pra depois" },
];

function LotacaoGuide() {
  return (
    <div className="lotacao-guide" aria-label="Exemplos de níveis de lotação">
      {LOTACAO_EXAMPLES.map((l) => (
        <article className={`lotacao-card lotacao-${l.k}`} key={l.k}>
          <div className="lotacao-top">
            <span className={`badge badge-${l.k}`}>
              <span className={`dot dot-${l.k}`} aria-hidden="true" />
              {l.t}
            </span>
            <span className="lotacao-range">{l.d}</span>
          </div>
          <strong>{l.name}</strong>
          <p>{l.tip}</p>
        </article>
      ))}
    </div>
  );
}

function RestaurantsSection() {
  return (
    <section id="restaurantes" className="section section-alt">
      <div className="container split">
        <div>
          <span className="eyebrow">Para quem almoça</span>
          <h2>Veja a lotação antes de levantar da cadeira</h2>
          <p className="muted">
            Cada restaurante parceiro mostra o nível de movimento e o tempo estimado de espera.
            Assim você escolhe onde ir sem surpresa na porta.
          </p>
          <Link to="/login" className="btn btn-primary">Consultar Restaurantes Próximos</Link>
        </div>
        <LotacaoGuide />
      </div>
    </section>
  );
}

/* ---------------- B2B ---------------- */
const B2B_BENEFITS = [
  "Evite a perda de clientes por filas excessivas na entrada.",
  "Fidelize os trabalhadores da região que buscam agilidade.",
  "Tenha métricas claras de horários de pico.",
];

function ForRestaurants() {
  return (
    <section id="para-restaurantes" className="section b2b">
      <div className="container b2b-grid">
        <div>
          <span className="eyebrow eyebrow-light">Para restaurantes</span>
          <h2>Tem um restaurante self-service? Preveja e gerencie seu fluxo de clientes.</h2>
          <ul className="benefits">
            {B2B_BENEFITS.map((b) => (
              <li key={b}><span className="check"><Icon.Check /></span>{b}</li>
            ))}
          </ul>
          <Link to="/login?mode=register&tipo=restaurante" className="btn btn-light">
            Cadastrar meu restaurante
          </Link>
          <p className="b2b-note">Sem fidelidade. Cancele quando quiser.</p>
        </div>
        <div className="stats" aria-label="Exemplo de painel do restaurante">
          <div className="stat"><span>Pico hoje</span><strong>12h40</strong></div>
          <div className="stat"><span>Clientes desviados da fila</span><strong>+18%</strong></div>
          <div className="stat stat-wide">
            <span>Fluxo por horário</span>
            <div className="bars" role="img" aria-label="Gráfico de barras de fluxo entre 11h e 14h">
              {[30, 55, 85, 100, 70, 40].map((h, i) => (
                <i key={i} style={{ height: `${h}%` }} className={h > 80 ? "peak" : ""} />
              ))}
            </div>
            <div className="bars-x"><span>11h</span><span>12h</span><span>13h</span><span>14h</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Depoimentos ---------------- */
const TESTIMONIALS = [
  { quote: "Consigo almoçar com calma e voltar no prazo!", name: "Mariana S.", role: "Analista de Marketing", initials: "MS" },
  { quote: "Otimizamos a distribuição dos clientes no horário de pico.", name: "Roberto A.", role: "Dono de restaurante self-service", initials: "RA" },
];

function Testimonials() {
  return (
    <section className="section section-alt">
      <div className="container">
        <header className="section-head">
          <span className="eyebrow">Prova social</span>
          <h2>Quem usa, almoça melhor</h2>
        </header>
        <div className="testimonials">
          {TESTIMONIALS.map((t) => (
            <figure className="card quote" key={t.name}>
              <blockquote>“{t.quote}”</blockquote>
              <figcaption>
                <span className="avatar" aria-hidden="true">{t.initials}</span>
                <span><strong>{t.name}</strong><small>{t.role}</small></span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="disclaimer">Depoimentos ilustrativos para fins de demonstração.</p>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */
const FAQS = [
  {
    q: "Como as informações de lotação são atualizadas?",
    a: "Os restaurantes parceiros atualizam o nível de movimento por um painel simples, e usamos esses dados para estimar o tempo de espera. Você vê a hora da última atualização em cada card.",
  },
  {
    q: "O aplicativo é gratuito para o trabalhador?",
    a: "Sim! Para quem almoça, o uso é 100% gratuito. Quem paga a mensalidade é o restaurante parceiro.",
  },
  {
    q: "Sou dono de restaurante, como posso testar a plataforma?",
    a: "Clique em “Cadastrar meu restaurante”, crie sua conta e o painel. Atualize a espera, publique o cardápio e acompanhe os feedbacks. Clientes veem seu lugar no Explorar com a hora da última atualização.",
  },
];

function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="section">
      <div className="container narrow">
        <header className="section-head">
          <span className="eyebrow">FAQ</span>
          <h2>Perguntas frequentes</h2>
        </header>
        <div className="accordion">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div className={`acc-item ${isOpen ? "is-open" : ""}`} key={f.q}>
                <h3>
                  <button
                    id={`faq-btn-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                  >
                    {f.q}
                    <span className="chev" aria-hidden="true">+</span>
                  </button>
                </h3>
                <div id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-btn-${i}`} className="acc-panel">
                  <div><p>{f.a}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */
function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-top">
        <div className="footer-brand">
          <Logo />
          <p className="footer-tagline">
            Veja a lotação dos restaurantes self-service perto de você e almoce sem fila.
          </p>
          <p className="footer-loc">Disponível em Campinas — SP</p>
        </div>

        <nav className="footer-nav" aria-label="Rodapé">
          <div className="footer-col">
            <h3>Produto</h3>
            <ul>
              <li><a href="#como-funciona">Como funciona</a></li>
              <li><a href="#restaurantes">Restaurantes</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h3>Empresa</h3>
            <ul>
              <li><a href="#para-restaurantes">Para restaurantes</a></li>
              <li><a href="mailto:contato@filazero.com.br">Contato</a></li>
              <li><a href="#termos">Termos de uso</a></li>
              <li><a href="#privacidade">Privacidade</a></li>
            </ul>
          </div>
        </nav>

        <div className="footer-social">
          <h3>Siga a gente</h3>
          <a
            href="https://instagram.com/filazero"
            className="ig-link"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram do FilaZero"
          >
            <InstagramIcon />
            @filazero
          </a>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <p>© {new Date().getFullYear()} {BRAND}. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- Página ---------------- */
export default function LandingPage() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <>
      <style>{css}</style>
      <Header theme={theme} onToggleTheme={toggleTheme} />
      <main>
        <Hero />
        <HowItWorks />
        <RestaurantsSection />
        <ForRestaurants />
        <Testimonials />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}

/* ============================================================
   ESTILOS (mobile-first)
   ============================================================ */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');

:root{
  --orange:#FF6B1A; --orange-dark:#E5560A; --yellow:#FFB400;
  --ink:#1F2328; --ink-2:#4B5563; --muted:#6B7280;
  --bg:#FFFFFF; --cream:#FFF7EE; --line:#F0E6DA;
  --surface:#FFFFFF; --header-bg:rgba(255,255,255,.88); --nav-bg:#fff;
  --hero-glow-1:#FFE2C2; --hero-glow-2:#FFF0D1;
  --card-soft:#FFE3CC;
  --green:#16A34A; --green-bg:#DCFCE7;
  --amber:#B45309; --amber-bg:#FEF3C7;
  --red:#DC2626; --red-bg:#FEE2E2;
  --radius:18px; --shadow:0 20px 50px -20px rgba(31,35,40,.25);
  /* Escala fluida — conteúdo ocupa a largura da tela */
  --pad-x: clamp(16px, 5vw, 72px);
  --gap: clamp(20px, 4vw, 64px);
  --section-y: clamp(48px, 7vw, 104px);
}
html[data-theme="dark"]{
  --ink:#F3F4F6; --ink-2:#CBD5E1; --muted:#94A3B8;
  --bg:#0F1216; --cream:#1A1F26; --line:#2A313A;
  --surface:#171C22; --header-bg:rgba(15,18,22,.9); --nav-bg:#171C22;
  --hero-glow-1:rgba(255,107,26,.18); --hero-glow-2:rgba(255,180,0,.1);
  --card-soft:#3A2A1C;
  --green-bg:#14532D; --amber-bg:#78350F; --red-bg:#7F1D1D;
  --amber:#FBBF24;
  --shadow:0 20px 50px -20px rgba(0,0,0,.65);
  color-scheme:dark;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;scroll-padding-top:64px}
body{font-family:'Inter',system-ui,sans-serif;color:var(--ink);background:var(--bg);line-height:1.6;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:'Bricolage Grotesque','Inter',sans-serif;line-height:1.12;letter-spacing:-.02em}
a{color:inherit;text-decoration:none}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
ul,ol{list-style:none}
:focus-visible{outline:3px solid var(--orange);outline-offset:3px;border-radius:6px}
.container{width:100%;max-width:none;margin:0;padding:0 var(--pad-x);box-sizing:border-box}
.narrow{max-width:min(820px,100%);margin-left:auto;margin-right:auto}
.section{padding:var(--section-y) 0}
.section-alt{background:var(--cream)}
.section-head{text-align:center;max-width:min(720px,100%);margin:0 auto clamp(28px,4vw,48px)}
.section-head h2{font-size:clamp(1.7rem,4vw,2.6rem);margin:10px 0}
.section-head p,.muted{color:var(--ink-2)}
h2{font-size:clamp(1.6rem,3.8vw,2.5rem)}
.eyebrow{display:inline-block;font-size:.8rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--orange-dark)}
.eyebrow-light{color:var(--yellow)}

/* Botões */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 24px;border-radius:999px;font-weight:600;font-size:1rem;transition:transform .15s,box-shadow .2s,background .2s;text-align:center}
.btn:hover{transform:translateY(-2px)}
.btn-primary{background:var(--orange);color:#fff;box-shadow:0 10px 24px -10px rgba(255,107,26,.8)}
.btn-primary:hover{background:var(--orange-dark)}
.btn-ghost{border:2px solid var(--ink);color:var(--ink)}
.btn-ghost:hover{background:var(--ink);color:#fff}
.btn-outline{border:2px solid var(--orange);color:var(--orange-dark);padding:10px 20px}
.btn-outline:hover{background:var(--orange);color:#fff}
.btn-light{background:#fff;color:#1F2328}
.btn-light:hover{background:var(--yellow)}
html[data-theme="dark"] .btn-light{background:var(--orange);color:#fff}
html[data-theme="dark"] .btn-light:hover{background:var(--orange-dark)}
.btn-auth{padding:7px 14px;font-size:.82rem;font-weight:600;border-radius:999px;line-height:1.2;transform:none}
.btn-auth:hover{transform:none}
.btn-auth-outline{border:1.5px solid var(--orange);color:var(--orange-dark);background:transparent}
.btn-auth-outline:hover{background:var(--orange);color:#fff}
.btn-auth-primary{background:var(--orange);color:#fff;border:1.5px solid var(--orange);box-shadow:0 6px 14px -8px rgba(255,107,26,.7)}
.btn-auth-primary:hover{background:var(--orange-dark);border-color:var(--orange-dark)}

/* Header — logo esq | nav centro | ações dir (largura total da tela) */
.header{position:sticky;top:0;z-index:50;background:var(--header-bg);backdrop-filter:blur(12px);border-bottom:1px solid transparent;transition:border-color .2s,box-shadow .2s,background .2s}
.header.is-scrolled{border-color:var(--line);box-shadow:0 4px 16px -14px rgba(0,0,0,.35)}
.header-inner{
  display:flex;align-items:center;justify-content:space-between;height:56px;
  width:100%;max-width:none;margin:0;padding:0 var(--pad-x);position:relative;box-sizing:border-box;
}
.logo{display:inline-flex;align-items:center;gap:8px;flex:none;z-index:1}
.logo-mark{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,var(--orange),var(--yellow))}
.logo-mark svg{width:16px;height:16px}
.logo-text{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:1.15rem;letter-spacing:-.03em}
.logo-text b{color:var(--orange)}
.header-actions{display:flex;align-items:center;gap:clamp(6px,1vw,10px);flex:none;z-index:1}
.header-auth{display:none;align-items:center;gap:clamp(6px,1vw,10px)}
.theme-toggle{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--ink-2);transition:background .15s,border-color .15s,color .15s}
.theme-toggle:hover{color:var(--orange-dark);border-color:var(--orange);background:var(--cream)}
.nav{position:absolute;top:56px;left:0;right:0;background:var(--nav-bg);display:none;flex-direction:column;gap:2px;padding:12px 20px 18px;border-bottom:1px solid var(--line);box-shadow:0 16px 28px -20px rgba(0,0,0,.22)}
.nav.is-open{display:flex}
.nav a:not(.btn){padding:10px 4px;font-weight:500;font-size:.95rem;color:var(--ink-2)}
.nav a:not(.btn):hover{color:var(--orange-dark)}
.nav-auth-mobile{display:flex;flex-direction:column;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}
.nav-auth-mobile .btn-auth{width:100%;justify-content:center}
.burger{display:flex;flex-direction:column;gap:4px;padding:8px}
.burger span{width:20px;height:2px;background:var(--ink);border-radius:2px}

/* Hero */
.hero{position:relative;overflow:hidden;padding:clamp(28px,5vw,72px) 0 clamp(40px,6vw,88px);background:radial-gradient(900px 420px at 85% -10%,var(--hero-glow-1) 0,transparent 60%),radial-gradient(600px 300px at 0 100%,var(--hero-glow-2) 0,transparent 60%),var(--bg)}
.hero-grid{display:grid;gap:var(--gap);align-items:center}
.pill{display:inline-block;background:var(--surface);border:1px solid var(--line);padding:6px 14px;border-radius:999px;font-size:.85rem;font-weight:500;margin-bottom:14px;box-shadow:0 4px 14px -8px rgba(0,0,0,.2)}
.hero h1{font-size:clamp(2rem,5.5vw,3.6rem);font-weight:800}
.hl{color:var(--orange);position:relative;white-space:nowrap}
.hl::after{content:"";position:absolute;left:0;right:0;bottom:.05em;height:.22em;background:var(--yellow);opacity:.5;z-index:-1;border-radius:4px}
.lead{margin:clamp(14px,2vw,22px) 0 clamp(20px,3vw,28px);font-size:clamp(1rem,1.5vw,1.12rem);color:var(--ink-2);max-width:540px}
.cta-row{display:flex;flex-direction:column;gap:12px}
.trust{display:flex;flex-wrap:wrap;gap:8px clamp(12px,2vw,20px);margin-top:clamp(18px,3vw,26px);font-size:.92rem;color:var(--ink-2)}
.trust li{display:flex;align-items:center;gap:6px}
.trust svg{color:var(--green)}
.hero-visual{position:relative;display:flex;flex-direction:column;align-items:center}

/* Mockup */
.phone{width:100%;max-width:min(440px,100%);background:var(--surface);border-radius:28px;padding:clamp(16px,2vw,22px);border:1px solid var(--line);box-shadow:var(--shadow)}
.phone-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
.phone-eyebrow{font-size:.78rem;color:var(--muted)}
.phone-top h3{font-size:1.4rem}
.live{display:inline-flex;align-items:center;gap:6px;font-size:.75rem;font-weight:600;color:var(--green);background:var(--green-bg);padding:4px 10px;border-radius:999px}
.live i{width:8px;height:8px;border-radius:50%;background:var(--green);animation:pulse 1.6s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(22,163,74,.6)}70%{box-shadow:0 0 0 8px rgba(22,163,74,0)}100%{box-shadow:0 0 0 0 rgba(22,163,74,0)}}
.rest-list{display:grid;gap:10px}
.rest{width:100%;display:flex;flex-direction:column;gap:10px;text-align:left;padding:14px;border:2px solid var(--line);border-radius:16px;background:transparent;transition:border-color .2s,background .2s,transform .15s}
.rest:hover{transform:translateY(-1px);border-color:#FFD0AE}
.rest.is-selected{border-color:var(--orange);background:var(--cream)}
.rest-info strong{display:block;font-size:1rem}
.rest-info span{font-size:.82rem;color:var(--muted)}
.rest-status{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.wait{font-size:.85rem;font-weight:600;color:var(--ink-2)}
.badge{display:inline-flex;gap:6px;align-items:center;font-size:.78rem;font-weight:600;padding:5px 11px;border-radius:999px;transition:background .3s,color .3s}
.badge-low{background:var(--green-bg);color:#166534}
.badge-mid{background:var(--amber-bg);color:var(--amber)}
.badge-high{background:var(--red-bg);color:#FECACA}
.detail{margin-top:14px;padding:14px;border-radius:14px;background:#1F2328;color:#fff}
.detail-title{font-weight:600;font-size:.9rem;color:var(--yellow)}
.detail-text{font-size:.9rem;margin:4px 0 8px;color:#E5E7EB}
.detail-foot{display:flex;align-items:center;gap:6px;font-size:.76rem;color:#9CA3AF}

/* Passos */
.steps{display:grid;gap:clamp(14px,2.5vw,24px);counter-reset:s}
.step{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:clamp(20px,3vw,28px) clamp(18px,2.5vw,24px);transition:transform .2s,box-shadow .2s}
.step:hover{transform:translateY(-4px);box-shadow:var(--shadow)}
.step-num{position:absolute;top:18px;right:22px;font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(2rem,4vw,2.6rem);font-weight:800;color:var(--card-soft)}
.step-icon{display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:var(--cream);color:var(--orange);margin-bottom:16px}
.step h3{font-size:clamp(1.1rem,2vw,1.25rem);margin-bottom:8px}
.step p{color:var(--ink-2)}
html[data-theme="dark"] .badge-low{color:#86EFAC}
html[data-theme="dark"] .btn-ghost:hover{background:var(--orange);border-color:var(--orange);color:#fff}
html[data-theme="dark"] .btn-ghost{border-color:var(--line);color:var(--ink)}

/* Split */
.split{display:grid;gap:var(--gap);align-items:center}
.split h2{margin:10px 0 14px}
.dot{width:14px;height:14px;border-radius:50%;flex:none;display:inline-block}
.dot-low{background:var(--green)}.dot-mid{background:var(--yellow)}.dot-high{background:var(--red)}
.split .btn{margin-top:28px}
.lotacao-guide{display:grid;gap:clamp(12px,2vw,16px);width:100%;margin:0}
.lotacao-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:clamp(14px,2vw,20px);box-shadow:0 10px 28px -22px rgba(31,35,40,.35)}
.lotacao-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.lotacao-card .badge .dot{width:8px;height:8px}
.lotacao-range{font-size:.82rem;font-weight:600;color:var(--muted)}
.lotacao-card strong{display:block;font-size:1.05rem;margin-bottom:4px}
.lotacao-card p{font-size:.9rem;color:var(--ink-2);margin:0}
.lotacao-low{border-left:4px solid var(--green)}
.lotacao-mid{border-left:4px solid var(--yellow)}
.lotacao-high{border-left:4px solid var(--red)}

/* B2B */
.b2b{background:#14171A;color:#fff;position:relative;overflow:hidden}
.b2b::before{content:"";position:absolute;width:520px;height:520px;right:-160px;top:-200px;background:radial-gradient(circle,rgba(255,107,26,.35),transparent 65%)}
.b2b-grid{position:relative;display:grid;gap:var(--gap);align-items:center}
.b2b h2{margin:10px 0 24px;color:#fff}
.benefits{display:grid;gap:14px;margin-bottom:30px}
.benefits li{display:flex;gap:12px;align-items:flex-start;color:#E5E7EB}
.check{flex:none;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--orange);color:#fff;margin-top:1px}
.check svg{width:14px;height:14px}
.b2b-note{margin-top:12px;font-size:.85rem;color:#9CA3AF}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:clamp(10px,2vw,14px)}
.stat{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:clamp(14px,2vw,18px)}
.stat span{font-size:.8rem;color:#CBD5E1;display:block}
.stat strong{font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(1.5rem,3vw,2rem);color:var(--yellow)}
.stat-wide{grid-column:1/-1}
.bars{display:flex;align-items:flex-end;gap:8px;height:110px;margin-top:12px}
.bars i{flex:1;background:rgba(255,255,255,.25);border-radius:6px 6px 0 0}
.bars i.peak{background:var(--orange)}
.bars-x{display:flex;justify-content:space-between;margin-top:6px;font-size:.72rem;color:#94A3B8}
html[data-theme="dark"] .b2b{background:#F4F1EC;color:#1F2328}
html[data-theme="dark"] .b2b::before{background:radial-gradient(circle,rgba(255,107,26,.2),transparent 65%)}
html[data-theme="dark"] .b2b h2{color:#1F2328}
html[data-theme="dark"] .b2b .eyebrow-light{color:var(--orange-dark)}
html[data-theme="dark"] .benefits li{color:#4B5563}
html[data-theme="dark"] .b2b-note{color:#6B7280}
html[data-theme="dark"] .stat{background:#fff;border-color:#E8E0D6}
html[data-theme="dark"] .stat span{color:#6B7280}
html[data-theme="dark"] .stat strong{color:var(--orange-dark)}
html[data-theme="dark"] .bars i{
  background:linear-gradient(180deg,#FFB26A 0%,#FF8A3D 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.35);
}
html[data-theme="dark"] .bars i.peak{
  background:linear-gradient(180deg,#FF8A3D 0%,#E5560A 100%);
}
html[data-theme="dark"] .bars-x{color:#6B7280}

/* Depoimentos */
.testimonials{display:grid;gap:clamp(14px,2.5vw,24px)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:clamp(20px,3vw,28px)}
.quote blockquote{font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(1.1rem,2.2vw,1.3rem);line-height:1.35;margin-bottom:22px}
.quote figcaption{display:flex;align-items:center;gap:12px}
.quote small{display:block;color:var(--muted)}
.avatar{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--orange),var(--yellow));color:#fff;font-weight:700;font-size:.9rem}
.disclaimer{text-align:center;margin-top:20px;font-size:.8rem;color:var(--muted)}

/* FAQ */
.accordion{display:grid;gap:clamp(10px,1.5vw,14px)}
.acc-item{border:1px solid var(--line);border-radius:16px;background:var(--surface);transition:border-color .2s}
.acc-item.is-open{border-color:var(--orange);background:var(--cream)}
.acc-item h3{font-size:clamp(.98rem,1.5vw,1.05rem);font-family:'Inter',sans-serif;letter-spacing:0}
.acc-item button{width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;text-align:left;padding:clamp(14px,2vw,18px) clamp(16px,2vw,20px);font-weight:600}
.chev{flex:none;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--cream);color:var(--orange-dark);font-size:1.3rem;line-height:1;transition:transform .25s}
.is-open .chev{transform:rotate(45deg);background:var(--orange);color:#fff}
.acc-panel{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s ease}
.acc-panel>div{overflow:hidden}
.is-open .acc-panel{grid-template-rows:1fr}
.acc-panel p{padding:0 clamp(16px,2vw,20px) clamp(16px,2vw,20px);color:var(--ink-2)}

/* Footer */
.footer{background:#14171A;color:#94A3B8;padding:clamp(40px,6vw,64px) 0 0}
.footer .logo-text{color:#fff}
.footer-top{display:grid;gap:var(--gap);margin-bottom:clamp(28px,4vw,48px)}
.footer-brand{max-width:min(340px,100%)}
.footer-tagline{margin:14px 0 10px;font-size:.92rem;line-height:1.6;color:#CBD5E1}
.footer-loc{margin:0;font-size:.84rem;color:#64748B}
.footer-nav{display:grid;grid-template-columns:1fr 1fr;gap:clamp(20px,3vw,40px)}
.footer-col{display:flex;flex-direction:column}
.footer h3{font-family:'Inter',sans-serif;font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#fff;margin:0 0 16px}
.footer-col ul{display:flex;flex-direction:column;gap:16px;margin:0;padding:0;list-style:none}
.footer-col a{display:inline-block;font-size:.9rem;color:#94A3B8;transition:color .15s;line-height:1.45;padding:2px 0}
.footer-col a:hover{color:var(--yellow)}
.footer-social{display:flex;flex-direction:column;gap:12px}
.ig-link{display:inline-flex;align-items:center;gap:8px;width:fit-content;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#fff;font-size:.88rem;font-weight:600;transition:background .2s,border-color .2s,color .2s}
.ig-link:hover{background:var(--orange);border-color:var(--orange);color:#fff}
.footer-bottom{border-top:1px solid rgba(255,255,255,.08);padding:clamp(16px,2.5vw,24px) 0}
.footer-bottom-inner{font-size:.8rem;color:#64748B;text-align:center}
.footer-bottom-inner p{margin:0}

/* ≥ 640px */
@media (min-width:640px){
  .cta-row{flex-direction:row;flex-wrap:wrap}
  .rest{flex-direction:row;align-items:center;justify-content:space-between}
  .rest-status{flex-direction:column;align-items:flex-end}
  .steps{grid-template-columns:repeat(3,minmax(0,1fr))}
  .testimonials{grid-template-columns:repeat(2,minmax(0,1fr))}
  .footer-top{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) auto;align-items:start}
}
/* ≥ 900px — colunas iguais preenchendo a largura */
@media (min-width:900px){
  .burger{display:none}
  .nav-auth-mobile{display:none}
  .header-auth{display:flex}
  .header-inner{
    display:grid;grid-template-columns:1fr auto 1fr;align-items:center;
    column-gap:var(--gap);width:100%;
  }
  .logo{justify-self:start}
  .nav{
    position:static;display:flex;flex-direction:row;align-items:center;justify-content:center;
    justify-self:center;gap:clamp(16px,2.5vw,48px);padding:0;border:0;box-shadow:none;background:transparent;
  }
  .nav a:not(.btn){padding:4px 0;font-size:clamp(.82rem,1vw,.92rem);white-space:nowrap}
  .header-actions{justify-self:end;display:flex}
  .hero-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gap)}
  .hero-visual{align-items:stretch}
  .hero-visual .phone{max-width:none;margin-left:auto;width:min(100%,480px)}
  .split{grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gap)}
  .b2b-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gap)}
  .steps{gap:var(--gap)}
  .testimonials{gap:var(--gap)}
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  *{animation:none!important;transition:none!important}
}
`;
