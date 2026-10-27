import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CHAT_STORAGE_KEY = "filazero-chat-threads";

/** Rota a pé no Google Maps até o lugar (nome + coords; origem opcional). */
export function buildGoNowUrl(place, origin) {
  if (!place) return null;
  const lat = Number(place.lat);
  const lng = Number(place.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return place.googleMapsDirUrl || place.mapsPlaceUrl || null;
  }
  const coord = `${lat},${lng}`;
  const address =
    place.address && !/não informado|modo demo/i.test(place.address)
      ? String(place.address).trim()
      : "";
  const dest = [place.name, address, coord].filter(Boolean).join(", ");
  const params = new URLSearchParams({
    api: "1",
    destination: dest,
    travelmode: "walking",
  });
  const oLat = Number(origin?.lat);
  const oLng = Number(origin?.lng);
  if (Number.isFinite(oLat) && Number.isFinite(oLng)) {
    params.set("origin", `${oLat},${oLng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Link para compartilhar: site do lugar, senão Google Maps. */
export function buildPlaceShareUrl(place) {
  if (!place) return "";
  if (place.websiteUrl) return place.websiteUrl;
  if (place.mapsPlaceUrl) return place.mapsPlaceUrl;
  if (place.lat != null && place.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${place.name || ""} ${place.lat},${place.lng}`
    )}`;
  }
  return place.googleMapsDirUrl || place.mapsUrl || "";
}

/** Compartilha via Web Share API ou copia o link (site ou Google). */
export async function sharePlace(place) {
  const url = buildPlaceShareUrl(place);
  if (!url) throw new Error("Sem link para compartilhar");
  const title = place?.name || "FilaZero";
  const text = place?.websiteUrl
    ? `Site de ${place.name || "restaurante"}`
    : `Localização de ${place?.name || "restaurante"}`;
  if (typeof navigator !== "undefined" && navigator.share) {
    await navigator.share({ title, text, url });
    return "shared";
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return "copied";
  }
  throw new Error("Não foi possível compartilhar");
}

export function formatCepInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function buildAddressLine({ street, number, neighborhood, city, state, cep }) {
  const streetPart = [street, number].filter(Boolean).join(", ");
  return [streetPart, neighborhood, city, state, cep].filter(Boolean).join(" — ");
}

export function parseStoredAddress(raw) {
  const text = String(raw || "");
  const parts = text.split("—").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const streetParts = parts[0].split(",").map((p) => p.trim());
    return {
      street: streetParts[0] || "",
      number: streetParts.slice(1).join(", ") || "",
      neighborhood: parts[1] || "",
      city: parts[2] || "",
      state: parts[3] || "",
      cep: parts[4] ? formatCepInput(parts[4]) : "",
    };
  }
  return {
    street: text,
    number: "",
    neighborhood: "",
    city: "",
    state: "",
    cep: "",
  };
}

/** Feedbacks de demonstração — sempre listados; reais vêm junto quando houver. */
export const MOCK_FEEDBACKS = [
  {
    id: "mock-1",
    userName: "Ana",
    rating: 5,
    waitMinutes: 8,
    comment: "Fila andou rápido no almoço e o prato estava bom.",
    isMock: true,
  },
  {
    id: "mock-2",
    userName: "Carlos",
    rating: 4,
    waitMinutes: 15,
    comment: "Um pouco de espera, mas vale a pena. Ambiente limpo.",
    isMock: true,
  },
  {
    id: "mock-3",
    userName: "Juliana",
    rating: 5,
    waitMinutes: 5,
    comment: "Cheguei cedo e quase não tinha fila. Voltarei!",
    isMock: true,
  },
];

export function mergeFeedbacksWithMocks(reviews = []) {
  const real = (Array.isArray(reviews) ? reviews : []).map((r) => ({
    ...r,
    isMock: false,
  }));
  return [...real, ...MOCK_FEEDBACKS];
}

export async function fetchPlacePage(placeId) {
  const res = await fetch(`/api/places/${encodeURIComponent(placeId)}`, {
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Não foi possível carregar o lugar");
  return data;
}

export async function trackGoNow(place) {
  if (!place?.id) return { ok: false, tracked: false };
  try {
    const res = await fetch(`/api/places/${encodeURIComponent(place.id)}/go-now`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeName: place.name || "",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, tracked: false };
    return { ok: true, tracked: Boolean(data.tracked) };
  } catch {
    return { ok: false, tracked: false };
  }
}

export async function submitPlaceFeedback(place, { rating, waitMinutes, comment }) {
  const res = await fetch(`/api/places/${encodeURIComponent(place.id)}/feedback`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      placeName: place.name,
      placeAddress: place.address,
      lat: place.lat,
      lng: place.lng,
      rating,
      waitMinutes,
      comment,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Não foi possível enviar o feedback");
  return data;
}

const SUGGESTIONS = [
  "Qual tem menos fila agora?",
  "Tem self-service perto?",
  "Onde comer pizza perto de mim?",
  "Me indique algo barato e rápido",
  "Qual fica a menos de 10 min a pé?",
  "Tem opção japonesa por perto?",
];

function newId() {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyThread() {
  return {
    id: newId(),
    title: "Nova conversa",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
}

function loadChatState() {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.threads)) return null;
    return data;
  } catch {
    return null;
  }
}

function saveChatState(threads, activeId) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ threads, activeId }));
  } catch {
    /* ignore quota */
  }
}

export function useUserExtras() {
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [assistant, setAssistant] = useState({ enabled: false, model: "" });

  const reload = async () => {
    try {
      const [f, h, s] = await Promise.all([
        fetch("/api/me/favorites", { credentials: "include" }).then((r) => r.json()),
        fetch("/api/me/history", { credentials: "include" }).then((r) => r.json()),
        fetch("/api/chat/status", { credentials: "include" }).then((r) => r.json()),
      ]);
      setFavorites(f.favorites || []);
      setHistory(h.history || []);
      setAssistant(s || { enabled: false });
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const toggleFavorite = async (place) => {
    const exists = favorites.some((f) => f.placeId === place.id);
    if (exists) {
      await fetch(`/api/me/favorites/${encodeURIComponent(place.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
    } else {
      await fetch("/api/me/favorites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: place.id,
          placeName: place.name,
          placeAddress: place.address,
          lat: place.lat,
          lng: place.lng,
        }),
      });
    }
    await reload();
  };

  const addHistory = async (place, note) => {
    await fetch("/api/me/history", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeId: place.id,
        placeName: place.name,
        placeAddress: place.address,
        lat: place.lat,
        lng: place.lng,
        note: note || "Almoço",
      }),
    });
    await reload();
  };

  const isFavorite = (placeId) => favorites.some((f) => f.placeId === placeId);

  return {
    favorites,
    history,
    assistant,
    reload,
    toggleFavorite,
    addHistory,
    isFavorite,
  };
}

export function ChatAssistant({ restaurants, status }) {
  const boot = useMemo(() => {
    const saved = loadChatState();
    if (saved?.threads?.length) {
      const activeId =
        saved.activeId && saved.threads.some((t) => t.id === saved.activeId)
          ? saved.activeId
          : saved.threads[0].id;
      return { threads: saved.threads, activeId };
    }
    const first = emptyThread();
    return { threads: [first], activeId: first.id };
  }, []);

  const [threads, setThreads] = useState(boot.threads);
  const [activeId, setActiveId] = useState(boot.activeId);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);
  const threadListRef = useRef(null);

  const active = threads.find((t) => t.id === activeId) || threads[0];
  const messages = active?.messages || [];
  const started = messages.some((m) => m.role === "user");

  useEffect(() => {
    saveChatState(threads, activeId);
  }, [threads, activeId]);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, busy, activeId]);

  const patchThread = useCallback((threadId, updater) => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        const next = typeof updater === "function" ? updater(t) : { ...t, ...updater };
        return { ...next, updatedAt: Date.now() };
      })
    );
  }, []);

  const startNewConversation = () => {
    const thread = emptyThread();
    setThreads((prev) => [thread, ...prev.filter((t) => t.id !== thread.id)]);
    setActiveId(thread.id);
    setInput("");
    requestAnimationFrame(() => {
      if (threadListRef.current) threadListRef.current.scrollTop = 0;
    });
  };

  const sendMessage = async (raw) => {
    const message = String(raw || "").trim();
    const threadId = activeId;
    const current = threads.find((t) => t.id === threadId);
    if (!message || busy || !current) return;

    const isFirst = !current.messages.some((m) => m.role === "user");
    patchThread(threadId, (t) => ({
      ...t,
      title: isFirst ? message.slice(0, 48) : t.title,
      messages: [...t.messages, { role: "user", text: message }],
    }));
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, restaurants }),
      });
      const data = await res.json();
      patchThread(threadId, (t) => ({
        ...t,
        messages: [
          ...t.messages,
          { role: "assistant", text: data.answer || data.error || "Sem resposta." },
        ],
      }));
    } catch (err) {
      patchThread(threadId, (t) => ({
        ...t,
        messages: [
          ...t.messages,
          { role: "assistant", text: err.message || "Falha no chat." },
        ],
      }));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e) => {
    e?.preventDefault?.();
    sendMessage(input);
  };

  // Mais recente sempre no topo
  const sortedThreads = useMemo(
    () =>
      [...threads].sort((a, b) => {
        const byUpdate = (b.updatedAt || 0) - (a.updatedAt || 0);
        if (byUpdate !== 0) return byUpdate;
        return (b.createdAt || 0) - (a.createdAt || 0);
      }),
    [threads]
  );

  return (
    <div className="assistant-shell">
      <aside className="assistant-history" aria-label="Histórico de conversas">
        <button type="button" className="assistant-new" onClick={startNewConversation}>
          + Nova conversa
        </button>
        <ul className="assistant-thread-list" ref={threadListRef}>
          {sortedThreads.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className={`assistant-thread ${t.id === activeId ? "is-active" : ""}`}
                onClick={() => setActiveId(t.id)}
              >
                <strong>{t.title || "Nova conversa"}</strong>
                <span>
                  {new Date(t.updatedAt || t.createdAt).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="assistant-main">
        <div className="chat-head">
          <div>
            <strong>Assistente FilaZero</strong>
            <p className="assistant-sub">Sugestões com base nos restaurantes perto de você.</p>
          </div>
          <span className={`ai-pill ${status?.enabled ? "on" : "off"}`}>
            {status?.enabled ? `Ollama · ${status.model || "local"}` : "Mock (OLLAMA off)"}
          </span>
        </div>

        {!started ? (
          <div className="assistant-welcome">
            <h2>Por onde começamos?</h2>
            <p>Escolha uma sugestão ou digite sua pergunta abaixo.</p>
            <div className="suggestion-grid" role="list">
              {SUGGESTIONS.map((text, i) => (
                <button
                  key={text}
                  type="button"
                  className="suggestion-chip"
                  style={{ animationDelay: `${i * 70}ms` }}
                  disabled={busy}
                  onClick={() => sendMessage(text)}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-log" ref={logRef}>
            {messages.map((m, i) => (
              <p key={`${activeId}-${i}`} className={`chat-msg ${m.role}`}>
                {m.text}
              </p>
            ))}
            {busy && <p className="chat-msg assistant is-typing">Pensando…</p>}
          </div>
        )}

        <form className="chat-form" onSubmit={onSubmit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex.: qual tem menos fila?"
            disabled={busy}
          />
          <button type="submit" disabled={busy || !input.trim()}>
            {busy ? "…" : "Enviar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export async function fetchMenu(place) {
  const params = new URLSearchParams({
    placeName: place.name || "",
    cuisineType: place.cuisineType || "",
  });
  const res = await fetch(`/api/menus/${encodeURIComponent(place.id)}?${params}`, {
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Falha ao carregar cardápio");
  return data;
}
