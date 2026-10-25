import { Router } from "express";
import { searchNearbyRestaurants } from "../services/places.js";
import { reverseGeocode } from "../services/geocode.js";

const router = Router();

function requireAuth(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ error: "Faça login para consultar restaurantes." });
  }
  return next();
}

router.get("/nearby", requireAuth, async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "Informe lat e lng válidos." });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: "Coordenadas fora do intervalo." });
    }

    const radius = Math.min(Math.max(Number(req.query.radius) || 1500, 200), 5000);
    const selfService =
      req.query.selfService === "1" ||
      req.query.selfService === "true" ||
      req.query.selfService === "yes";
    const maxDistanceM = req.query.maxDistance != null ? Number(req.query.maxDistance) : null;
    const maxWait = req.query.maxWait != null ? Number(req.query.maxWait) : null;
    const minRating = req.query.minRating != null ? Number(req.query.minRating) : null;

    const [result, place] = await Promise.all([
      searchNearbyRestaurants({
        lat,
        lng,
        radius,
        selfService,
        maxDistanceM: Number.isFinite(maxDistanceM) ? maxDistanceM : null,
        maxWait: Number.isFinite(maxWait) ? maxWait : null,
        minRating: Number.isFinite(minRating) ? minRating : null,
      }),
      reverseGeocode(lat, lng).catch(() => null),
    ]);

    res.json({
      ...result,
      place,
      waitNote:
        "Mapa e locais: OpenStreetMap (grátis). Tempo de espera é estimativa do FilaZero até os restaurantes parceiros atualizarem em tempo real.",
    });
  } catch (err) {
    console.error("[places]", err.message);
    res.status(500).json({
      error: err.message || "Falha ao buscar restaurantes",
    });
  }
});

export default router;
