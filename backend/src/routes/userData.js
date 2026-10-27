import { Router } from "express";
import { query } from "../config/db.js";

const router = Router();

function requireAuth(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ error: "Faça login." });
  }
  return next();
}

router.use(requireAuth);

/* ---------- Favoritos ---------- */
router.get("/favorites", async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, place_id AS placeId, place_name AS placeName, place_address AS placeAddress,
              lat, lng, created_at AS createdAt
       FROM favorites WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ favorites: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/favorites", async (req, res) => {
  try {
    const { placeId, placeName, placeAddress, lat, lng } = req.body || {};
    if (!placeId || !placeName) {
      return res.status(400).json({ error: "Informe placeId e placeName." });
    }
    await query(
      `INSERT INTO favorites (user_id, place_id, place_name, place_address, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, place_id) DO UPDATE SET
         place_name = EXCLUDED.place_name,
         place_address = EXCLUDED.place_address,
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng`,
      [req.user.id, placeId, placeName, placeAddress || null, lat ?? null, lng ?? null]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/favorites/:placeId", async (req, res) => {
  try {
    await query(`DELETE FROM favorites WHERE user_id = ? AND place_id = ?`, [
      req.user.id,
      req.params.placeId,
    ]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------- Histórico ---------- */
router.get("/history", async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, place_id AS placeId, place_name AS placeName, place_address AS placeAddress,
              lat, lng, note, visited_at AS visitedAt
       FROM visit_history WHERE user_id = ? ORDER BY visited_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ history: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/history", async (req, res) => {
  try {
    const { placeId, placeName, placeAddress, lat, lng, note } = req.body || {};
    if (!placeId || !placeName) {
      return res.status(400).json({ error: "Informe placeId e placeName." });
    }
    await query(
      `INSERT INTO visit_history (user_id, place_id, place_name, place_address, lat, lng, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, placeId, placeName, placeAddress || null, lat ?? null, lng ?? null, note || null]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
