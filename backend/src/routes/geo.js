import { Router } from "express";
import { lookupCep, reverseGeocode } from "../services/geocode.js";

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

/** Público — cadastro de restaurante por CEP (ViaCEP + Nominatim). */
router.get("/cep", async (req, res) => {
  try {
    const place = await lookupCep(req.query.cep);
    res.json({ place });
  } catch (err) {
    console.error("[cep]", err.message);
    const status = err.status || 502;
    res.status(status).json({
      error: err.message || "Não foi possível consultar esse CEP.",
    });
  }
});

export default router;
