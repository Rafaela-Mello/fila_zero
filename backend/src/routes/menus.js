import { Router } from "express";
import { query } from "../config/db.js";

const router = Router();

function requireAuth(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ error: "Faça login." });
  }
  return next();
}

function photo(id) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=480&h=360&q=80`;
}

function dish(name, description, price, photoId, priceLabel) {
  return {
    id: `${name}-${price}`,
    name,
    description,
    price,
    priceLabel:
      priceLabel ||
      (price === 0
        ? "Incluso"
        : price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })),
    image: photo(photoId),
  };
}

const MOCK_MENUS = {
  default: [
    dish("Prato do dia", "Arroz, feijão, salada e acompanhamento", 28.9, "1546069901-ba959558a1ef"),
    dish("Grelhado da casa", "Proteína grelhada com legumes", 34.9, "1544025162-d76694265947"),
    dish("Opção vegetariana", "Grãos, legumes e molho da casa", 26.5, "1512621776951-a57141f2eefd"),
    dish("Sobremesa leve", "Fruta da estação ou doce do dia", 12.0, "1488477181948-9722b7c8c8f7"),
  ],
  pizza: [
    dish("Mussarela", "Molho de tomate e queijo mussarela", 42.9, "1513104890138-7c749659a591"),
    dish("Calabresa", "Calabresa fatiada e cebola", 46.9, "1574071318508-1cdbab80d002"),
    dish("Margherita", "Tomate, manjericão e mussarela", 48.9, "1593560708920-61dd98c46a4e"),
    dish("Refrigerante 350ml", "Lata gelada", 7.5, "1622597467836-f3285f2131b8"),
  ],
  burger: [
    dish("Smash burger", "Pão, blend smash e queijo", 32.9, "1568901346375-23c9450c58cd"),
    dish("Batata frita", "Porção crocante", 18.9, "1573080496219-bb080dd4f877"),
    dish("Milkshake", "Chocolate ou baunilha", 16.9, "1572490122747-3968b75cc699"),
    dish("Combo almoço", "Burger + batata + bebida", 39.9, "1550547660-d9450f859349"),
  ],
  self_service: [
    dish("Buffet livre", "Saladas, quentes e grelhados", 49.9, "1414235077428-338989a2e8c0"),
    dish("Prato montado", "Até 3 proteínas + acompanhamentos", 36.9, "1555939594-58d7cb561ad1"),
    dish("Salada especial", "Mix de folhas e toppings", 24.9, "1512621776951-a57141f2eefd"),
    dish("Suco incluso", "Jarra de suco natural", 0, "1622597467836-f3285f2131b8", "Incluso"),
  ],
  japanese: [
    dish("Temaki", "Salmão ou atum com cream cheese", 29.9, "1579871494447-9811cf80d66c"),
    dish("Hot roll", "8 unidades empanadas", 34.9, "1611143669185-af224c5e3252"),
    dish("Yakissoba", "Macarrão com legumes e carne", 38.9, "1617093727343-374698b1b08d"),
    dish("Missoshiru", "Sopa tradicional", 9.9, "1547592166-23ac45744acd"),
  ],
  italian: [
    dish("Espaguete ao sugo", "Molho de tomate fresco", 36.9, "1621996346565-e3dbc646d9a9"),
    dish("Lasanha", "Carne ou frango", 44.9, "1574894709920-11b28e7367e3"),
    dish("Risoto do dia", "Cremoso com acompanhamento", 48.9, "1476124369491-e7addf5db371"),
    dish("Tiramisù", "Sobremesa clássica", 19.9, "1571875257727-256c39da42af"),
  ],
  grill: [
    dish("Picanha grelhada", "Acompanha farofa e vinagrete", 59.9, "1544025162-d76694265947"),
    dish("Costela", "Assada lentamente", 54.9, "1558030006-450675393462"),
    dish("Linguiça artesanal", "Porção para 2", 32.9, "1529692236671-f1f8cfbfa9a3"),
    dish("Mandioca frita", "Crocante com molho", 16.9, "1518975476963-0d9d8d0f0a3c"),
  ],
  cafe: [
    dish("Café espresso", "Curto ou longo", 8.5, "1495474472287-4d71bcdd2085"),
    dish("Pão de queijo", "Porção com 6 unidades", 14.9, "1509440159596-0249088772ff"),
    dish("Sanduíche natural", "Frango ou vegetais", 22.9, "1528735602780-2552fd46c7af"),
    dish("Bolo do dia", "Fatia", 12.9, "1578985545062-69928b1d9587"),
  ],
  healthy: [
    dish("Bowl fit", "Grãos, proteína e vegetais", 34.9, "1512621776951-a57141f2eefd"),
    dish("Wrap integral", "Recheio leve", 27.9, "1565299624946-b28f40a0ae38"),
    dish("Suco detox", "Verde ou vermelho", 14.9, "1622597467836-f3285f2131b8"),
    dish("Iogurte com granola", "Frutas da estação", 18.9, "1488477181948-9722b7c8c8f7"),
  ],
  fast_food: [
    dish("X-salada", "Clássico da casa", 24.9, "1550547660-d9450f859349"),
    dish("Hot dog", "Completo", 18.9, "1612392062795-30f3a0a5b0e1"),
    dish("Porção de batata", "Com cheddar", 21.9, "1573080496219-bb080dd4f877"),
    dish("Refrigerante", "Lata 350ml", 7.0, "1622597467836-f3285f2131b8"),
  ],
};

function pickMenuKey(placeName = "", cuisineType = "") {
  const key = String(cuisineType || "").toLowerCase();
  if (MOCK_MENUS[key]) return key;
  if (/pizza/i.test(placeName)) return "pizza";
  if (/burger|hambur/i.test(placeName)) return "burger";
  if (/self|buffet/i.test(placeName)) return "self_service";
  if (/japa|sushi|temaki/i.test(placeName)) return "japanese";
  if (/pasta|massa|italiano|pizza/i.test(placeName)) return "italian";
  if (/churras|grelhad/i.test(placeName)) return "grill";
  if (/caf[eé]|padaria/i.test(placeName)) return "cafe";
  if (/fit|saud[aá]vel/i.test(placeName)) return "healthy";
  if (/lanche|fast/i.test(placeName)) return "fast_food";
  return "default";
}

function normalizeItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    if (typeof item === "string") {
      return dish(item, "Item do cardápio", 0, "1546069901-ba959558a1ef");
    }
    const price = Number(item.price);
    return {
      id: item.id || `${item.name || "item"}-${index}`,
      name: item.name || "Item",
      description: item.description || "",
      price: Number.isFinite(price) ? price : null,
      priceLabel:
        item.priceLabel ||
        (Number.isFinite(price) && price > 0
          ? price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : price === 0
            ? "Incluso"
            : "Consulte"),
      image: item.image || null,
    };
  });
}

function mockMenuFor(placeId, placeName = "", cuisineType = "") {
  const key = pickMenuKey(placeName, cuisineType);
  return {
    placeId,
    placeName: placeName || "Restaurante",
    menuDate: new Date().toISOString().slice(0, 10),
    cuisineType: key,
    items: normalizeItems(MOCK_MENUS[key] || MOCK_MENUS.default),
    source: "mock",
  };
}

router.get("/:placeId", requireAuth, async (req, res) => {
  try {
    const placeId = req.params.placeId;
    const { placeName, cuisineType } = req.query;
    const today = new Date().toISOString().slice(0, 10);

    const rows = await query(
      `SELECT place_id AS placeId, place_name AS placeName, menu_date AS menuDate, items_json AS items
       FROM daily_menus WHERE place_id = ? AND menu_date = ? LIMIT 1`,
      [placeId, today]
    );

    if (rows[0]) {
      const items =
        typeof rows[0].items === "string" ? JSON.parse(rows[0].items) : rows[0].items;
      return res.json({
        placeId: rows[0].placeId,
        placeName: rows[0].placeName,
        menuDate: rows[0].menuDate,
        items: normalizeItems(items),
        source: "db",
      });
    }

    res.json(mockMenuFor(placeId, String(placeName || ""), String(cuisineType || "")));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
