import { Router } from "express";
import { query } from "../config/db.js";

const router = Router();

function requireAuth(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ error: "Faça login." });
  }
  return next();
}

function clampRating(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.min(5, Math.max(1, Math.round(v)));
}

async function loadSummary(placeId) {
  const rows = await query(
    `SELECT
       COUNT(*) AS reviewCount,
       ROUND(AVG(rating), 1) AS avgRating,
       MAX(place_name) AS placeName,
       MAX(place_address) AS placeAddress,
       MAX(lat) AS lat,
       MAX(lng) AS lng
     FROM place_feedback
     WHERE place_id = ?`,
    [placeId]
  );
  const row = rows[0] || {};
  return {
    placeId,
    placeName: row.placeName || null,
    placeAddress: row.placeAddress || null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    reviewCount: Number(row.reviewCount) || 0,
    avgRating: row.avgRating != null ? Number(row.avgRating) : null,
  };
}

async function loadReviews(placeId, limit = 50) {
  return query(
    `SELECT
       f.id,
       f.rating,
       f.wait_minutes AS waitMinutes,
       f.comment,
       f.created_at AS createdAt,
       f.updated_at AS updatedAt,
       u.name AS userName,
       u.avatar_url AS avatarUrl
     FROM place_feedback f
     JOIN users u ON u.id = f.user_id
     WHERE f.place_id = ?
     ORDER BY f.updated_at DESC
     LIMIT ?`,
    [placeId, limit]
  );
}

/** Página do restaurante: resumo + feedbacks (público). */
router.get("/:placeId", async (req, res) => {
  try {
    const placeId = decodeURIComponent(req.params.placeId);
    const summary = await loadSummary(placeId);
    const reviews = await loadReviews(placeId);
    let mine = null;
    if (req.isAuthenticated?.() && req.user) {
      const mineRows = await query(
        `SELECT id, rating, wait_minutes AS waitMinutes, comment, updated_at AS updatedAt
         FROM place_feedback WHERE user_id = ? AND place_id = ? LIMIT 1`,
        [req.user.id, placeId]
      );
      mine = mineRows[0] || null;
    }

    let partner = null;
    const partnerRows = await query(
      `SELECT place_id AS placeId, name AS placeName, address AS placeAddress,
              lat, lng, website_url AS websiteUrl, wait_minutes AS waitMinutes,
              wait_updated_at AS waitUpdatedAt, cuisine_type AS cuisineType,
              self_service AS selfService
       FROM partner_restaurants WHERE place_id = ? AND is_published = 1 LIMIT 1`,
      [placeId]
    );
    if (partnerRows[0]) {
      partner = partnerRows[0];
      if (!summary.placeName) summary.placeName = partner.placeName;
      if (!summary.placeAddress) summary.placeAddress = partner.placeAddress;
      if (summary.lat == null) summary.lat = partner.lat;
      if (summary.lng == null) summary.lng = partner.lng;
    }

    res.json({ ...summary, reviews, mine, partner });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Lista só de feedbacks (público). */
router.get("/:placeId/feedback", async (req, res) => {
  try {
    const placeId = decodeURIComponent(req.params.placeId);
    const summary = await loadSummary(placeId);
    const reviews = await loadReviews(placeId);
    res.json({ ...summary, reviews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Cliente tocou em “Vou agora” — contagem anônima para o parceiro. */
router.post("/:placeId/go-now", requireAuth, async (req, res) => {
  try {
    const placeId = decodeURIComponent(req.params.placeId);
    if (!placeId || placeId.length > 128) {
      return res.status(400).json({ error: "Lugar inválido." });
    }

    const partners = await query(
      `SELECT place_id AS placeId FROM partner_restaurants
       WHERE place_id = ? AND is_published = 1 LIMIT 1`,
      [placeId]
    );
    if (!partners[0]) {
      return res.json({ ok: true, tracked: false });
    }

    // Evita spam: no máximo 1 registro do mesmo usuário no mesmo lugar a cada 10 min
    const recent = await query(
      `SELECT id FROM place_go_now
       WHERE place_id = ? AND user_id = ?
         AND created_at >= (NOW() - INTERVAL 10 MINUTE)
       LIMIT 1`,
      [placeId, req.user.id]
    );
    if (!recent[0]) {
      await query(`INSERT INTO place_go_now (place_id, user_id) VALUES (?, ?)`, [
        placeId,
        req.user.id,
      ]);
    }

    res.json({ ok: true, tracked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Enviar / atualizar feedback (1 por usuário por lugar). */
router.post("/:placeId/feedback", requireAuth, async (req, res) => {
  try {
    const placeId = decodeURIComponent(req.params.placeId);
    const { placeName, placeAddress, lat, lng, rating, waitMinutes, comment } = req.body || {};
    const stars = clampRating(rating);
    if (!stars) {
      return res.status(400).json({ error: "Informe uma nota de 1 a 5." });
    }
    if (!placeName || String(placeName).trim().length < 2) {
      return res.status(400).json({ error: "Informe o nome do lugar." });
    }

    let wait = null;
    if (waitMinutes !== undefined && waitMinutes !== null && waitMinutes !== "") {
      const w = Number(waitMinutes);
      if (!Number.isFinite(w) || w < 0 || w > 180) {
        return res.status(400).json({ error: "Espera inválida (0–180 min)." });
      }
      wait = Math.round(w);
    }

    const text = String(comment || "").trim().slice(0, 800) || null;

    await query(
      `INSERT INTO place_feedback
         (user_id, place_id, place_name, place_address, lat, lng, rating, wait_minutes, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         place_name = VALUES(place_name),
         place_address = VALUES(place_address),
         lat = VALUES(lat),
         lng = VALUES(lng),
         rating = VALUES(rating),
         wait_minutes = VALUES(wait_minutes),
         comment = VALUES(comment)`,
      [
        req.user.id,
        placeId,
        String(placeName).trim().slice(0, 255),
        placeAddress ? String(placeAddress).trim().slice(0, 512) : null,
        lat ?? null,
        lng ?? null,
        stars,
        wait,
        text,
      ]
    );

    const summary = await loadSummary(placeId);
    const reviews = await loadReviews(placeId);
    const mineRows = await query(
      `SELECT id, rating, wait_minutes AS waitMinutes, comment, updated_at AS updatedAt
       FROM place_feedback WHERE user_id = ? AND place_id = ? LIMIT 1`,
      [req.user.id, placeId]
    );

    res.json({ ok: true, ...summary, reviews, mine: mineRows[0] || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
