/**
 * Assistente FilaZero — Ollama local (OLLAMA_ENABLED=true) ou respostas mockadas.
 *
 * Env:
 *   OLLAMA_ENABLED=true|false
 *   OLLAMA_BASE_URL=http://127.0.0.1:11434
 *   OLLAMA_MODEL=llama3.2
 */

function ollamaEnabled() {
  const v = String(process.env.OLLAMA_ENABLED || "false").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function mockAnswer(message, restaurants = []) {
  const q = String(message || "").toLowerCase();
  const list = Array.isArray(restaurants) ? restaurants : [];

  const byType = (re) =>
    list.filter((r) => re.test(`${r.name} ${r.cuisine || ""} ${r.cuisineType || ""}`));

  if (/pizza|pizzaria/.test(q)) {
    const hits = byType(/pizza/);
    if (hits.length) {
      return `Encontrei ${hits.length} opção(ões) de pizza perto: ${hits
        .slice(0, 3)
        .map((r) => `${r.name} (~${r.waitMinutes} min, ${r.distanceLabel})`)
        .join("; ")}. (modo mock — ligue OLLAMA_ENABLED=true para IA local)`;
    }
    return "Não vi pizzaria na lista atual. Amplie a distância ou busque de novo. (modo mock)";
  }

  if (/hambur|burger|burguer/.test(q)) {
    const hits = byType(/burger|hambur|grill/);
    if (hits.length) {
      return `Opções de hambúrguer: ${hits
        .slice(0, 3)
        .map((r) => `${r.name} (~${r.waitMinutes} min)`)
        .join("; ")}. (modo mock)`;
    }
    return "Não achei hamburgueria na lista filtrada. (modo mock)";
  }

  if (/menos fila|baixa|rápido|espera/.test(q)) {
    const sorted = [...list].sort((a, b) => (a.waitMinutes ?? 99) - (b.waitMinutes ?? 99));
    const top = sorted[0];
    if (top) {
      return `A menor espera agora é ${top.name}: ~${top.waitMinutes} min (${top.waitLabel}), a ${top.distanceLabel}. (modo mock)`;
    }
    return "Sem restaurantes na lista para comparar espera. (modo mock)";
  }

  if (/perto|próximo|proximo|mais perto/.test(q)) {
    const sorted = [...list].sort((a, b) => (a.distanceM ?? 99999) - (b.distanceM ?? 99999));
    const top = sorted[0];
    if (top) {
      return `O mais perto é ${top.name}: ${top.distanceLabel} (${top.walkLabel}), espera ~${top.waitMinutes} min. (modo mock)`;
    }
    return "Sem locais na lista. (modo mock)";
  }

  if (list.length) {
    const sample = list
      .slice(0, 3)
      .map((r) => `${r.name} (~${r.waitMinutes} min)`)
      .join("; ");
    return `Posso ajudar com fila, distância ou tipo (pizza, burger, self-service). Agora vejo: ${sample}. Pergunte algo específico. (modo mock — OLLAMA_ENABLED=false)`;
  }

  return "Não há restaurantes carregados ainda. Faça uma busca no mapa e pergunte de novo. (modo mock)";
}

async function callOllama(message, restaurants = []) {
  const base = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL || "llama3.2";

  const context = restaurants.slice(0, 12).map((r) => ({
    name: r.name,
    waitMinutes: r.waitMinutes,
    distanceLabel: r.distanceLabel,
    cuisineType: r.cuisineType,
    cuisine: r.cuisine,
    priceLevel: r.priceLevel,
    rating: r.rating,
  }));

  const system = `Você é o assistente do FilaZero, app que mostra lotação e distância de restaurantes perto do usuário no horário de almoço.
Responda em português, curto e objetivo. Use só os dados do contexto JSON quando falar de lugares.
Se não souber, diga para ampliar o filtro/busca.`;

  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Contexto (restaurantes próximos):\n${JSON.stringify(context)}\n\nPergunta: ${message}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama HTTP ${res.status}${text ? `: ${text.slice(0, 180)}` : ""}`);
  }

  const data = await res.json();
  const answer = data?.message?.content || data?.response;
  if (!answer) throw new Error("Resposta vazia do Ollama");
  return String(answer).trim();
}

export async function askAssistant({ message, restaurants = [] }) {
  if (!message || !String(message).trim()) {
    return { enabled: ollamaEnabled(), mode: "mock", answer: "Escreva uma pergunta sobre restaurantes perto de você." };
  }

  if (!ollamaEnabled()) {
    return {
      enabled: false,
      mode: "mock",
      answer: mockAnswer(message, restaurants),
    };
  }

  try {
    const answer = await callOllama(message, restaurants);
    return { enabled: true, mode: "ollama", answer };
  } catch (err) {
    return {
      enabled: true,
      mode: "mock_fallback",
      answer: `${mockAnswer(message, restaurants)}\n\n(Ollama falhou: ${err.message})`,
      error: err.message,
    };
  }
}

export function getAssistantStatus() {
  return {
    enabled: ollamaEnabled(),
    baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    model: process.env.OLLAMA_MODEL || "llama3.2",
  };
}
