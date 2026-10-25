import { Router } from "express";
import { reverseGeocode } from "../services/geocode.js";

const router = Router();

function requireAuth(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ error: "Faça login." });
  }
  return next();
}

router.get("/reverse", requireAuth, async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "Informe lat e lng válidos." });
    }
    const place = await reverseGeocode(lat, lng);
    res.json({ place });
  } catch (err) {
    console.error("[geocode]", err.message);
    res.status(502).json({ error: "Não foi possível obter o endereço desse ponto." });
  }
});

export default router;
