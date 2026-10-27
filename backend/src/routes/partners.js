import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { query } from "../config/db.js";
import { saveMenuPhoto } from "../services/storage.js";
import { waitLevel, haversineMeters, formatDistance, formatWalk } from "../services/places.js";

const router = Router();
const SALT_ROUNDS = 10;

function normalizeMenuImage(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.startsWith("/uploads/menu/")) return raw.slice(0, 512);
  if (/^https?:\/\//i.test(raw)) return raw.slice(0, 512);
  return null;
}

const CUISINE_LABELS = {
  self_service: "Self-service / buffet",
  burger: "Hambúrguer",
  pizza: "Pizza",
  japanese: "Japonês",
  italian: "Italiano / massas",
  grill: "Churrasco / grelhados",
  cafe: "Café / padaria",
  healthy: "Saudável / fit",
  fast_food: "Lanches",
  other: "Outros",
};

const PRICE_LEVEL_LABELS = { 1: "Barato", 2: "Moderado", 3: "Caro" };

function requireAuth(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ error: "Faça login." });
  }
  return next();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeHttpUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS = {
  mon: "Segunda",
  tue: "Terça",
  wed: "Quarta",
  thu: "Quinta",
  fri: "Sexta",
  sat: "Sábado",
  sun: "Domingo",
};

export const DEFAULT_HOURS = {
  mon: { open: "11:00", close: "15:00", closed: false },
  tue: { open: "11:00", close: "15:00", closed: false },
  wed: { open: "11:00", close: "15:00", closed: false },
  thu: { open: "11:00", close: "15:00", closed: false },
  fri: { open: "11:00", close: "15:00", closed: false },
  sat: { open: "11:00", close: "16:00", closed: false },
  sun: { open: "11:00", close: "15:00", closed: true },
};

function parseHoursJson(raw) {
  if (!raw) return null;
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!value || typeof value !== "object") return null;
    return value;
  } catch {
    return null;
  }
}

function normalizeHours(input) {
  const src = input && typeof input === "object" ? input : {};
  const out = {};
  for (const key of Object.keys(DAY_LABELS)) {
    const day = src[key] || DEFAULT_HOURS[key];
    const closed = Boolean(day?.closed);
    const open = String(day?.open || "11:00").slice(0, 5);
    const close = String(day?.close || "15:00").slice(0, 5);
    out[key] = { open, close, closed };
  }
  return out;
}

function minutesFromHHMM(value) {
  const m = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function isWithinHours(hours, date = new Date()) {
  if (!hours) return null;
  const key = DAY_KEYS[date.getDay()];
  const day = hours[key];
  if (!day) return null;
  if (day.closed) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  const open = minutesFromHHMM(day.open);
  const close = minutesFromHHMM(day.close);
  if (open == null || close == null) return null;
  if (close >= open) return now >= open && now < close;
  // atravessa meia-noite
  return now >= open || now < close;
}

function todayHoursLabel(hours, date = new Date()) {
  if (!hours) return null;
  const key = DAY_KEYS[date.getDay()];
  const day = hours[key];
  if (!day) return null;
  if (day.closed) return "Fechado hoje";
  return `Hoje ${day.open}–${day.close}`;
}

function mapPartnerRow(row) {
  if (!row) return null;
  const waitMinutes = Number(row.waitMinutes ?? row.wait_minutes ?? 10);
  const level = waitLevel(waitMinutes);
  const hours = parseHoursJson(row.hoursJson ?? row.hours_json);
  const promoPriceRaw = row.promoPrice ?? row.promo_price;
  const promoPrice =
    promoPriceRaw != null && promoPriceRaw !== "" ? Number(promoPriceRaw) : null;
  const promoActive = Boolean(Number(row.promoActive ?? row.promo_active ?? 0));
  const promoTitle = row.promoTitle || row.promo_title || null;
  return {
    id: row.id,
    placeId: row.placeId || row.place_id,
    name: row.name,
    address: row.address || null,
    lat: Number(row.lat),
    lng: Number(row.lng),
    websiteUrl: row.websiteUrl || row.website_url || null,
    cuisineType: row.cuisineType || row.cuisine_type || "other",
    cuisineTypeLabel:
      CUISINE_LABELS[row.cuisineType || row.cuisine_type] || CUISINE_LABELS.other,
    selfService: Boolean(Number(row.selfService ?? row.self_service)),
    waitMinutes,
    waitLevel: level.key,
    waitLabel: level.label,
    waitUpdatedAt: row.waitUpdatedAt || row.wait_updated_at || null,
    isOpen: Boolean(Number(row.isOpen ?? row.is_open ?? 1)),
    capacityTotal:
      row.capacityTotal != null || row.capacity_total != null
        ? Number(row.capacityTotal ?? row.capacity_total)
        : null,
    capacityFree:
      row.capacityFree != null || row.capacity_free != null
        ? Number(row.capacityFree ?? row.capacity_free)
        : null,
    promoTitle,
    promoDescription: row.promoDescription || row.promo_description || null,
    promoPrice: Number.isFinite(promoPrice) ? promoPrice : null,
    promoActive,
    promoLabel:
      promoActive && promoTitle
        ? promoPrice != null && Number.isFinite(promoPrice)
          ? `${promoTitle} · ${promoPrice.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}`
          : promoTitle
        : null,
    hours,
    hoursLabel: todayHoursLabel(hours),
    scheduleOpen: isWithinHours(hours),
    reminderEnabled: Boolean(Number(row.reminderEnabled ?? row.reminder_enabled ?? 1)),
    isPublished: Boolean(Number(row.isPublished ?? row.is_published ?? 1)),
    createdAt: row.createdAt || row.created_at || null,
  };
}

const PARTNER_SELECT = `id, place_id AS placeId, name, address, lat, lng,
  website_url AS websiteUrl, cuisine_type AS cuisineType, self_service AS selfService,
  wait_minutes AS waitMinutes, wait_updated_at AS waitUpdatedAt,
  is_open AS isOpen, capacity_total AS capacityTotal, capacity_free AS capacityFree,
  promo_title AS promoTitle, promo_description AS promoDescription,
  promo_price AS promoPrice, promo_active AS promoActive,
  hours_json AS hoursJson, reminder_enabled AS reminderEnabled,
  is_published AS isPublished, owner_user_id AS ownerUserId,
  created_at AS createdAt, updated_at AS updatedAt`;

async function getOwned(userId) {
  const rows = await query(
    `SELECT ${PARTNER_SELECT} FROM partner_restaurants WHERE owner_user_id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

/** Cadastro: cria conta parceiro + restaurante (ou vincula se já logado). */
router.post("/register", async (req, res, next) => {
  try {
    const body = req.body || {};
    const restaurantName = String(body.restaurantName || "").trim();
    const address = String(body.address || "").trim();
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const websiteUrl = normalizeHttpUrl(body.websiteUrl);
    const cuisineType = String(body.cuisineType || "other").trim() || "other";
    const selfService = Boolean(body.selfService);
    const waitMinutes = Math.min(60, Math.max(0, Number(body.waitMinutes) || 10));

    if (!restaurantName || restaurantName.length < 2) {
      return res.status(400).json({ error: "Informe o nome do restaurante." });
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        error: "Informe a localização do restaurante (use o botão de localização).",
      });
    }

    let userId = req.user?.id || null;

    if (!userId) {
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");

      if (!name || name.length < 2) {
        return res.status(400).json({ error: "Informe seu nome." });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: "E-mail inválido." });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Senha com pelo menos 6 caracteres." });
      }

      const existing = await query("SELECT id, role FROM users WHERE email = ? LIMIT 1", [email]);
      if (existing[0]) {
        return res.status(409).json({
          error: "Já existe conta com este e-mail. Faça login e cadastre o restaurante logado.",
        });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const result = await query(
        "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'partner')",
        [email, passwordHash, name]
      );
      userId = result.insertId;

      const rows = await query(
        `SELECT id, google_id, email, name, avatar_url, role,
                (password_hash IS NOT NULL AND password_hash <> '') AS has_password
         FROM users WHERE id = ? LIMIT 1`,
        [userId]
      );
      const user = {
        id: rows[0].id,
        email: rows[0].email,
        name: rows[0].name,
        avatar_url: rows[0].avatar_url,
        google_id: rows[0].google_id || null,
        has_password: Boolean(Number(rows[0].has_password)),
        role: rows[0].role || "partner",
      };

      await new Promise((resolve, reject) => {
        req.login(user, (err) => {
          if (err) return reject(err);
          req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
        });
      });
    } else {
      const owned = await getOwned(userId);
      if (owned) {
        return res.status(409).json({ error: "Você já tem um restaurante cadastrado." });
      }
      await query("UPDATE users SET role = 'partner' WHERE id = ?", [userId]);
    }

    const insert = await query(
      `INSERT INTO partner_restaurants
        (place_id, name, address, lat, lng, website_url, cuisine_type, self_service,
         wait_minutes, wait_updated_at, owner_user_id, is_published)
       VALUES ('pending', ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 1)`,
      [
        restaurantName,
        address || null,
        lat,
        lng,
        websiteUrl,
        cuisineType,
        selfService ? 1 : 0,
        waitMinutes,
        userId,
      ]
    );

    const placeId = `partner-${insert.insertId}`;
    await query("UPDATE partner_restaurants SET place_id = ? WHERE id = ?", [
      placeId,
      insert.insertId,
    ]);

    const restaurant = mapPartnerRow(await getOwned(userId));
    res.status(201).json({ ok: true, restaurant });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const row = await getOwned(req.user.id);
    if (!row) return res.json({ restaurant: null });
    res.json({ restaurant: mapPartnerRow(row) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/me", requireAuth, async (req, res) => {
  try {
    const row = await getOwned(req.user.id);
    if (!row) return res.status(404).json({ error: "Nenhum restaurante cadastrado." });

    const body = req.body || {};
    const name = body.name != null ? String(body.name).trim() : row.name;
    const address = body.address != null ? String(body.address).trim() : row.address;
    const lat = body.lat != null ? Number(body.lat) : Number(row.lat);
    const lng = body.lng != null ? Number(body.lng) : Number(row.lng);
    const websiteUrl =
      body.websiteUrl !== undefined ? normalizeHttpUrl(body.websiteUrl) : row.websiteUrl;
    const cuisineType =
      body.cuisineType != null ? String(body.cuisineType).trim() || "other" : row.cuisineType;
    const selfService =
      body.selfService != null ? Boolean(body.selfService) : Boolean(Number(row.selfService));
    const isPublished =
      body.isPublished != null ? Boolean(body.isPublished) : Boolean(Number(row.isPublished));

    if (!name || name.length < 2) {
      return res.status(400).json({ error: "Nome inválido." });
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "Coordenadas inválidas." });
    }

    await query(
      `UPDATE partner_restaurants SET
         name = ?, address = ?, lat = ?, lng = ?, website_url = ?,
         cuisine_type = ?, self_service = ?, is_published = ?
       WHERE owner_user_id = ?`,
      [
        name,
        address || null,
        lat,
        lng,
        websiteUrl,
        cuisineType,
        selfService ? 1 : 0,
        isPublished ? 1 : 0,
        req.user.id,
      ]
    );

    res.json({ restaurant: mapPartnerRow(await getOwned(req.user.id)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/me/wait", requireAuth, async (req, res) => {
  try {
    const row = await getOwned(req.user.id);
    if (!row) return res.status(404).json({ error: "Nenhum restaurante cadastrado." });

    let waitMinutes = Number(req.body?.waitMinutes);
    if (!Number.isFinite(waitMinutes)) {
      const level = String(req.body?.waitLevel || "");
      if (level === "low") waitMinutes = 6;
      else if (level === "mid") waitMinutes = 14;
      else if (level === "high") waitMinutes = 25;
      else return res.status(400).json({ error: "Informe waitMinutes ou waitLevel." });
    }
    waitMinutes = Math.min(90, Math.max(0, Math.round(waitMinutes)));

    await query(
      `UPDATE partner_restaurants SET wait_minutes = ?, wait_updated_at = NOW()
       WHERE owner_user_id = ?`,
      [waitMinutes, req.user.id]
    );

    res.json({ restaurant: mapPartnerRow(await getOwned(req.user.id)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/me/status", requireAuth, async (req, res) => {
  try {
    const row = await getOwned(req.user.id);
    if (!row) return res.status(404).json({ error: "Nenhum restaurante cadastrado." });

    const body = req.body || {};
    const isOpen = body.isOpen != null ? Boolean(body.isOpen) : Boolean(Number(row.isOpen ?? 1));

    let capacityTotal =
      body.capacityTotal !== undefined
        ? body.capacityTotal === "" || body.capacityTotal == null
          ? null
          : Number(body.capacityTotal)
        : row.capacityTotal != null
          ? Number(row.capacityTotal)
          : null;
    let capacityFree =
      body.capacityFree !== undefined
        ? body.capacityFree === "" || body.capacityFree == null
          ? null
          : Number(body.capacityFree)
        : row.capacityFree != null
          ? Number(row.capacityFree)
          : null;

    if (capacityTotal != null) {
      if (!Number.isFinite(capacityTotal) || capacityTotal < 0) {
        return res.status(400).json({ error: "Capacidade total inválida." });
      }
      capacityTotal = Math.min(999, Math.round(capacityTotal));
    }
    if (capacityFree != null) {
      if (!Number.isFinite(capacityFree) || capacityFree < 0) {
        return res.status(400).json({ error: "Lugares livres inválidos." });
      }
      capacityFree = Math.min(999, Math.round(capacityFree));
    }
    if (capacityTotal != null && capacityFree != null && capacityFree > capacityTotal) {
      capacityFree = capacityTotal;
    }

    await query(
      `UPDATE partner_restaurants SET
         is_open = ?, capacity_total = ?, capacity_free = ?
       WHERE owner_user_id = ?`,
      [isOpen ? 1 : 0, capacityTotal, capacityFree, req.user.id]
    );

    res.json({ restaurant: mapPartnerRow(await getOwned(req.user.id)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/me/menu/photo", requireAuth, async (req, res) => {
  try {
    const row = await getOwned(req.user.id);
    if (!row) return res.status(404).json({ error: "Nenhum restaurante cadastrado." });

    const dataUrl = String(req.body?.dataUrl || "");
    const match = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) {
      return res.status(400).json({ error: "Envie uma imagem JPEG, PNG ou WebP." });
    }

    const mime = match[1].toLowerCase().replace("image/jpg", "image/jpeg");
    const buffer = Buffer.from(match[2], "base64");
    if (!buffer.length || buffer.length > 2.5 * 1024 * 1024) {
      return res.status(400).json({ error: "Imagem muito grande (máx. ~2,5 MB)." });
    }

    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const filename = `${row.placeId.replace(/[^a-zA-Z0-9_-]/g, "_")}-${randomUUID()}.${ext}`;
    const imageUrl = await saveMenuPhoto({ buffer, mime, filename });

    res.json({ ok: true, imageUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/me/menu", requireAuth, async (req, res) => {
  try {
    const row = await getOwned(req.user.id);
    if (!row) return res.status(404).json({ error: "Nenhum restaurante cadastrado." });

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const normalized = items
      .map((item, index) => {
        if (typeof item === "string") {
          return {
            id: `i-${index}`,
            name: item,
            description: "",
            price: null,
            priceLabel: "Consulte",
            image: null,
          };
        }
        const price = Number(item.price);
        return {
          id: item.id || `i-${index}`,
          name: String(item.name || "Item").trim(),
          description: String(item.description || "").trim(),
          price: Number.isFinite(price) ? price : null,
          priceLabel:
            item.priceLabel ||
            (Number.isFinite(price) && price > 0
              ? price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "Consulte"),
          image: normalizeMenuImage(item.image),
        };
      })
      .filter((i) => i.name);

    const today = new Date().toISOString().slice(0, 10);
    await query(
      `INSERT INTO daily_menus (place_id, place_name, menu_date, items_json)
       VALUES (?, ?, ?, ?::jsonb)
       ON CONFLICT (place_id, menu_date) DO UPDATE SET
         place_name = EXCLUDED.place_name,
         items_json = EXCLUDED.items_json`,
      [row.placeId, row.name, today, JSON.stringify(normalized)]
    );

    res.json({
      ok: true,
      placeId: row.placeId,
      placeName: row.name,
      menuDate: today,
      items: normalized,
      source: "db",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/me/menu", requireAuth, async (req, res) => {
  try {
    const row = await getOwned(req.user.id);
    if (!row) return res.status(404).json({ error: "Nenhum restaurante cadastrado." });
    const today = new Date().toISOString().slice(0, 10);
    const rows = await query(
      `SELECT items_json AS items, menu_date AS menuDate FROM daily_menus
       WHERE place_id = ? AND menu_date = ? LIMIT 1`,
      [row.placeId, today]
    );
    if (!rows[0]) {
      return res.json({ placeId: row.placeId, menuDate: today, items: [], source: "empty" });
    }
    const items =
      typeof rows[0].items === "string" ? JSON.parse(rows[0].items) : rows[0].items;
    res.json({
      placeId: row.placeId,
      menuDate: rows[0].menuDate,
      items: items || [],
      source: "db",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/me/promo", requireAuth, async (req, res) => {
  try {
    const row = await getOwned(req.user.id);
    if (!row) return res.status(404).json({ error: "Nenhum restaurante cadastrado." });
    const body = req.body || {};
    const promoTitle =
      body.promoTitle != null ? String(body.promoTitle).trim().slice(0, 120) : row.promoTitle;
    const promoDescription =
      body.promoDescription != null
        ? String(body.promoDescription).trim().slice(0, 400)
        : row.promoDescription;
    let promoPrice =
      body.promoPrice !== undefined
        ? body.promoPrice === "" || body.promoPrice == null
          ? null
          : Number(body.promoPrice)
        : row.promoPrice != null
          ? Number(row.promoPrice)
          : null;
    if (promoPrice != null && (!Number.isFinite(promoPrice) || promoPrice < 0)) {
      return res.status(400).json({ error: "Preço da promoção inválido." });
    }
    if (promoPrice != null) promoPrice = Math.round(promoPrice * 100) / 100;
    const promoActive =
      body.promoActive != null ? Boolean(body.promoActive) : Boolean(Number(row.promoActive));

    await query(
      `UPDATE partner_restaurants SET
         promo_title = ?, promo_description = ?, promo_price = ?, promo_active = ?
       WHERE owner_user_id = ?`,
      [
        promoTitle || null,
        promoDescription || null,
        promoPrice,
        promoActive ? 1 : 0,
        req.user.id,
      ]
    );
    res.json({ restaurant: mapPartnerRow(await getOwned(req.user.id)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/me/hours", requireAuth, async (req, res) => {
  try {
    const row = await getOwned(req.user.id);
    if (!row) return res.status(404).json({ error: "Nenhum restaurante cadastrado." });
    const hours = normalizeHours(req.body?.hours);
    await query(`UPDATE partner_restaurants SET hours_json = ?::jsonb WHERE owner_user_id = ?`, [
      JSON.stringify(hours),
      req.user.id,
    ]);
    res.json({ restaurant: mapPartnerRow(await getOwned(req.user.id)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/me/reminder", requireAuth, async (req, res) => {
  try {
    const row = await getOwned(req.user.id);
    if (!row) return res.status(404).json({ error: "Nenhum restaurante cadastrado." });
    const reminderEnabled =
      req.body?.reminderEnabled != null
        ? Boolean(req.body.reminderEnabled)
        : Boolean(Number(row.reminderEnabled ?? 1));
    await query(`UPDATE partner_restaurants SET reminder_enabled = ? WHERE owner_user_id = ?`, [
      reminderEnabled ? 1 : 0,
      req.user.id,
    ]);
    res.json({ restaurant: mapPartnerRow(await getOwned(req.user.id)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/me/live", requireAuth, async (req, res) => {
  try {
    const row = await getOwned(req.user.id);
    if (!row) return res.status(404).json({ error: "Nenhum restaurante cadastrado." });
    const placeId = row.placeId;
    const [last15, last60, today] = await Promise.all([
      query(
        `SELECT COUNT(*) AS c FROM place_go_now
         WHERE place_id = ? AND created_at >= (NOW() - INTERVAL 15 MINUTE)`,
        [placeId]
      ),
      query(
        `SELECT COUNT(*) AS c FROM place_go_now
         WHERE place_id = ? AND created_at >= (NOW() - INTERVAL 60 MINUTE)`,
        [placeId]
      ),
      query(
        `SELECT COUNT(*) AS c FROM place_go_now
         WHERE place_id = ? AND created_at >= CURDATE()`,
        [placeId]
      ),
    ]);
    const recent = await query(
      `SELECT created_at AS createdAt
       FROM place_go_now
       WHERE place_id = ? AND created_at >= (NOW() - INTERVAL 60 MINUTE)
       ORDER BY created_at DESC
       LIMIT 20`,
      [placeId]
    );
    res.json({
      placeId,
      last15Min: Number(last15[0]?.c) || 0,
      last60Min: Number(last60[0]?.c) || 0,
      today: Number(today[0]?.c) || 0,
      recent: recent.map((r, i) => ({
        id: `g-${i}-${r.createdAt}`,
        label: "Cliente a caminho",
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/me/report/weekly", requireAuth, async (req, res) => {
  try {
    const row = await getOwned(req.user.id);
    if (!row) return res.status(404).json({ error: "Nenhum restaurante cadastrado." });
    const placeId = row.placeId;
    const mapped = mapPartnerRow(row);

    const [goNowWeek, goNowPrev, fbWeek, fbPrev, waitFb, goNowDaily, fbDaily, goNowHours] =
      await Promise.all([
        query(
          `SELECT COUNT(*) AS c FROM place_go_now
           WHERE place_id = ? AND created_at >= (NOW() - INTERVAL 7 DAY)`,
          [placeId]
        ),
        query(
          `SELECT COUNT(*) AS c FROM place_go_now
           WHERE place_id = ?
             AND created_at >= (NOW() - INTERVAL 14 DAY)
             AND created_at < (NOW() - INTERVAL 7 DAY)`,
          [placeId]
        ),
        query(
          `SELECT COUNT(*) AS c, ROUND(AVG(rating), 1) AS avgRating
           FROM place_feedback
           WHERE place_id = ? AND updated_at >= (NOW() - INTERVAL 7 DAY)`,
          [placeId]
        ),
        query(
          `SELECT COUNT(*) AS c
           FROM place_feedback
           WHERE place_id = ?
             AND updated_at >= (NOW() - INTERVAL 14 DAY)
             AND updated_at < (NOW() - INTERVAL 7 DAY)`,
          [placeId]
        ),
        query(
          `SELECT ROUND(AVG(wait_minutes), 0) AS avgWait
           FROM place_feedback
           WHERE place_id = ? AND wait_minutes IS NOT NULL
             AND updated_at >= (NOW() - INTERVAL 7 DAY)`,
          [placeId]
        ),
        query(
          `SELECT DATE(created_at) AS day, COUNT(*) AS c
           FROM place_go_now
           WHERE place_id = ? AND created_at >= (CURDATE() - INTERVAL 6 DAY)
           GROUP BY DATE(created_at)
           ORDER BY day`,
          [placeId]
        ),
        query(
          `SELECT DATE(updated_at) AS day, COUNT(*) AS c
           FROM place_feedback
           WHERE place_id = ? AND updated_at >= (CURDATE() - INTERVAL 6 DAY)
           GROUP BY DATE(updated_at)
           ORDER BY day`,
          [placeId]
        ),
        query(
          `SELECT HOUR(created_at) AS hour, COUNT(*) AS c
           FROM place_go_now
           WHERE place_id = ? AND created_at >= CURDATE()
             AND HOUR(created_at) BETWEEN 11 AND 14
           GROUP BY HOUR(created_at)
           ORDER BY hour`,
          [placeId]
        ),
      ]);

    const goNow = Number(goNowWeek[0]?.c) || 0;
    const goNowBefore = Number(goNowPrev[0]?.c) || 0;
    const feedbacks = Number(fbWeek[0]?.c) || 0;
    const feedbacksBefore = Number(fbPrev[0]?.c) || 0;

    const dayLabels = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
    const fillLast7Days = (rows) => {
      const map = new Map();
      for (const r of rows || []) {
        const key = String(r.day).slice(0, 10);
        map.set(key, Number(r.c) || 0);
      }
      const out = [];
      for (let i = 6; i >= 0; i -= 1) {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        out.push({
          label: dayLabels[d.getDay()],
          date: key,
          value: map.get(key) || 0,
        });
      }
      return out;
    };

    const hourMap = new Map(
      (goNowHours || []).map((r) => [Number(r.hour), Number(r.c) || 0])
    );
    // 6 barras no estilo da landing (11h–14h), com picos derivados da hora
    const byHourBars = [
      { label: "11h", value: hourMap.get(11) || 0 },
      { label: "", value: Math.round((hourMap.get(11) || 0) * 0.55) },
      { label: "12h", value: hourMap.get(12) || 0 },
      { label: "", value: Math.round((hourMap.get(12) || 0) * 0.7) },
      { label: "13h", value: hourMap.get(13) || 0 },
      { label: "14h", value: hourMap.get(14) || 0 },
    ];

    res.json({
      placeId,
      periodLabel: "Últimos 7 dias",
      generatedAt: new Date().toISOString(),
      goNowCount: goNow,
      goNowPrevCount: goNowBefore,
      goNowDelta: goNow - goNowBefore,
      feedbackCount: feedbacks,
      feedbackPrevCount: feedbacksBefore,
      feedbackDelta: feedbacks - feedbacksBefore,
      avgRating: fbWeek[0]?.avgRating != null ? Number(fbWeek[0].avgRating) : null,
      avgWaitReported:
        waitFb[0]?.avgWait != null ? Number(waitFb[0].avgWait) : null,
      currentWaitMinutes: mapped.waitMinutes,
      waitUpdatedAt: mapped.waitUpdatedAt,
      promoActive: mapped.promoActive,
      promoLabel: mapped.promoLabel,
      capacityLabel:
        mapped.capacityFree != null
          ? mapped.capacityTotal != null
            ? `${mapped.capacityFree}/${mapped.capacityTotal} livres`
            : `${mapped.capacityFree} livres`
          : null,
      isOpen: mapped.isOpen,
      hoursLabel: mapped.hoursLabel,
      charts: {
        goNowByDay: fillLast7Days(goNowDaily),
        feedbackByDay: fillLast7Days(fbDaily),
        goNowByHour: byHourBars,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/me/feedback", requireAuth, async (req, res) => {
  try {
    const row = await getOwned(req.user.id);
    if (!row) return res.status(404).json({ error: "Nenhum restaurante cadastrado." });

    const summary = await query(
      `SELECT COUNT(*) AS reviewCount, ROUND(AVG(rating), 1) AS avgRating
       FROM place_feedback WHERE place_id = ?`,
      [row.placeId]
    );
    const reviews = await query(
      `SELECT f.id, f.rating, f.wait_minutes AS waitMinutes, f.comment,
              f.created_at AS createdAt, f.updated_at AS updatedAt,
              u.name AS userName
       FROM place_feedback f
       JOIN users u ON u.id = f.user_id
       WHERE f.place_id = ?
       ORDER BY f.updated_at DESC
       LIMIT 100`,
      [row.placeId]
    );

    res.json({
      placeId: row.placeId,
      reviewCount: Number(summary[0]?.reviewCount) || 0,
      avgRating: summary[0]?.avgRating != null ? Number(summary[0].avgRating) : null,
      reviews,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Helpers usados pelo places service — export via function on module */
export function partnerToPlaceDto(row, userLat, userLng) {
  const mapped = mapPartnerRow(row);
  if (!mapped) return null;
  const distanceM = Math.round(
    haversineMeters(userLat, userLng, mapped.lat, mapped.lng)
  );
  const level = waitLevel(mapped.waitMinutes);
  const dest = `${mapped.lat},${mapped.lng}`;
  const destLabel = [mapped.name, mapped.address, dest].filter(Boolean).join(", ");
  const manualOpen = mapped.isOpen !== false;
  const scheduleOpen = mapped.scheduleOpen;
  const isOpen = manualOpen && (scheduleOpen == null ? true : scheduleOpen);
  return {
    id: mapped.placeId,
    name: mapped.name,
    address: mapped.address || "Endereço não informado",
    lat: mapped.lat,
    lng: mapped.lng,
    rating: null,
    priceLevel: 2,
    priceLabel: PRICE_LEVEL_LABELS[2],
    userRatingsTotal: null,
    openNow: isOpen,
    hoursLabel: mapped.hoursLabel,
    hours: mapped.hours,
    promoTitle: mapped.promoActive ? mapped.promoTitle : null,
    promoDescription: mapped.promoActive ? mapped.promoDescription : null,
    promoPrice: mapped.promoActive ? mapped.promoPrice : null,
    promoLabel: mapped.promoLabel,
    promoActive: mapped.promoActive,
    photoRef: null,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest)}`,
    directionsUrl: null,
    googleMapsDirUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destLabel)}&travelmode=walking`,
    wazeUrl: `https://waze.com/ul?ll=${encodeURIComponent(dest)}&navigate=yes&q=${encodeURIComponent(mapped.name)}`,
    websiteUrl: mapped.websiteUrl,
    mapsPlaceUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${mapped.name} ${dest}`)}`,
    menuInfoUrl:
      mapped.websiteUrl ||
      `https://www.google.com/search?q=${encodeURIComponent(`${mapped.name} cardápio`)}`,
    distanceM,
    distanceLabel: formatDistance(distanceM),
    walkLabel: formatWalk(distanceM),
    waitMinutes: isOpen ? mapped.waitMinutes : null,
    waitLevel: isOpen ? level.key : "closed",
    waitLabel: isOpen ? level.label : "Fechado",
    waitUpdatedAt: mapped.waitUpdatedAt,
    capacityTotal: mapped.capacityTotal,
    capacityFree: mapped.capacityFree,
    capacityLabel:
      mapped.capacityFree != null
        ? mapped.capacityTotal != null
          ? `${mapped.capacityFree} de ${mapped.capacityTotal} livres`
          : `~${mapped.capacityFree} livres`
        : null,
    selfService: mapped.selfService,
    cuisine: mapped.cuisineType,
    cuisineType: mapped.cuisineType,
    cuisineTypeLabel: mapped.cuisineTypeLabel,
    source: "partner",
    isPartner: true,
  };
}

export async function fetchPublishedPartners() {
  return query(
    `SELECT ${PARTNER_SELECT} FROM partner_restaurants WHERE is_published = 1`
  );
}

export { mapPartnerRow, getOwned, PARTNER_SELECT };

export default router;
