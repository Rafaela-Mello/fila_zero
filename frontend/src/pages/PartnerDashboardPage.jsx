import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AccountPanel from "../components/AccountPanel.jsx";
import { mergeFeedbacksWithMocks } from "../components/AppExtras.jsx";

const THEME_KEY = "filazero-theme";

const MENU_ITEMS = [
  { id: "espera", label: "Espera", highlight: true },
  { id: "aovivo", label: "Ao vivo" },
  { id: "cardapio", label: "Cardápio" },
  { id: "horarios", label: "Horários" },
  { id: "feedbacks", label: "Feedbacks" },
  { id: "relatorio", label: "Relatório" },
];

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = {
  mon: "Segunda",
  tue: "Terça",
  wed: "Quarta",
  thu: "Quinta",
  fri: "Sexta",
  sat: "Sábado",
  sun: "Domingo",
};
const DEFAULT_HOURS = {
  mon: { open: "11:00", close: "15:00", closed: false },
  tue: { open: "11:00", close: "15:00", closed: false },
  wed: { open: "11:00", close: "15:00", closed: false },
  thu: { open: "11:00", close: "15:00", closed: false },
  fri: { open: "11:00", close: "15:00", closed: false },
  sat: { open: "11:00", close: "16:00", closed: false },
  sun: { open: "11:00", close: "15:00", closed: true },
};

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

function emptyDish() {
  return { name: "", description: "", price: "", image: null };
}

function starLabel(rating) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function formatReviewWhen(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

function ReportBars({ series = [], ariaLabel }) {
  const max = Math.max(1, ...series.map((s) => Number(s.value) || 0));
  const peak = Math.max(...series.map((s) => Number(s.value) || 0));
  const xLabels = series.map((s) => s.label).filter(Boolean);
  return (
    <div className="report-chart" aria-label={ariaLabel}>
      <div className="report-bars" role="img" aria-label={ariaLabel}>
        {series.map((s, i) => {
          const value = Number(s.value) || 0;
          const h = Math.max(6, Math.round((value / max) * 100));
          return (
            <i
              key={`${s.label || "b"}-${i}`}
              style={{ height: `${h}%` }}
              className={value > 0 && value === peak ? "peak" : ""}
              title={`${s.label || ""}: ${value}`}
            />
          );
        })}
      </div>
      {xLabels.length ? (
        <div className="report-bars-x">
          {series.map((s, i) => (
            <span key={`x-${i}`}>{s.label || ""}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function compressImageFile(file, maxSize = 900, quality = 0.78) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith("image/")) {
      reject(new Error("Selecione uma imagem."));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Imagem muito grande (máx. 8 MB)."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function formatWaitUpdated(value) {
  if (!value) return "Ainda não atualizado";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return "Agora há pouco";
    if (diff < 3_600_000) {
      const m = Math.round(diff / 60_000);
      return `Há ${m} min`;
    }
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

const WAIT_LEVELS = [
  {
    level: "low",
    label: "Baixa",
    mins: 6,
    hint: "Fila fluindo — bom momento para atrair clientes.",
    tone: "good",
  },
  {
    level: "mid",
    label: "Média",
    mins: 14,
    hint: "Movimento normal de horário de pico.",
    tone: "warn",
  },
  {
    level: "high",
    label: "Alta",
    mins: 25,
    hint: "Casa cheia — avise quem está a caminho.",
    tone: "hot",
  },
];

const WAIT_QUICK = [0, 5, 10, 15, 20, 30, 45];

export default function PartnerDashboardPage() {
  const { user, loading, logout, refresh } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [boot, setBoot] = useState(true);
  const [panel, setPanel] = useState("espera");
  const [menuOpen, setMenuOpen] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 861px)").matches : true
  );
  const [theme, setTheme] = useState(getInitialTheme);
  const [waitMinutes, setWaitMinutes] = useState(10);
  const [isOpen, setIsOpen] = useState(true);
  const [capacityTotal, setCapacityTotal] = useState("");
  const [capacityFree, setCapacityFree] = useState("");
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const [menuItems, setMenuItems] = useState([emptyDish(), emptyDish()]);
  const [removeDishIndex, setRemoveDishIndex] = useState(null);
  const [feedbacks, setFeedbacks] = useState({ reviewCount: 0, avgRating: null, reviews: [] });
  const [fbFilter, setFbFilter] = useState("all"); // all | real | mock
  const [liveStats, setLiveStats] = useState({
    last15Min: 0,
    last60Min: 0,
    today: 0,
    recent: [],
  });
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [extraSaving, setExtraSaving] = useState(false);

  const syncStatusFields = (r) => {
    if (!r) return;
    setIsOpen(r.isOpen !== false);
    setCapacityTotal(r.capacityTotal != null ? String(r.capacityTotal) : "");
    setCapacityFree(r.capacityFree != null ? String(r.capacityFree) : "");
    setHours(r.hours ? { ...DEFAULT_HOURS, ...r.hours } : DEFAULT_HOURS);
    setReminderEnabled(r.reminderEnabled !== false);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const loadAll = useCallback(async () => {
    const res = await fetch("/api/partners/me", { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Falha ao carregar");
    setRestaurant(data.restaurant);
    if (data.restaurant) {
      setWaitMinutes(data.restaurant.waitMinutes ?? 10);
      syncStatusFields(data.restaurant);
    }
    return data.restaurant;
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setBoot(false);
      return;
    }
    loadAll()
      .catch((err) => setError(err.message))
      .finally(() => setBoot(false));
  }, [user, loading, loadAll]);

  useEffect(() => {
    if (!restaurant || panel !== "cardapio") return;
    fetch("/api/partners/me/menu", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.items) && data.items.length) {
          setMenuItems(
            data.items.map((i) => ({
              name: i.name || "",
              description: i.description || "",
              price: i.price != null ? String(i.price) : "",
              image: i.image || null,
            }))
          );
        }
      })
      .catch(() => {});
  }, [restaurant, panel]);

  useEffect(() => {
    if (!restaurant || panel !== "feedbacks") return;
    fetch("/api/partners/me/feedback", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setFeedbacks(data))
      .catch(() => {});
  }, [restaurant, panel]);

  useEffect(() => {
    if (!restaurant || panel !== "aovivo") return undefined;
    let cancelled = false;
    const loadLive = () => {
      fetch("/api/partners/me/live", { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && !data.error) setLiveStats(data);
        })
        .catch(() => {});
    };
    loadLive();
    const t = setInterval(loadLive, 20000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [restaurant, panel]);

  useEffect(() => {
    if (!restaurant || panel !== "relatorio") return;
    fetch("/api/partners/me/report/weekly", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setWeeklyReport(data);
      })
      .catch(() => {});
  }, [restaurant, panel]);

  useEffect(() => {
    if (removeDishIndex == null) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setRemoveDishIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [removeDishIndex]);

  useEffect(() => {
    const onResize = () => {
      if (window.matchMedia("(max-width: 860px)").matches) setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!loading && !user) {
    return <Navigate to="/" replace />;
  }

  if (!boot && user && !restaurant) {
    return <Navigate to="/login?mode=register&tipo=restaurante" replace />;
  }

  const goPanel = (id) => {
    setPanel(id);
    setMsg(null);
    setError(null);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 860px)").matches) {
      setMenuOpen(false);
    }
  };

  const saveWait = async (value) => {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/partners/me/wait", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waitMinutes: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao atualizar espera");
      setRestaurant(data.restaurant);
      setWaitMinutes(data.restaurant.waitMinutes);
      syncStatusFields(data.restaurant);
      setMsg("Espera atualizada — aparece agora no app dos clientes.");
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveStatus = async (overrides = {}) => {
    setStatusSaving(true);
    setMsg(null);
    setError(null);
    try {
      const nextOpen = overrides.isOpen != null ? overrides.isOpen : isOpen;
      const payload = {
        isOpen: nextOpen,
        capacityTotal:
          overrides.capacityTotal !== undefined ? overrides.capacityTotal : capacityTotal,
        capacityFree:
          overrides.capacityFree !== undefined ? overrides.capacityFree : capacityFree,
      };
      const res = await fetch("/api/partners/me/status", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao salvar status");
      setRestaurant(data.restaurant);
      syncStatusFields(data.restaurant);
      setMsg(
        nextOpen
          ? "Status atualizado — aberto no Explorar."
          : "Marcado como fechado no Explorar."
      );
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setStatusSaving(false);
    }
  };

  const updateDish = (index, patch) => {
    setMenuItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addDish = () => {
    setMenuItems((prev) => [emptyDish(), ...prev]);
  };

  const confirmRemoveDish = () => {
    if (removeDishIndex == null) return;
    const index = removeDishIndex;
    setRemoveDishIndex(null);
    setMenuItems((prev) => {
      if (prev.length <= 1) return [emptyDish()];
      return prev.filter((_, i) => i !== index);
    });
  };

  const onDishPhoto = async (index, file) => {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await compressImageFile(file);
      const res = await fetch("/api/partners/me/menu/photo", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao enviar foto");
      updateDish(index, { image: data.imageUrl });
      setMsg("Foto adicionada — publique o cardápio para o cliente ver.");
    } catch (err) {
      setError(err.message);
    }
  };

  const saveHours = async (e) => {
    e?.preventDefault?.();
    setExtraSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/partners/me/hours", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao salvar horários");
      setRestaurant(data.restaurant);
      syncStatusFields(data.restaurant);
      setMsg("Horários atualizados.");
    } catch (err) {
      setError(err.message);
    } finally {
      setExtraSaving(false);
    }
  };

  const saveReminder = async (nextValue) => {
    setReminderEnabled(nextValue);
    setExtraSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/partners/me/reminder", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderEnabled: nextValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao salvar lembrete");
      setRestaurant(data.restaurant);
      syncStatusFields(data.restaurant);
      setMsg(nextValue ? "Lembrete de espera ativado." : "Lembrete desativado.");
    } catch (err) {
      setError(err.message);
      setReminderEnabled(!nextValue);
    } finally {
      setExtraSaving(false);
    }
  };

  const saveMenu = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const items = menuItems
        .filter((i) => i.name.trim())
        .map((i) => ({
          name: i.name.trim(),
          description: i.description.trim(),
          price: i.price === "" ? null : Number(i.price),
          image: i.image || null,
        }));
      if (!items.length) {
        throw new Error("Adicione pelo menos um prato com nome.");
      }
      const res = await fetch("/api/partners/me/menu", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao salvar cardápio");
      setMenuItems(
        (data.items || items).map((i) => ({
          name: i.name || "",
          description: i.description || "",
          price: i.price != null ? String(i.price) : "",
          image: i.image || null,
        }))
      );
      setMsg("Cardápio do dia publicado.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const siteUrl = restaurant?.websiteUrl || null;

  const titles = {
    espera: {
      h1: "Espera e lotação",
      lead: "O tempo que você publica aqui aparece na hora no Explorar dos clientes.",
    },
    cardapio: {
      h1: "Cardápio do dia",
      lead: "Monte o que o cliente vê ao tocar em “Ver cardápio” — nome, descrição e preço.",
    },
    aovivo: {
      h1: "Quem vem agora",
      lead: "Clientes que tocaram em “Vou agora” — contagem anônima em tempo quase real.",
    },
    horarios: {
      h1: "Horário de funcionamento",
      lead: "O cliente vê se ainda dá tempo de vir — e o status combina com aberto/fechado.",
    },
    feedbacks: {
      h1: "Feedbacks",
      lead: "Veja o que os clientes comentaram sobre espera, comida e experiência.",
    },
    relatorio: {
      h1: "Relatório semanal",
      lead: "Resumo dos últimos 7 dias: cliques “Vou agora”, notas e movimento.",
    },
  };
  const title = titles[panel] || titles.espera;
  const currentLevel = WAIT_LEVELS.find((l) => l.level === restaurant?.waitLevel) || WAIT_LEVELS[1];
  const waitAgeMs = restaurant?.waitUpdatedAt
    ? Date.now() - new Date(restaurant.waitUpdatedAt).getTime()
    : Infinity;
  const waitFresh = waitAgeMs < 30 * 60_000;
  const needsWaitReminder =
    reminderEnabled &&
    isOpen &&
    (!restaurant?.waitUpdatedAt || waitAgeMs >= 30 * 60_000);
  const allFeedbacks = mergeFeedbacksWithMocks(feedbacks.reviews);
  const realFeedbacks = allFeedbacks.filter((r) => !r.isMock);
  const mockFeedbacks = allFeedbacks.filter((r) => r.isMock);
  const visibleFeedbacks =
    fbFilter === "real" ? realFeedbacks : fbFilter === "mock" ? mockFeedbacks : allFeedbacks;
  const avgDisplay =
    feedbacks.avgRating != null
      ? Number(feedbacks.avgRating).toFixed(1)
      : realFeedbacks.length
        ? (
            realFeedbacks.reduce((sum, r) => sum + Number(r.rating || 0), 0) / realFeedbacks.length
          ).toFixed(1)
        : "—";

  return (
    <>
      <style>{partnerCss}</style>
      <div className={`app-page ${menuOpen ? "is-menu-open" : "is-menu-closed"}`}>
        <aside className="side-rail" aria-label="Menu do restaurante">
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
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <p className="side-rail-role">Painel restaurante</p>

          <nav className="side-rail-nav">
            {MENU_ITEMS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`side-rail-item ${panel === t.id ? "is-active" : ""} ${t.highlight ? "is-ai" : ""}`}
                onClick={() => goPanel(t.id)}
              >
                <span className="side-rail-item-label">{t.label}</span>
                {t.highlight ? <span className="side-rail-badge">AO VIVO</span> : null}
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
            {siteUrl ? (
              <a href={siteUrl} className="side-rail-item" target="_blank" rel="noreferrer">
                Site do lugar
              </a>
            ) : null}
            <Link to="/app" className="side-rail-item">
              App cliente
            </Link>
            <button type="button" className="side-rail-logout" onClick={() => logout()}>
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
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <path d="M4 7h16M4 12h16M4 17h16" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="header-right">
                {restaurant && (
                  <span className="loc-chip partner-chip" title={restaurant.address || ""}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                    <span className="loc-chip-text">
                      {isOpen
                        ? `${restaurant.waitLabel} · ~${restaurant.waitMinutes} min`
                        : "Fechado"}
                    </span>
                  </span>
                )}
                <ThemeToggle
                  theme={theme}
                  onToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                />
                <button
                  type="button"
                  className="user-chip"
                  title={user?.email || ""}
                  onClick={() => goPanel("conta")}
                >
                  <span className="avatar-fallback" aria-hidden="true">
                    {(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="user-name">{user?.name?.split(/\s+/)[0] || "Parceiro"}</span>
                </button>
              </div>
            </div>
          </header>

          <main className="app-main">
            {boot || loading ? (
              <p className="pd-muted">Carregando painel…</p>
            ) : panel === "conta" ? (
              <AccountPanel showRestaurant />
            ) : (
              <section className="partner-page" aria-label="Painel do restaurante">
                <div className="page-intro">
                  <div className="intro-copy">
                    <h1>{title.h1}</h1>
                    <p className="lead">{title.lead}</p>
                  </div>
                </div>

                {msg && <p className="pd-ok">{msg}</p>}
                {error && <p className="pd-error">{error}</p>}

                {needsWaitReminder && panel !== "espera" && (
                  <div className="wait-reminder" role="status">
                    <div>
                      <strong>Lembrete de espera</strong>
                      <p>
                        A espera no Explorar está desatualizada
                        {restaurant?.waitUpdatedAt
                          ? ` (${formatWaitUpdated(restaurant.waitUpdatedAt).toLowerCase()})`
                          : ""}
                        . Atualize na aba Espera.
                      </p>
                    </div>
                    <button type="button" className="btn-search" onClick={() => goPanel("espera")}>
                      Ir para Espera
                    </button>
                  </div>
                )}

                {panel === "espera" && (
                  <div className="wait-board" aria-label="Espera e lotação">
                    {needsWaitReminder && (
                      <div className="wait-reminder" role="status">
                        <div>
                          <strong>Lembrete</strong>
                          <p>
                            A espera no Explorar está desatualizada
                            {restaurant?.waitUpdatedAt
                              ? ` (${formatWaitUpdated(restaurant.waitUpdatedAt).toLowerCase()})`
                              : ""}.
                            Atualize abaixo para os clientes confiarem no tempo.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn-search"
                          disabled={saving}
                          onClick={() => saveWait(Number(waitMinutes) || restaurant?.waitMinutes || 10)}
                        >
                          Atualizar agora
                        </button>
                      </div>
                    )}

                    {!isOpen && (
                      <div className="wait-reminder is-closed" role="status">
                        <div>
                          <strong>Fechado no Explorar</strong>
                          <p>Clientes veem o status “Fechado”. Abra de novo quando a casa receber pedidos.</p>
                        </div>
                        <button
                          type="button"
                          className="btn-search"
                          disabled={statusSaving}
                          onClick={() => {
                            setIsOpen(true);
                            saveStatus({ isOpen: true });
                          }}
                        >
                          Abrir agora
                        </button>
                      </div>
                    )}

                    <section className={`wait-hero tone-${isOpen ? currentLevel.tone : "closed"}`}>
                      <div className="wait-hero-copy">
                        <span className="wait-kicker">Agora no Explorar</span>
                        <div className="wait-hero-row">
                          {isOpen ? (
                            <strong className="wait-minutes">
                              ~{restaurant?.waitMinutes ?? "—"}
                              <em>min</em>
                            </strong>
                          ) : (
                            <strong className="wait-minutes is-closed-text">Fechado</strong>
                          )}
                          <span className={`wait-badge tone-${isOpen ? currentLevel.tone : "closed"}`}>
                            {isOpen ? restaurant?.waitLabel || currentLevel.label : "Fechado"}
                          </span>
                        </div>
                        <p className="wait-updated">
                          Última atualização da espera:{" "}
                          <strong>{formatWaitUpdated(restaurant?.waitUpdatedAt)}</strong>
                          {isOpen ? (
                            waitFresh ? (
                              <em className="wait-fresh">Atualizado</em>
                            ) : (
                              <em className="wait-stale">Vale atualizar</em>
                            )
                          ) : null}
                        </p>
                        {capacityFree !== "" || restaurant?.capacityFree != null ? (
                          <p className="wait-capacity-live">
                            Capacidade:{" "}
                            <strong>
                              {capacityFree !== "" ? capacityFree : restaurant?.capacityFree}
                              {capacityTotal !== "" || restaurant?.capacityTotal != null
                                ? ` de ${capacityTotal !== "" ? capacityTotal : restaurant?.capacityTotal}`
                                : ""}{" "}
                              livres
                            </strong>
                          </p>
                        ) : null}
                      </div>
                      <p className="wait-hero-hint">
                        {isOpen ? currentLevel.hint : "Enquanto estiver fechado, a espera não é exibida aos clientes."}
                      </p>
                    </section>

                    <section className="pd-card wait-card">
                      <div className="account-card-head">
                        <h3>Aberto ou fechado</h3>
                        <p>Controle se o restaurante aparece disponível no Explorar.</p>
                      </div>
                      <div className="wait-open-toggle" role="group" aria-label="Status de funcionamento">
                        <button
                          type="button"
                          className={`wait-open-btn ${isOpen ? "is-active good" : ""}`}
                          disabled={statusSaving}
                          onClick={() => {
                            setIsOpen(true);
                            saveStatus({ isOpen: true });
                          }}
                        >
                          <strong>Aberto</strong>
                          <span>Recebendo clientes</span>
                        </button>
                        <button
                          type="button"
                          className={`wait-open-btn ${!isOpen ? "is-active closed" : ""}`}
                          disabled={statusSaving}
                          onClick={() => {
                            setIsOpen(false);
                            saveStatus({ isOpen: false });
                          }}
                        >
                          <strong>Fechado</strong>
                          <span>Fora do expediente</span>
                        </button>
                      </div>
                    </section>

                    <section className="pd-card wait-card">
                      <div className="account-card-head">
                        <h3>Mesas / capacidade</h3>
                        <p>Mostre quantos lugares ainda estão livres — opcional, mas ajuda o cliente a decidir.</p>
                      </div>
                      <div className="wait-capacity-fields">
                        <label className="pd-field">
                          Lugares livres
                          <input
                            type="number"
                            min={0}
                            max={999}
                            value={capacityFree}
                            onChange={(e) => setCapacityFree(e.target.value)}
                            placeholder="ex: 12"
                          />
                        </label>
                        <label className="pd-field">
                          Capacidade total
                          <input
                            type="number"
                            min={0}
                            max={999}
                            value={capacityTotal}
                            onChange={(e) => setCapacityTotal(e.target.value)}
                            placeholder="ex: 40"
                          />
                        </label>
                      </div>
                      <div className="pd-actions-row">
                        <button
                          type="button"
                          className="btn-search"
                          disabled={statusSaving}
                          onClick={() => saveStatus()}
                        >
                          {statusSaving ? "Salvando…" : "Salvar capacidade"}
                        </button>
                        <button
                          type="button"
                          className="btn-nav-light"
                          disabled={statusSaving}
                          onClick={() => {
                            setCapacityFree("");
                            setCapacityTotal("");
                            saveStatus({ capacityFree: "", capacityTotal: "" });
                          }}
                        >
                          Limpar
                        </button>
                      </div>
                    </section>

                    <section className="pd-card wait-card">
                      <div className="account-card-head">
                        <h3>Nível de espera</h3>
                        <p>Um toque publica na hora — escolha o que combina com a casa agora.</p>
                      </div>
                      <div className="pd-levels">
                        {WAIT_LEVELS.map((o) => (
                          <button
                            key={o.level}
                            type="button"
                            className={`pd-level tone-${o.tone} ${
                              restaurant?.waitLevel === o.level ? "is-active" : ""
                            }`}
                            disabled={saving}
                            onClick={() => saveWait(o.mins)}
                          >
                            <span className="pd-level-top">
                              <strong>{o.label}</strong>
                              <span className="pd-level-mins">~{o.mins} min</span>
                            </span>
                            <span className="pd-level-hint">{o.hint}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="pd-card wait-card">
                      <div className="account-card-head">
                        <h3>Minutos exatos</h3>
                        <p>Use atalhos ou digite o tempo real da fila.</p>
                      </div>
                      <div className="wait-quick" role="group" aria-label="Atalhos de minutos">
                        {WAIT_QUICK.map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={`wait-chip ${Number(waitMinutes) === m ? "is-active" : ""}`}
                            disabled={saving}
                            onClick={() => {
                              setWaitMinutes(m);
                              saveWait(m);
                            }}
                          >
                            {m === 0 ? "Sem fila" : `${m} min`}
                          </button>
                        ))}
                      </div>
                      <label className="pd-field">
                        Personalizado
                        <div className="pd-inline wait-custom">
                          <button
                            type="button"
                            className="wait-step"
                            disabled={saving}
                            aria-label="Diminuir 1 minuto"
                            onClick={() =>
                              setWaitMinutes((v) => Math.max(0, Number(v || 0) - 1))
                            }
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={90}
                            value={waitMinutes}
                            onChange={(e) => setWaitMinutes(e.target.value)}
                            aria-label="Minutos de espera"
                          />
                          <button
                            type="button"
                            className="wait-step"
                            disabled={saving}
                            aria-label="Aumentar 1 minuto"
                            onClick={() =>
                              setWaitMinutes((v) => Math.min(90, Number(v || 0) + 1))
                            }
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="btn-search"
                            disabled={saving}
                            onClick={() => saveWait(Number(waitMinutes))}
                          >
                            {saving ? "Salvando…" : "Publicar"}
                          </button>
                        </div>
                      </label>
                      <p className="wait-tip">
                        Dica: atualize no início do almoço e sempre que a fila mudar — clientes
                        confiam mais em tempos frescos.
                      </p>
                    </section>

                    <section className="pd-card wait-card">
                      <div className="account-card-head">
                        <h3>Lembrete na tela</h3>
                        <p>
                          Quando a espera passar de ~30 min sem atualizar, mostramos um aviso neste
                          painel (em todas as abas).
                        </p>
                      </div>
                      <label className="pd-check reminder-check">
                        <input
                          type="checkbox"
                          checked={reminderEnabled}
                          disabled={extraSaving}
                          onChange={(e) => saveReminder(e.target.checked)}
                        />
                        Ativar lembrete de espera desatualizada
                      </label>
                    </section>
                  </div>
                )}

                {panel === "aovivo" && (
                  <div className="live-board" aria-label="Quem vem agora">
                    <section className="live-hero">
                      <div className="live-hero-copy">
                        <span className="wait-kicker">Últimos 15 minutos</span>
                        <div className="live-hero-row">
                          <strong className="live-count">
                            {liveStats.last15Min}
                            <em>a caminho</em>
                          </strong>
                          <span className="live-pulse">Ao vivo</span>
                        </div>
                        <p className="live-hint">
                          Contagem anônima de clientes que tocaram em “Vou agora” no app. Atualiza
                          sozinho a cada 20s.
                        </p>
                      </div>
                      <div className="fb-stat-grid">
                        <div className="fb-stat">
                          <strong>{liveStats.last60Min}</strong>
                          <span>Última 1 h</span>
                        </div>
                        <div className="fb-stat">
                          <strong>{liveStats.today}</strong>
                          <span>Hoje</span>
                        </div>
                        <div className="fb-stat">
                          <strong>{liveStats.recent?.length || 0}</strong>
                          <span>Na lista recente</span>
                        </div>
                      </div>
                    </section>
                    <section className="pd-card">
                      <div className="account-card-head">
                        <h3>Chegadas recentes</h3>
                        <p>Sem nome do cliente — só o horário do clique.</p>
                      </div>
                      {(liveStats.recent || []).length === 0 ? (
                        <div className="fb-empty">
                          <strong>Ninguém a caminho agora</strong>
                          <p>Quando alguém usar “Vou agora” no seu restaurante, aparece aqui.</p>
                        </div>
                      ) : (
                        <ul className="live-list">
                          {(liveStats.recent || []).map((item) => (
                            <li key={item.id}>
                              <strong>{item.label}</strong>
                              <span>{formatReviewWhen(item.createdAt) || "Agora"}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                )}

                {panel === "cardapio" && (
                  <form className="menu-board" onSubmit={saveMenu} aria-label="Cardápio do dia">
                    <section className="menu-hero">
                      <div className="menu-hero-copy">
                        <span className="wait-kicker">Visível para o cliente</span>
                        <div className="menu-hero-row">
                          <strong className="menu-count">
                            {menuItems.filter((i) => i.name.trim()).length}
                            <em>pratos</em>
                          </strong>
                          <span className="menu-hero-badge">Cardápio do dia</span>
                        </div>
                        <p className="menu-hero-hint">
                          Itens sem nome são ignorados na publicação. Dá para incluir foto de cada
                          prato — ela aparece no “Ver cardápio” do cliente.
                        </p>
                      </div>
                      <div className="menu-hero-actions">
                        <button type="button" className="btn-nav-light" onClick={addDish}>
                          + Novo prato
                        </button>
                        <button type="submit" className="btn-search" disabled={saving}>
                          {saving ? "Publicando…" : "Publicar cardápio"}
                        </button>
                      </div>
                    </section>

                    <section className="pd-card menu-list-card">
                      <div className="account-card-head menu-list-head">
                        <div>
                          <h3>Pratos</h3>
                          <p>Organize o que está saindo hoje na cozinha.</p>
                        </div>
                        <span className="menu-list-meta">
                          {menuItems.length} {menuItems.length === 1 ? "linha" : "linhas"}
                        </span>
                      </div>

                      <div className="menu-dish-list">
                        {menuItems.map((item, index) => (
                          <article
                            key={index}
                            className={`menu-dish ${item.name.trim() ? "has-name" : ""}`}
                          >
                            <div className="menu-dish-head">
                              <span className="menu-dish-num" aria-hidden="true">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <strong className="menu-dish-title">
                                {item.name.trim() || `Prato ${index + 1}`}
                              </strong>
                              <button
                                type="button"
                                className="menu-dish-remove"
                                aria-label={`Remover prato ${index + 1}`}
                                onClick={() => setRemoveDishIndex(index)}
                              >
                                Remover
                              </button>
                            </div>
                            <div className="menu-dish-body">
                              <div className="menu-photo">
                                {item.image ? (
                                  <img src={item.image} alt="" />
                                ) : (
                                  <span className="menu-photo-empty" aria-hidden="true">
                                    Foto
                                  </span>
                                )}
                                <div className="menu-photo-actions">
                                  <label className="menu-photo-btn">
                                    {item.image ? "Trocar foto" : "Enviar foto"}
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp,image/*"
                                      hidden
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = "";
                                        onDishPhoto(index, file);
                                      }}
                                    />
                                  </label>
                                  {item.image ? (
                                    <button
                                      type="button"
                                      className="menu-photo-clear"
                                      onClick={() => updateDish(index, { image: null })}
                                    >
                                      Tirar foto
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              <div className="menu-dish-fields">
                                <label className="pd-field menu-field-name">
                                  Nome do prato
                                  <input
                                    placeholder="Ex: PF do dia, Feijoada, Bowl fit…"
                                    value={item.name}
                                    onChange={(e) => updateDish(index, { name: e.target.value })}
                                    required={index === 0}
                                  />
                                </label>
                                <label className="pd-field menu-field-price">
                                  Preço (R$)
                                  <input
                                    placeholder="0,00"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.price}
                                    onChange={(e) => updateDish(index, { price: e.target.value })}
                                  />
                                </label>
                                <label className="pd-field menu-field-desc">
                                  Descrição
                                  <input
                                    placeholder="Ingredientes, porção, observação…"
                                    value={item.description}
                                    onChange={(e) =>
                                      updateDish(index, { description: e.target.value })
                                    }
                                  />
                                </label>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>

                    </section>

                    {removeDishIndex != null && (
                      <div
                        className="pd-modal-scrim"
                        role="presentation"
                        onClick={() => setRemoveDishIndex(null)}
                      >
                        <div
                          className="pd-modal"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="remove-dish-title"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <h3 id="remove-dish-title">Remover prato?</h3>
                          <p>
                            Tem certeza que deseja remover{" "}
                            <strong>
                              {menuItems[removeDishIndex]?.name?.trim() ||
                                `Prato ${removeDishIndex + 1}`}
                            </strong>
                            ? Essa ação só vale depois que você publicar o cardápio.
                          </p>
                          <div className="pd-modal-actions">
                            <button
                              type="button"
                              className="btn-nav-light"
                              onClick={() => setRemoveDishIndex(null)}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className="btn-danger-solid"
                              onClick={confirmRemoveDish}
                            >
                              Sim, remover
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </form>
                )}

                {panel === "feedbacks" && (
                  <div className="fb-board" aria-label="Feedbacks">
                    <section className="fb-hero">
                      <div className="fb-hero-copy">
                        <span className="wait-kicker">Resumo das avaliações</span>
                        <div className="fb-hero-row">
                          <strong className="fb-score">
                            {avgDisplay}
                            <em>média</em>
                          </strong>
                          <div className="fb-hero-meta">
                            <span className="fb-stars" aria-hidden="true">
                              {avgDisplay === "—" ? "☆☆☆☆☆" : starLabel(avgDisplay)}
                            </span>
                            <span className="fb-hero-count">
                              {feedbacks.reviewCount || realFeedbacks.length}{" "}
                              {(feedbacks.reviewCount || realFeedbacks.length) === 1
                                ? "avaliação real"
                                : "avaliações reais"}
                            </span>
                          </div>
                        </div>
                        <p className="fb-hero-hint">
                          {realFeedbacks.length
                            ? "Feedbacks reais ficam no topo. Exemplos ajudam a visualizar o layout enquanto a casa recebe mais comentários."
                            : "Ainda não há feedbacks reais — os exemplos abaixo mostram como as avaliações vão aparecer."}
                        </p>
                      </div>
                      <div className="fb-stat-grid" aria-label="Contadores">
                        <div className="fb-stat">
                          <strong>{realFeedbacks.length}</strong>
                          <span>Reais</span>
                        </div>
                        <div className="fb-stat">
                          <strong>{mockFeedbacks.length}</strong>
                          <span>Exemplos</span>
                        </div>
                        <div className="fb-stat">
                          <strong>{allFeedbacks.length}</strong>
                          <span>Total na lista</span>
                        </div>
                      </div>
                    </section>

                    <section className="pd-card fb-list-card">
                      <div className="account-card-head menu-list-head">
                        <div>
                          <h3>Comentários</h3>
                          <p>Filtre por origem para focar no que importa.</p>
                        </div>
                        <div className="fb-filters" role="tablist" aria-label="Filtrar feedbacks">
                          {[
                            { id: "all", label: "Todos" },
                            { id: "real", label: "Reais" },
                            { id: "mock", label: "Exemplos" },
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              role="tab"
                              aria-selected={fbFilter === f.id}
                              className={`fb-filter ${fbFilter === f.id ? "is-active" : ""}`}
                              onClick={() => setFbFilter(f.id)}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {visibleFeedbacks.length === 0 ? (
                        <div className="fb-empty">
                          <strong>Nada por aqui</strong>
                          <p>
                            {fbFilter === "real"
                              ? "Quando um cliente enviar feedback no app, ele aparece nesta lista."
                              : "Não há itens neste filtro."}
                          </p>
                        </div>
                      ) : (
                        <ul className="fb-reviews">
                          {visibleFeedbacks.map((r) => {
                            const name = (r.userName || "Cliente").split(/\s+/)[0];
                            const when = formatReviewWhen(r.updatedAt || r.createdAt);
                            return (
                              <li key={r.id} className={`fb-review ${r.isMock ? "is-mock" : ""}`}>
                                <div className="fb-review-top">
                                  <span className="fb-avatar" aria-hidden="true">
                                    {String(name).slice(0, 1).toUpperCase()}
                                  </span>
                                  <div className="fb-review-who">
                                    <strong>{name}</strong>
                                    <span className="fb-stars-inline" aria-label={`${r.rating} de 5`}>
                                      {starLabel(r.rating)}
                                    </span>
                                  </div>
                                  {r.isMock ? (
                                    <em className="fb-tag">Exemplo</em>
                                  ) : (
                                    <em className="fb-tag real">Real</em>
                                  )}
                                </div>
                                <div className="fb-review-meta">
                                  {r.waitMinutes != null ? (
                                    <span>Espera relatada ~{r.waitMinutes} min</span>
                                  ) : (
                                    <span>Sem tempo de espera informado</span>
                                  )}
                                  {when ? <span>{when}</span> : null}
                                </div>
                                {r.comment ? <p className="fb-review-comment">{r.comment}</p> : (
                                  <p className="fb-review-comment is-empty">Sem comentário escrito.</p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  </div>
                )}

{panel === "horarios" && (
                  <form className="hours-board" onSubmit={saveHours} aria-label="Horários">
                    <section className="pd-card">
                      <div className="account-card-head">
                        <h3>Semana</h3>
                        <p>
                          Fora do horário o lugar pode aparecer como fechado mesmo com o botão
                          “Aberto” ligado.
                        </p>
                      </div>
                      <div className="hours-list">
                        {DAY_ORDER.map((key) => {
                          const day = hours[key] || DEFAULT_HOURS[key];
                          return (
                            <div key={key} className={`hours-row ${day.closed ? "is-closed" : ""}`}>
                              <strong>{DAY_LABELS[key]}</strong>
                              <label className="pd-check hours-closed">
                                <input
                                  type="checkbox"
                                  checked={Boolean(day.closed)}
                                  onChange={(e) =>
                                    setHours((prev) => ({
                                      ...prev,
                                      [key]: { ...prev[key], closed: e.target.checked },
                                    }))
                                  }
                                />
                                Fechado
                              </label>
                              <input
                                type="time"
                                value={day.open || "11:00"}
                                disabled={day.closed}
                                onChange={(e) =>
                                  setHours((prev) => ({
                                    ...prev,
                                    [key]: { ...prev[key], open: e.target.value },
                                  }))
                                }
                                aria-label={`${DAY_LABELS[key]} abertura`}
                              />
                              <span className="hours-sep">às</span>
                              <input
                                type="time"
                                value={day.close || "15:00"}
                                disabled={day.closed}
                                onChange={(e) =>
                                  setHours((prev) => ({
                                    ...prev,
                                    [key]: { ...prev[key], close: e.target.value },
                                  }))
                                }
                                aria-label={`${DAY_LABELS[key]} fechamento`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <button type="submit" className="btn-search" disabled={extraSaving}>
                        {extraSaving ? "Salvando…" : "Salvar horários"}
                      </button>
                    </section>
                  </form>
                )}

                {panel === "relatorio" && (
                  <div className="report-board" aria-label="Relatório semanal">
                    <section className="report-hero">
                      <div>
                        <span className="wait-kicker">{weeklyReport?.periodLabel || "Últimos 7 dias"}</span>
                        <h3 className="report-title">Visão da semana</h3>
                        <p className="live-hint">
                          Compare com a semana anterior e veja se a casa está convertendo cliques
                          em movimento.
                        </p>
                      </div>
                    </section>
                    {!weeklyReport ? (
                      <p className="pd-muted">Carregando relatório…</p>
                    ) : (
                      <>
                        <div className="fb-stat-grid report-stats">
                          <div className="fb-stat">
                            <strong>{weeklyReport.goNowCount}</strong>
                            <span>Vou agora</span>
                            <em className="report-delta">
                              {weeklyReport.goNowDelta >= 0 ? "+" : ""}
                              {weeklyReport.goNowDelta} vs sem. ant.
                            </em>
                          </div>
                          <div className="fb-stat">
                            <strong>{weeklyReport.feedbackCount}</strong>
                            <span>Feedbacks</span>
                            <em className="report-delta">
                              {weeklyReport.feedbackDelta >= 0 ? "+" : ""}
                              {weeklyReport.feedbackDelta} vs sem. ant.
                            </em>
                          </div>
                          <div className="fb-stat">
                            <strong>
                              {weeklyReport.avgRating != null
                                ? Number(weeklyReport.avgRating).toFixed(1)
                                : "—"}
                            </strong>
                            <span>Nota média</span>
                          </div>
                          <div className="fb-stat">
                            <strong>
                              {weeklyReport.avgWaitReported != null
                                ? `~${weeklyReport.avgWaitReported}`
                                : "—"}
                            </strong>
                            <span>Espera relatada (min)</span>
                          </div>
                        </div>

                        <div className="report-charts">
                          <section className="pd-card report-chart-card">
                            <div className="account-card-head">
                              <h3>Vou agora por dia</h3>
                              <p>Cliques dos últimos 7 dias.</p>
                            </div>
                            <ReportBars
                              series={weeklyReport.charts?.goNowByDay || []}
                              ariaLabel="Gráfico de Vou agora por dia"
                            />
                          </section>
                          <section className="pd-card report-chart-card">
                            <div className="account-card-head">
                              <h3>Feedbacks por dia</h3>
                              <p>Avaliações recebidas na semana.</p>
                            </div>
                            <ReportBars
                              series={weeklyReport.charts?.feedbackByDay || []}
                              ariaLabel="Gráfico de feedbacks por dia"
                            />
                          </section>
                          <section className="pd-card report-chart-card report-chart-wide">
                            <div className="account-card-head">
                              <h3>Fluxo de hoje (11h–14h)</h3>
                              <p>“Vou agora” no horário de almoço — no estilo do painel da landing.</p>
                            </div>
                            <ReportBars
                              series={weeklyReport.charts?.goNowByHour || []}
                              ariaLabel="Gráfico de fluxo por horário"
                            />
                          </section>
                        </div>

                        <section className="pd-card">
                          <div className="account-card-head">
                            <h3>Snapshot atual</h3>
                            <p>Como o restaurante aparece agora no app.</p>
                          </div>
                          <ul className="report-snapshot">
                            <li>
                              <span>Status</span>
                              <strong>{weeklyReport.isOpen ? "Aberto" : "Fechado"}</strong>
                            </li>
                            <li>
                              <span>Espera publicada</span>
                              <strong>~{weeklyReport.currentWaitMinutes} min</strong>
                            </li>
                            <li>
                              <span>Última atualização</span>
                              <strong>{formatWaitUpdated(weeklyReport.waitUpdatedAt)}</strong>
                            </li>
                            <li>
                              <span>Horário de hoje</span>
                              <strong>{weeklyReport.hoursLabel || "Não definido"}</strong>
                            </li>
                            <li>
                              <span>Capacidade</span>
                              <strong>{weeklyReport.capacityLabel || "—"}</strong>
                            </li>
                          </ul>
                        </section>
                      </>
                    )}
                  </div>
                )}
              </section>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

const partnerCss = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');

:root{
  --ink:#1F2328; --ink-2:#4B5563; --muted:#6B7280;
  --bg:#FFF9F2; --surface:#fff; --cream:#FFF7EE; --line:#F0E6DA;
  --orange:#FF6B1A; --orange-dark:#E5560A; --yellow:#FFB400;
  --pad-x: clamp(16px, 4vw, 40px);
  --gap: clamp(14px, 2.5vw, 22px);
  --rail-w: 232px;
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
  position:fixed;top:0;left:0;bottom:0;z-index:50;width:var(--rail-w);
  display:flex;flex-direction:column;gap:8px;padding:12px 10px;
  background:var(--surface);border-right:1px solid var(--line);
  box-shadow:8px 0 28px -24px rgba(31,35,40,.45);
  transform:translateX(0);transition:transform .22s ease, box-shadow .22s ease;
}
.app-page.is-menu-closed .side-rail{transform:translateX(-100%);box-shadow:none;pointer-events:none}
.side-rail-head{
  display:flex;align-items:center;justify-content:space-between;gap:8px;
  margin-bottom:6px;padding:2px 2px 10px;border-bottom:1px solid var(--line);
}
.side-brand{display:inline-flex;align-items:center;gap:8px;text-decoration:none;color:inherit;min-width:0}
.brand-mark{
  display:grid;place-items:center;width:30px;height:30px;border-radius:9px;
  background:linear-gradient(135deg,var(--orange),var(--yellow));flex:none;
}
.brand-text{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:1.05rem;letter-spacing:-.03em}
.brand-text b{color:var(--orange)}
.menu-close,.menu-open-btn{
  display:grid;place-items:center;width:36px;height:36px;flex:none;
  border:1px solid var(--line);border-radius:10px;background:var(--surface);
  color:var(--ink-2);cursor:pointer;padding:0;
}
.menu-close:hover,.menu-open-btn:hover{border-color:var(--orange);color:var(--orange-dark);background:var(--cream)}
.side-rail-role{
  margin:0 4px 4px;font-size:.68rem;font-weight:800;letter-spacing:.06em;
  text-transform:uppercase;color:var(--orange);
}
.side-rail-nav{display:flex;flex-direction:column;gap:4px;overflow:auto;flex:1;min-height:0}
.side-rail-item{
  border:0;background:transparent;color:var(--ink-2);border-radius:12px;
  padding:12px 14px;font:inherit;font-size:.95rem;font-weight:600;cursor:pointer;text-align:left;width:100%;
  display:flex;align-items:center;justify-content:space-between;gap:8px;text-decoration:none;
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
  flex:none;font-size:.62rem;font-weight:800;letter-spacing:.04em;
  padding:3px 7px;border-radius:999px;background:var(--orange);color:#fff;
}
.side-rail-foot{margin-top:auto;padding-top:10px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:4px}
.side-rail-logout{
  border:0;background:transparent;color:#B91C1C;border-radius:12px;
  padding:12px 14px;font:inherit;font-size:.95rem;font-weight:700;cursor:pointer;text-align:left;width:100%;
}
.side-rail-logout:hover{background:#FEE2E2;color:#991B1B}
html[data-theme="dark"] .side-rail-logout{color:#FCA5A5}
html[data-theme="dark"] .side-rail-logout:hover{background:#7F1D1D;color:#FECACA}
.menu-scrim{display:none}

.app-shell{min-height:100vh;margin-left:var(--rail-w);transition:margin-left .22s ease;display:flex;flex-direction:column}
.app-page.is-menu-closed .app-shell{margin-left:0}
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
.header-right{display:flex;align-items:center;gap:8px;flex:none;margin-left:auto;justify-content:flex-end;min-width:0}
.partner-chip{
  display:inline-flex;align-items:center;gap:6px;width:max-content;
  padding:7px 12px;border-radius:999px;border:1px solid var(--line);
  background:var(--surface);color:var(--ink-2);font-size:.82rem;font-weight:600;
}
.partner-chip svg{flex:none;color:var(--orange)}
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
.avatar-fallback{
  width:28px;height:28px;border-radius:50%;display:grid;place-items:center;flex:none;
  background:linear-gradient(135deg,var(--orange),var(--yellow));color:#fff;font-weight:700;font-size:.75rem;
}
.user-name{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:var(--ink-2)}

.app-main{padding:clamp(20px,3vw,32px) var(--pad-x) clamp(40px,6vw,64px);width:100%}
.partner-page{width:100%;max-width:none;display:grid;gap:var(--gap)}
.page-intro{
  display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:12px 24px;
  margin-bottom:0;
}
.intro-copy h1{
  font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(1.7rem,3.5vw,2.35rem);
  margin:0 0 8px;letter-spacing:-.02em;line-height:1.12;
}
.lead{margin:0;color:var(--ink-2);line-height:1.55;font-size:.98rem}
.account-profile-row{display:flex;align-items:center;gap:14px}
.account-profile-row strong{display:block;font-size:1.05rem}
.account-profile-row span{display:block;font-size:.9rem;color:var(--muted)}
.account-avatar.fallback{
  width:56px;height:56px;border-radius:50%;display:grid;place-items:center;flex:none;
  background:linear-gradient(135deg,var(--orange),var(--yellow));color:#fff;font-weight:800;font-size:1.3rem;
}
.pd-card a{color:var(--orange-dark);font-weight:700}

.pd-card{
  display:grid;gap:14px;padding:clamp(22px,3vw,28px) clamp(22px,3vw,32px);
  background:var(--surface);border:1px solid var(--line);border-radius:18px;width:100%;
}
.account-card-head{display:grid;gap:4px}
.account-card-head h3{margin:0;font-size:1.1rem;font-family:'Bricolage Grotesque',sans-serif}
.account-card-head p{margin:0;font-size:.9rem;color:var(--muted);line-height:1.4}
.account-fields{display:grid;gap:14px}
.account-field-full{grid-column:1/-1}
.wait-board{display:grid;gap:var(--gap);width:100%}
.wait-reminder{
  display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px 18px;
  padding:16px 18px;border-radius:16px;border:1.5px solid rgba(245,158,11,.35);
  background:rgba(245,158,11,.1);
}
.wait-reminder strong{display:block;font-size:.95rem;margin-bottom:4px;color:#B45309}
.wait-reminder p{margin:0;font-size:.88rem;color:var(--ink-2);line-height:1.45;max-width:36rem}
.wait-reminder.is-closed{
  border-color:rgba(148,163,184,.45);background:rgba(148,163,184,.12);
}
.wait-reminder.is-closed strong{color:var(--ink-2)}
html[data-theme="dark"] .wait-reminder{background:rgba(120,53,15,.35);border-color:#B45309}
html[data-theme="dark"] .wait-reminder strong{color:#FCD34D}
html[data-theme="dark"] .wait-reminder.is-closed{background:rgba(42,49,58,.9);border-color:#475569}
html[data-theme="dark"] .wait-reminder.is-closed strong{color:#CBD5E1}
.wait-open-toggle{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.wait-open-btn{
  display:grid;gap:4px;padding:16px;border-radius:14px;border:1.5px solid var(--line);
  background:var(--bg);cursor:pointer;font:inherit;text-align:left;color:inherit;
}
.wait-open-btn span{font-size:.82rem;color:var(--muted)}
.wait-open-btn:hover{border-color:#FFD0AE}
.wait-open-btn.is-active.good{border-color:#16A34A;background:rgba(22,163,74,.1)}
.wait-open-btn.is-active.closed{border-color:#94A3B8;background:rgba(148,163,184,.14)}
.wait-capacity-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.wait-capacity-live{margin:0;font-size:.9rem;color:var(--muted)}
.wait-capacity-live strong{color:var(--ink-2)}
.wait-minutes.is-closed-text{font-size:clamp(2.2rem,6vw,3.2rem)}
.wait-hero.tone-closed::before{background:rgba(148,163,184,.2)}
.wait-badge.tone-closed{background:rgba(148,163,184,.16);color:var(--ink-2);border-color:rgba(148,163,184,.35)}
.wait-hero{
  display:grid;gap:14px;padding:clamp(22px,3vw,28px) clamp(22px,3vw,32px);
  border-radius:20px;border:1px solid var(--line);background:var(--surface);
  position:relative;overflow:hidden;
}
.wait-hero::before{
  content:"";position:absolute;inset:auto -10% -40% auto;width:220px;height:220px;border-radius:50%;
  pointer-events:none;opacity:.55;
}
.wait-hero.tone-good::before{background:rgba(22,163,74,.16)}
.wait-hero.tone-warn::before{background:rgba(245,158,11,.18)}
.wait-hero.tone-hot::before{background:rgba(255,107,26,.18)}
.wait-hero-copy{display:grid;gap:10px;position:relative;z-index:1}
.wait-kicker{
  font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);
}
.wait-hero-row{display:flex;flex-wrap:wrap;align-items:end;gap:12px 16px}
.wait-minutes{
  font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(3rem,8vw,4.4rem);
  line-height:.9;letter-spacing:-.04em;font-weight:800;
}
.wait-minutes em{font-style:normal;font-size:.38em;margin-left:6px;color:var(--muted);font-weight:700}
.wait-badge{
  display:inline-flex;align-items:center;padding:7px 12px;border-radius:999px;
  font-size:.82rem;font-weight:800;border:1px solid transparent;
}
.wait-badge.tone-good{background:rgba(22,163,74,.12);color:#166534;border-color:rgba(22,163,74,.2)}
.wait-badge.tone-warn{background:rgba(245,158,11,.14);color:#B45309;border-color:rgba(245,158,11,.25)}
.wait-badge.tone-hot{background:rgba(255,107,26,.14);color:var(--orange-dark);border-color:rgba(255,107,26,.28)}
html[data-theme="dark"] .wait-badge.tone-good{background:#14532D;color:#86EFAC;border-color:#166534}
html[data-theme="dark"] .wait-badge.tone-warn{background:#78350F;color:#FCD34D;border-color:#B45309}
.wait-updated{margin:0;font-size:.9rem;color:var(--muted);display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.wait-updated strong{color:var(--ink-2);font-weight:700}
.wait-fresh,.wait-stale{
  font-style:normal;font-size:.72rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
  padding:4px 8px;border-radius:999px;
}
.wait-fresh{background:rgba(22,163,74,.12);color:#166534}
.wait-stale{background:rgba(245,158,11,.14);color:#B45309}
html[data-theme="dark"] .wait-fresh{background:#14532D;color:#86EFAC}
html[data-theme="dark"] .wait-stale{background:#78350F;color:#FCD34D}
.wait-hero-hint{margin:0;position:relative;z-index:1;font-size:.92rem;color:var(--ink-2);line-height:1.45;max-width:42rem}
.wait-card{gap:16px}
.pd-levels{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.pd-level{
  display:grid;gap:10px;padding:18px 16px;border-radius:16px;border:1.5px solid var(--line);
  background:var(--bg);cursor:pointer;font:inherit;text-align:left;color:inherit;
  transition:border-color .15s ease, background .15s ease, transform .15s ease;
}
.pd-level:hover{transform:translateY(-1px)}
.pd-level.tone-good:hover{border-color:#86EFAC}
.pd-level.tone-warn:hover{border-color:#FCD34D}
.pd-level.tone-hot:hover{border-color:#FFD0AE}
.pd-level.is-active.tone-good{border-color:#16A34A;background:rgba(22,163,74,.1)}
.pd-level.is-active.tone-warn{border-color:#F59E0B;background:rgba(245,158,11,.12)}
.pd-level.is-active.tone-hot{border-color:var(--orange);background:rgba(255,107,26,.1)}
.pd-level-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.pd-level-top strong{font-size:1.05rem;font-family:'Bricolage Grotesque',sans-serif}
.pd-level-mins{font-size:.88rem;font-weight:700;color:var(--ink-2)}
.pd-level-hint{font-size:.82rem;color:var(--muted);line-height:1.4}
.wait-quick{display:flex;flex-wrap:wrap;gap:8px}
.wait-chip{
  border:1.5px solid var(--line);background:var(--bg);color:var(--ink-2);
  border-radius:999px;min-height:38px;padding:0 14px;font:inherit;font-size:.88rem;font-weight:700;cursor:pointer;
}
.wait-chip:hover{border-color:var(--orange);color:var(--orange-dark)}
.wait-chip.is-active{border-color:var(--orange);background:rgba(255,107,26,.12);color:var(--orange-dark)}
.wait-custom{align-items:center}
.wait-step{
  width:42px;height:42px;flex:none;border:1.5px solid var(--line);border-radius:12px;
  background:var(--bg);color:var(--ink);font:inherit;font-size:1.25rem;font-weight:700;cursor:pointer;padding:0;
}
.wait-step:hover{border-color:var(--orange);color:var(--orange-dark)}
.wait-custom input{text-align:center;max-width:96px;font-variant-numeric:tabular-nums}
.wait-tip{
  margin:0;padding:12px 14px;border-radius:12px;background:var(--cream);
  font-size:.85rem;color:var(--muted);line-height:1.45;
}
.pd-field{display:grid;gap:6px;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.pd-field input,.menu-dish input{
  padding:12px 14px;border-radius:12px;border:1.5px solid var(--line);
  font:inherit;font-size:.95rem;font-weight:500;text-transform:none;letter-spacing:0;
  background:var(--surface);color:var(--ink);width:100%;
}
.pd-field input:focus,.menu-dish input:focus{outline:none;border-color:var(--orange);background:var(--surface)}
.pd-inline{display:flex;gap:8px;align-items:stretch}
.pd-inline input{flex:1}
.pd-check{display:flex;align-items:center;gap:8px;font-size:.9rem;font-weight:600;color:var(--ink-2)}
.menu-board{display:grid;gap:var(--gap);width:100%}
.menu-hero{
  display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:18px 24px;
  padding:clamp(22px,3vw,28px) clamp(22px,3vw,32px);border-radius:20px;
  border:1px solid var(--line);background:var(--surface);position:relative;overflow:hidden;
}
.menu-hero::before{
  content:"";position:absolute;inset:auto -8% -45% auto;width:200px;height:200px;border-radius:50%;
  background:rgba(255,107,26,.14);pointer-events:none;
}
.menu-hero-copy{display:grid;gap:10px;position:relative;z-index:1;min-width:min(100%,280px);flex:1}
.menu-hero-row{display:flex;flex-wrap:wrap;align-items:end;gap:12px 16px}
.menu-count{
  font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(2.6rem,7vw,3.8rem);
  line-height:.9;letter-spacing:-.04em;font-weight:800;
}
.menu-count em{font-style:normal;font-size:.34em;margin-left:8px;color:var(--muted);font-weight:700}
.menu-hero-badge{
  display:inline-flex;align-items:center;padding:7px 12px;border-radius:999px;
  font-size:.82rem;font-weight:800;background:rgba(255,107,26,.12);color:var(--orange-dark);
  border:1px solid rgba(255,107,26,.28);
}
.menu-hero-hint{margin:0;font-size:.92rem;color:var(--ink-2);line-height:1.45;max-width:40rem}
.menu-hero-actions{display:flex;flex-wrap:wrap;gap:10px;position:relative;z-index:1}
.menu-list-card{gap:18px}
.menu-list-head{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:10px 16px}
.menu-list-meta{font-size:.8rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.menu-dish-list{display:grid;gap:12px}
.menu-dish{
  display:grid;gap:14px;padding:16px 16px 18px;border-radius:16px;
  border:1.5px solid var(--line);background:var(--bg);
}
.menu-dish.has-name{border-color:#FFD0AE;background:linear-gradient(180deg,rgba(255,107,26,.04),var(--bg))}
.menu-dish-head{display:flex;align-items:center;gap:10px;min-width:0}
.menu-dish-num{
  flex:none;width:36px;height:36px;border-radius:11px;display:grid;place-items:center;
  font-size:.78rem;font-weight:800;letter-spacing:.04em;
  background:var(--cream);color:var(--orange-dark);border:1px solid var(--line);
}
.menu-dish-title{
  flex:1;min-width:0;font-family:'Bricolage Grotesque',sans-serif;font-size:1.05rem;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.menu-dish-remove{
  flex:none;border:0;background:transparent;color:#B91C1C;font:inherit;font-size:.82rem;
  font-weight:700;cursor:pointer;padding:6px 8px;border-radius:8px;
}
.menu-dish-remove:hover:not(:disabled){background:#FEE2E2}
.menu-dish-remove:disabled{opacity:.35;cursor:not-allowed}
html[data-theme="dark"] .menu-dish-remove{color:#FCA5A5}
html[data-theme="dark"] .menu-dish-remove:hover:not(:disabled){background:#7F1D1D}
.menu-dish-body{
  display:grid;gap:14px;
  grid-template-columns:140px minmax(0,1fr);align-items:start;
}
.menu-photo{
  display:grid;gap:8px;justify-items:stretch;
}
.menu-photo img,.menu-photo-empty{
  width:140px;height:140px;border-radius:14px;object-fit:cover;
  border:1.5px solid var(--line);background:var(--cream);
}
.menu-photo-empty{
  display:grid;place-items:center;font-size:.78rem;font-weight:800;
  letter-spacing:.04em;text-transform:uppercase;color:var(--muted);
}
.menu-photo-actions{display:grid;gap:4px}
.menu-photo-btn{
  display:inline-flex;align-items:center;justify-content:center;
  min-height:34px;padding:0 10px;border-radius:10px;border:1.5px solid var(--line);
  background:var(--surface);color:var(--ink-2);font:inherit;font-size:.78rem;font-weight:700;
  cursor:pointer;text-align:center;
}
.menu-photo-btn:hover{border-color:var(--orange);color:var(--orange-dark)}
.menu-photo-clear{
  border:0;background:transparent;color:#B91C1C;font:inherit;font-size:.75rem;
  font-weight:700;cursor:pointer;padding:4px;border-radius:8px;
}
.menu-photo-clear:hover{background:#FEE2E2}
html[data-theme="dark"] .menu-photo-clear{color:#FCA5A5}
html[data-theme="dark"] .menu-photo-clear:hover{background:#7F1D1D}
.menu-dish-fields{
  display:grid;gap:12px;
  grid-template-columns:minmax(0,1.4fr) minmax(110px,.55fr);
}
.menu-field-desc{grid-column:1 / -1}
.pd-modal-scrim{
  position:fixed;inset:0;z-index:80;display:grid;place-items:center;
  padding:20px;background:rgba(15,18,22,.48);backdrop-filter:blur(2px);
}
.pd-modal{
  width:min(100%,420px);display:grid;gap:12px;padding:22px 22px 18px;
  border-radius:18px;border:1px solid var(--line);background:var(--surface);
  box-shadow:0 24px 60px -28px rgba(15,18,22,.55);
}
.pd-modal h3{
  margin:0;font-family:'Bricolage Grotesque',sans-serif;font-size:1.2rem;letter-spacing:-.02em;
}
.pd-modal p{margin:0;font-size:.92rem;color:var(--ink-2);line-height:1.5}
.pd-modal p strong{color:var(--ink)}
.pd-modal-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:6px}
.btn-danger-solid{
  border:0;background:#DC2626;color:#fff;border-radius:12px;
  min-height:42px;padding:0 18px;font:inherit;font-size:.92rem;font-weight:700;cursor:pointer;
}
.btn-danger-solid:hover{background:#B91C1C}
.pd-actions-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.pd-cep-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.pd-cep-msg{font-size:.85rem;font-weight:500;color:var(--muted);font-style:normal}
.btn-search{
  border:0;background:var(--orange);color:#fff;border-radius:12px;
  min-height:42px;padding:0 22px;font:inherit;font-size:.95rem;font-weight:700;
  cursor:pointer;box-shadow:0 8px 20px -12px rgba(255,107,26,.8);white-space:nowrap;width:fit-content;
}
.btn-search:hover:not(:disabled){background:var(--orange-dark)}
.btn-search:disabled{opacity:.65;cursor:not-allowed}
.btn-nav-light{
  border:1.5px solid var(--line);background:transparent;color:var(--ink-2);
  border-radius:12px;min-height:42px;padding:0 16px;font:inherit;font-weight:700;cursor:pointer;
}
.btn-nav-light:hover{border-color:var(--orange);color:var(--orange-dark)}
.fb-board{display:grid;gap:var(--gap);width:100%}
.fb-hero{
  display:grid;gap:18px;padding:clamp(22px,3vw,28px) clamp(22px,3vw,32px);
  border-radius:20px;border:1px solid var(--line);background:var(--surface);
  position:relative;overflow:hidden;
}
.fb-hero::before{
  content:"";position:absolute;inset:auto -10% -40% auto;width:220px;height:220px;border-radius:50%;
  background:rgba(255,180,0,.16);pointer-events:none;
}
.fb-hero-copy{display:grid;gap:10px;position:relative;z-index:1}
.fb-hero-row{display:flex;flex-wrap:wrap;align-items:end;gap:14px 20px}
.fb-score{
  font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(2.8rem,7vw,4rem);
  line-height:.9;letter-spacing:-.04em;font-weight:800;
}
.fb-score em{font-style:normal;font-size:.32em;margin-left:8px;color:var(--muted);font-weight:700}
.fb-hero-meta{display:grid;gap:4px}
.fb-stars,.fb-stars-inline{color:#F59E0B;letter-spacing:.08em;font-size:1rem}
.fb-hero-count{font-size:.9rem;font-weight:600;color:var(--ink-2)}
.fb-hero-hint{margin:0;font-size:.92rem;color:var(--ink-2);line-height:1.45;max-width:42rem}
.fb-stat-grid{
  display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;position:relative;z-index:1;
}
.fb-stat{
  display:grid;gap:2px;padding:14px 16px;border-radius:14px;border:1px solid var(--line);background:var(--bg);
}
.fb-stat strong{font-family:'Bricolage Grotesque',sans-serif;font-size:1.45rem;letter-spacing:-.02em}
.fb-stat span{font-size:.78rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.fb-list-card{gap:16px}
.fb-filters{
  display:inline-flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:12px;
  background:var(--cream);border:1px solid var(--line);
}
.fb-filter{
  border:0;background:transparent;color:var(--ink-2);border-radius:9px;
  min-height:34px;padding:0 12px;font:inherit;font-size:.82rem;font-weight:700;cursor:pointer;
}
.fb-filter:hover{color:var(--orange-dark)}
.fb-filter.is-active{background:var(--surface);color:var(--orange-dark);box-shadow:0 1px 0 rgba(31,35,40,.06)}
.fb-empty{
  display:grid;gap:6px;padding:28px 18px;border-radius:14px;border:1.5px dashed var(--line);
  background:var(--bg);text-align:center;
}
.fb-empty strong{font-size:1rem}
.fb-empty p{margin:0;font-size:.9rem;color:var(--muted);line-height:1.45}
.fb-reviews{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.fb-review{
  display:grid;gap:10px;padding:16px 16px 18px;border-radius:16px;
  border:1.5px solid var(--line);background:var(--bg);
}
.fb-review.is-mock{border-style:dashed;opacity:.96}
.fb-review-top{display:flex;align-items:center;gap:12px;min-width:0}
.fb-avatar{
  width:42px;height:42px;border-radius:50%;flex:none;display:grid;place-items:center;
  background:linear-gradient(135deg,var(--orange),var(--yellow));color:#fff;font-weight:800;font-size:.95rem;
}
.fb-review-who{flex:1;min-width:0;display:grid;gap:2px}
.fb-review-who strong{
  font-family:'Bricolage Grotesque',sans-serif;font-size:1.02rem;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.fb-stars-inline{font-size:.85rem}
.fb-tag{
  flex:none;font-style:normal;font-size:.68rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
  padding:4px 8px;border-radius:999px;background:var(--cream);color:var(--muted);
}
.fb-tag.real{background:rgba(22,163,74,.12);color:#166534}
html[data-theme="dark"] .fb-tag.real{background:#14532D;color:#86EFAC}
.fb-review-meta{display:flex;flex-wrap:wrap;gap:8px 14px;font-size:.82rem;color:var(--muted);font-weight:600}
.fb-review-comment{margin:0;font-size:.95rem;color:var(--ink-2);line-height:1.5}
.fb-review-comment.is-empty{color:var(--muted);font-style:italic}
.reminder-check{margin:0}
.live-board,.hours-board,.report-board{display:grid;gap:var(--gap);width:100%}
.live-hero,.report-hero{
  display:grid;gap:16px;padding:clamp(22px,3vw,28px) clamp(22px,3vw,32px);
  border-radius:20px;border:1px solid var(--line);background:var(--surface);
  position:relative;overflow:hidden;
}
.live-hero::before{
  content:"";position:absolute;inset:auto -10% -40% auto;width:200px;height:200px;border-radius:50%;
  background:rgba(34,197,94,.14);pointer-events:none;
}
.live-hero-copy,.report-hero > div{display:grid;gap:10px;position:relative;z-index:1}
.live-hero-row{display:flex;flex-wrap:wrap;align-items:end;gap:12px 16px}
.live-count{
  font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(2.8rem,7vw,4rem);
  line-height:.9;letter-spacing:-.04em;font-weight:800;
}
.live-count em{font-style:normal;font-size:.32em;margin-left:8px;color:var(--muted);font-weight:700}
.live-pulse{
  display:inline-flex;align-items:center;padding:7px 12px;border-radius:999px;
  font-size:.78rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
  background:rgba(22,163,74,.12);color:#166534;border:1px solid rgba(22,163,74,.25);
}
.live-hint{margin:0;font-size:.92rem;color:var(--ink-2);line-height:1.45;max-width:40rem}
.live-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.live-list li{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:var(--bg);
}
.live-list span{font-size:.82rem;color:var(--muted);font-weight:600}
.hours-list{display:grid;gap:10px}
.hours-row{
  display:grid;grid-template-columns:110px auto 1fr auto 1fr;gap:8px;align-items:center;
  padding:12px;border-radius:12px;border:1px solid var(--line);background:var(--bg);
}
.hours-row.is-closed{opacity:.72}
.hours-row strong{font-size:.9rem}
.hours-closed{text-transform:none;letter-spacing:0;font-size:.82rem;font-weight:600;color:var(--ink-2)}
.hours-row input[type="time"]{
  padding:10px 12px;border-radius:10px;border:1.5px solid var(--line);
  font:inherit;background:var(--surface);color:var(--ink);width:100%;
}
.hours-row input[type="time"]:disabled{opacity:.45}
.hours-sep{font-size:.8rem;color:var(--muted);text-align:center}
.report-title{margin:0;font-family:'Bricolage Grotesque',sans-serif;font-size:1.6rem;letter-spacing:-.02em}
.report-stats{grid-template-columns:repeat(4,minmax(0,1fr))}
.report-delta{font-size:.72rem;font-weight:700;color:var(--muted);font-style:normal}
.report-charts{display:grid;grid-template-columns:1fr 1fr;gap:var(--gap)}
.report-chart-wide{grid-column:1 / -1}
.report-chart{display:grid;gap:8px}
.report-bars{
  display:flex;align-items:flex-end;gap:8px;height:120px;padding:8px 4px 0;
  border-radius:14px;background:var(--bg);border:1px solid var(--line);
}
.report-bars i{
  flex:1;min-width:0;border-radius:6px 6px 0 0;
  background:linear-gradient(180deg,#FFB26A 0%,#FF8A3D 100%);
}
.report-bars i.peak{
  background:linear-gradient(180deg,#FF8A3D 0%,var(--orange-dark) 100%);
}
html[data-theme="dark"] .report-bars{
  background:#12161C;border-color:#2A313A;
}
html[data-theme="dark"] .report-bars i{
  background:linear-gradient(180deg,#FFB26A 0%,#FF8A3D 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.2);
}
html[data-theme="dark"] .report-bars i.peak{
  background:linear-gradient(180deg,#FF9A4A 0%,#E5560A 100%);
}
.report-bars-x{
  display:flex;justify-content:space-between;gap:4px;
  font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.02em;
}
.report-bars-x span{flex:1;text-align:center;min-width:0;overflow:hidden;text-overflow:ellipsis}
.report-snapshot{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.report-snapshot li{
  display:flex;justify-content:space-between;gap:16px;padding:12px 0;
  border-bottom:1px solid var(--line);font-size:.92rem;
}
.report-snapshot li:last-child{border-bottom:0;padding-bottom:0}
.report-snapshot span{color:var(--muted)}
.report-snapshot strong{text-align:right}
.pd-muted{color:var(--muted);margin:0;line-height:1.45}
.pd-ok{color:#166534;font-weight:600;margin:0}
.pd-error{color:#B91C1C;font-weight:600;margin:0}
html[data-theme="dark"] .pd-ok{color:#86EFAC}
html[data-theme="dark"] .pd-error{color:#FCA5A5}

@media (min-width:860px){
  .account-fields{grid-template-columns:1fr 1fr}
}
@media (max-width:860px){
  .app-shell{margin-left:0}
  .side-rail{box-shadow:12px 0 40px -12px rgba(31,35,40,.45)}
  .app-page.is-menu-open .menu-scrim{
    display:block;position:fixed;inset:0;z-index:45;border:0;background:rgba(15,18,22,.45);cursor:pointer;
  }
  .partner-chip{display:none}
}
@media (max-width:720px){
  .pd-levels{grid-template-columns:1fr}
  .menu-dish-body,.menu-dish-fields{grid-template-columns:1fr}
  .menu-photo img,.menu-photo-empty{width:100%;height:180px}
  .menu-hero-actions{width:100%}
  .menu-hero-actions .btn-search,
  .menu-hero-actions .btn-nav-light{flex:1;min-width:140px;justify-content:center}
  .wait-custom{flex-wrap:wrap}
  .wait-custom .btn-search{width:100%}
  .wait-open-toggle,.wait-capacity-fields{grid-template-columns:1fr}
  .wait-reminder .btn-search{width:100%}
  .fb-stat-grid,.report-stats,.report-charts{grid-template-columns:1fr}
  .report-chart-wide{grid-column:auto}
  .fb-filters{width:100%}
  .fb-filter{flex:1}
  .hours-row{grid-template-columns:1fr 1fr;gap:8px}
  .hours-row strong{grid-column:1 / -1}
  .hours-closed{grid-column:1 / -1}
  .hours-sep{display:none}
}
`;
