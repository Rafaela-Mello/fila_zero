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

/* ---------------- Header ---------------- */
function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`header ${scrolled ? "is-scrolled" : ""}`} id="topo">
      <div className="container header-inner">
        <Logo />
        <nav className={`nav ${open ? "is-open" : ""}`} aria-label="Navegação principal">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} onClick={() => setOpen(false)}>
              {n.label}
            </a>
          ))}
          {user ? (
            <Link to="/app" className="btn btn-outline nav-cta" onClick={() => setOpen(false)}>
              Minha conta
            </Link>
          ) : (
            <Link to="/login" className="btn btn-outline nav-cta" onClick={() => setOpen(false)}>
              Entrar
            </Link>
          )}
        </nav>
        <button
          className="burger"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span /><span /><span />
        </button>
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
            <a href="#para-restaurantes" className="btn btn-ghost">Sou um Restaurante</a>
          </div>
          <ul className="trust">
            <li><Icon.Check /> Grátis para quem almoça</li>
            <li><Icon.Check /> Dados em tempo real</li>
            <li><Icon.Check /> Sem cadastro para consultar</li>
          </ul>
        </div>
        <div className="hero-visual">
          <LiveCard />
          <div className="float-row" aria-hidden="true">
            <div className="float float-1">⏱️ Você economizou <b>20 min</b></div>
            <div className="float float-2">☕ Sobrou tempo pro café</div>
          </div>
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
function RestaurantsSection() {
  const legend = [
    { k: "low", t: "Baixa", d: "Até ~8 min" },
    { k: "mid", t: "Média", d: "~9 a 18 min" },
    { k: "high", t: "Alta", d: "Mais de ~18 min" },
  ];
  return (
    <section id="restaurantes" className="section section-alt">
      <div className="container split">
        <div>
          <span className="eyebrow">Para quem almoça</span>
          <h2>Veja a lotação antes de levantar da cadeira</h2>
          <p className="muted">
            Cada restaurante parceiro mostra o nível de movimento e o tempo estimado de espera.
            Toque em um deles ao lado para ver o cardápio do dia.
          </p>
          <ul className="legend">
            {legend.map((l) => (
              <li key={l.k}>
                <span className={`dot dot-${l.k}`} />
                <div><strong>{l.t}</strong><span>{l.d}</span></div>
              </li>
            ))}
          </ul>
          <a href="#topo" className="btn btn-primary">Consultar Restaurantes Próximos</a>
        </div>
        <LiveCard id="restaurantes-live" />
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
          <a href="mailto:contato@filazero.com.br?subject=Quero%20cadastrar%20meu%20restaurante" className="btn btn-light">
            Cadastrar meu restaurante (R$ 150/mês)
          </a>
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
    a: "Entre em contato pelo botão “Cadastrar meu restaurante”. Nossa equipe configura seu painel e você acompanha o fluxo de clientes no horário de almoço. O plano custa R$ 150/mês, sem fidelidade.",
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
function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Logo />
          <p className="footer-loc">📍 Disponível inicialmente em Campinas - SP</p>
        </div>
        <nav aria-label="Legal" className="footer-links">
          <a href="#termos">Termos de Uso</a>
          <a href="#privacidade">Política de Privacidade</a>
        </nav>
        <div className="social" aria-label="Redes sociais">
          <a href="#instagram" aria-label="Instagram">IG</a>
          <a href="#linkedin" aria-label="LinkedIn">in</a>
          <a href="#x" aria-label="X">X</a>
        </div>
      </div>
      <div className="container copy">© {new Date().getFullYear()} {BRAND}. Todos os direitos reservados.</div>
    </footer>
  );
}

/* ---------------- Página ---------------- */
export default function LandingPage() {
  return (
    <>
      <style>{css}</style>
      <Header />
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
  --green:#16A34A; --green-bg:#DCFCE7;
  --amber:#B45309; --amber-bg:#FEF3C7;
  --red:#DC2626; --red-bg:#FEE2E2;
  --radius:18px; --shadow:0 20px 50px -20px rgba(31,35,40,.25);
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;scroll-padding-top:76px}
body{font-family:'Inter',system-ui,sans-serif;color:var(--ink);background:var(--bg);line-height:1.6;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:'Bricolage Grotesque','Inter',sans-serif;line-height:1.12;letter-spacing:-.02em}
a{color:inherit;text-decoration:none}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
ul,ol{list-style:none}
:focus-visible{outline:3px solid var(--orange);outline-offset:3px;border-radius:6px}
.container{width:100%;max-width:1160px;margin:0 auto;padding:0 20px}
.narrow{max-width:780px}
.section{padding:72px 0}
.section-alt{background:var(--cream)}
.section-head{text-align:center;max-width:640px;margin:0 auto 44px}
.section-head h2{font-size:clamp(1.9rem,5vw,2.6rem);margin:10px 0}
.section-head p,.muted{color:var(--ink-2)}
h2{font-size:clamp(1.8rem,4.6vw,2.5rem)}
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
.btn-light{background:#fff;color:var(--ink)}
.btn-light:hover{background:var(--yellow)}

/* Header */
.header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.85);backdrop-filter:blur(12px);border-bottom:1px solid transparent;transition:border-color .2s,box-shadow .2s}
.header.is-scrolled{border-color:var(--line);box-shadow:0 6px 20px -16px rgba(0,0,0,.3)}
.header-inner{display:flex;align-items:center;justify-content:space-between;height:68px}
.logo{display:inline-flex;align-items:center;gap:10px}
.logo-mark{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,var(--orange),var(--yellow))}
.logo-text{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:1.3rem;letter-spacing:-.03em}
.logo-text b{color:var(--orange)}
.nav{position:absolute;top:68px;left:0;right:0;background:#fff;display:none;flex-direction:column;gap:4px;padding:16px 20px 24px;border-bottom:1px solid var(--line);box-shadow:0 20px 30px -20px rgba(0,0,0,.2)}
.nav.is-open{display:flex}
.nav a:not(.btn){padding:12px 4px;font-weight:500;color:var(--ink-2)}
.nav a:not(.btn):hover{color:var(--orange-dark)}
.nav-cta{margin-top:8px}
.burger{display:flex;flex-direction:column;gap:5px;padding:10px}
.burger span{width:24px;height:2.5px;background:var(--ink);border-radius:2px}

/* Hero */
.hero{position:relative;overflow:hidden;padding:48px 0 72px;background:radial-gradient(900px 420px at 85% -10%,#FFE2C2 0,transparent 60%),radial-gradient(600px 300px at 0 100%,#FFF0D1 0,transparent 60%),var(--bg)}
.hero-grid{display:grid;gap:48px}
.pill{display:inline-block;background:#fff;border:1px solid var(--line);padding:6px 14px;border-radius:999px;font-size:.85rem;font-weight:500;margin-bottom:18px;box-shadow:0 4px 14px -8px rgba(0,0,0,.2)}
.hero h1{font-size:clamp(2.4rem,9vw,4.1rem);font-weight:800}
.hl{color:var(--orange);position:relative;white-space:nowrap}
.hl::after{content:"";position:absolute;left:0;right:0;bottom:.05em;height:.22em;background:var(--yellow);opacity:.5;z-index:-1;border-radius:4px}
.lead{margin:20px 0 28px;font-size:1.12rem;color:var(--ink-2);max-width:540px}
.cta-row{display:flex;flex-direction:column;gap:12px}
.trust{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:26px;font-size:.92rem;color:var(--ink-2)}
.trust li{display:flex;align-items:center;gap:6px}
.trust svg{color:var(--green)}
.hero-visual{position:relative;display:flex;flex-direction:column;align-items:center;gap:16px}
.float-row{display:none;flex-wrap:wrap;justify-content:center;gap:10px;width:100%;max-width:400px}
.float{background:#fff;padding:10px 14px;border-radius:14px;font-size:.85rem;box-shadow:var(--shadow);border:1px solid var(--line)}

/* Mockup */
.phone{width:100%;max-width:400px;background:#fff;border-radius:28px;padding:20px;border:1px solid var(--line);box-shadow:var(--shadow)}
.phone-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
.phone-eyebrow{font-size:.78rem;color:var(--muted)}
.phone-top h3{font-size:1.4rem}
.live{display:inline-flex;align-items:center;gap:6px;font-size:.75rem;font-weight:600;color:var(--green);background:var(--green-bg);padding:4px 10px;border-radius:999px}
.live i{width:8px;height:8px;border-radius:50%;background:var(--green);animation:pulse 1.6s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(22,163,74,.6)}70%{box-shadow:0 0 0 8px rgba(22,163,74,0)}100%{box-shadow:0 0 0 0 rgba(22,163,74,0)}}
.rest-list{display:grid;gap:10px}
.rest{width:100%;display:flex;flex-direction:column;gap:10px;text-align:left;padding:14px;border:2px solid var(--line);border-radius:16px;transition:border-color .2s,background .2s,transform .15s}
.rest:hover{transform:translateY(-1px);border-color:#FFD0AE}
.rest.is-selected{border-color:var(--orange);background:var(--cream)}
.rest-info strong{display:block;font-size:1rem}
.rest-info span{font-size:.82rem;color:var(--muted)}
.rest-status{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.wait{font-size:.85rem;font-weight:600;color:var(--ink-2)}
.badge{display:inline-flex;gap:6px;align-items:center;font-size:.78rem;font-weight:600;padding:5px 11px;border-radius:999px;transition:background .3s,color .3s}
.badge-low{background:var(--green-bg);color:#166534}
.badge-mid{background:var(--amber-bg);color:var(--amber)}
.badge-high{background:var(--red-bg);color:#991B1B}
.detail{margin-top:14px;padding:14px;border-radius:14px;background:var(--ink);color:#fff}
.detail-title{font-weight:600;font-size:.9rem;color:var(--yellow)}
.detail-text{font-size:.9rem;margin:4px 0 8px;color:#E5E7EB}
.detail-foot{display:flex;align-items:center;gap:6px;font-size:.76rem;color:#9CA3AF}

/* Passos */
.steps{display:grid;gap:20px;counter-reset:s}
.step{position:relative;background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:28px 24px;transition:transform .2s,box-shadow .2s}
.step:hover{transform:translateY(-4px);box-shadow:var(--shadow)}
.step-num{position:absolute;top:18px;right:22px;font-family:'Bricolage Grotesque',sans-serif;font-size:2.6rem;font-weight:800;color:#FFE3CC}
.step-icon{display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:var(--cream);color:var(--orange);margin-bottom:16px}
.step h3{font-size:1.25rem;margin-bottom:8px}
.step p{color:var(--ink-2)}

/* Split */
.split{display:grid;gap:44px;align-items:center}
.split h2{margin:10px 0 14px}
.legend{display:grid;gap:12px;margin:24px 0 28px}
.legend li{display:flex;gap:12px;align-items:center}
.legend strong{display:block;font-size:.95rem}
.legend span{font-size:.85rem;color:var(--muted)}
.dot{width:14px;height:14px;border-radius:50%;flex:none}
.dot-low{background:var(--green)}.dot-mid{background:var(--yellow)}.dot-high{background:var(--red)}
#restaurantes-live{margin:0 auto}

/* B2B */
.b2b{background:var(--ink);color:#fff;position:relative;overflow:hidden}
.b2b::before{content:"";position:absolute;width:520px;height:520px;right:-160px;top:-200px;background:radial-gradient(circle,rgba(255,107,26,.35),transparent 65%)}
.b2b-grid{position:relative;display:grid;gap:44px;align-items:center}
.b2b h2{margin:10px 0 24px}
.benefits{display:grid;gap:14px;margin-bottom:30px}
.benefits li{display:flex;gap:12px;align-items:flex-start;color:#E5E7EB}
.check{flex:none;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--orange);color:#fff;margin-top:1px}
.check svg{width:14px;height:14px}
.b2b-note{margin-top:12px;font-size:.85rem;color:#9CA3AF}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.stat{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px}
.stat span{font-size:.8rem;color:#CBD5E1;display:block}
.stat strong{font-family:'Bricolage Grotesque',sans-serif;font-size:2rem;color:var(--yellow)}
.stat-wide{grid-column:1/-1}
.bars{display:flex;align-items:flex-end;gap:8px;height:110px;margin-top:12px}
.bars i{flex:1;background:rgba(255,255,255,.25);border-radius:6px 6px 0 0}
.bars i.peak{background:var(--orange)}
.bars-x{display:flex;justify-content:space-between;margin-top:6px;font-size:.72rem;color:#94A3B8}

/* Depoimentos */
.testimonials{display:grid;gap:20px}
.card{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:28px}
.quote blockquote{font-family:'Bricolage Grotesque',sans-serif;font-size:1.3rem;line-height:1.35;margin-bottom:22px}
.quote figcaption{display:flex;align-items:center;gap:12px}
.quote small{display:block;color:var(--muted)}
.avatar{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--orange),var(--yellow));color:#fff;font-weight:700;font-size:.9rem}
.disclaimer{text-align:center;margin-top:20px;font-size:.8rem;color:var(--muted)}

/* FAQ */
.accordion{display:grid;gap:12px}
.acc-item{border:1px solid var(--line);border-radius:16px;background:#fff;transition:border-color .2s}
.acc-item.is-open{border-color:var(--orange);background:var(--cream)}
.acc-item h3{font-size:1.05rem;font-family:'Inter',sans-serif;letter-spacing:0}
.acc-item button{width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;text-align:left;padding:18px 20px;font-weight:600}
.chev{flex:none;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--cream);color:var(--orange-dark);font-size:1.3rem;line-height:1;transition:transform .25s}
.is-open .chev{transform:rotate(45deg);background:var(--orange);color:#fff}
.acc-panel{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s ease}
.acc-panel>div{overflow:hidden}
.is-open .acc-panel{grid-template-rows:1fr}
.acc-panel p{padding:0 20px 20px;color:var(--ink-2)}

/* Footer */
.footer{background:#14171A;color:#CBD5E1;padding:48px 0 0}
.footer .logo-text{color:#fff}
.footer-grid{display:grid;gap:28px}
.footer-loc{margin-top:12px;font-size:.9rem}
.footer-links{display:flex;flex-wrap:wrap;gap:8px 24px}
.footer-links a:hover{color:var(--yellow)}
.social{display:flex;gap:10px}
.social a{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.08);font-weight:700;font-size:.85rem;transition:background .2s}
.social a:hover{background:var(--orange);color:#fff}
.copy{margin-top:36px;padding:20px;border-top:1px solid rgba(255,255,255,.08);font-size:.82rem;color:#94A3B8;text-align:center}

/* ≥ 640px */
@media (min-width:640px){
  .cta-row{flex-direction:row}
  .rest{flex-direction:row;align-items:center;justify-content:space-between}
  .rest-status{flex-direction:column;align-items:flex-end}
  .steps{grid-template-columns:repeat(3,1fr)}
  .testimonials{grid-template-columns:1fr 1fr}
  .footer-grid{grid-template-columns:1fr auto auto;align-items:center}
}
/* ≥ 900px */
@media (min-width:900px){
  .container{padding:0 32px}
  .section{padding:104px 0}
  .burger{display:none}
  .nav{position:static;display:flex;flex-direction:row;align-items:center;gap:28px;padding:0;border:0;box-shadow:none;background:transparent}
  .nav a:not(.btn){padding:6px 0}
  .nav-cta{margin:0}
  .hero{padding:80px 0 110px}
  .hero-grid{grid-template-columns:1.1fr .9fr;align-items:center}
  .float-row{display:flex}
  .float{animation:bob 4s ease-in-out infinite}
  .float-2{animation-delay:1.5s}
  .split{grid-template-columns:1fr 1fr}
  .b2b-grid{grid-template-columns:1.1fr .9fr}
}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  *{animation:none!important;transition:none!important}
}
`;
