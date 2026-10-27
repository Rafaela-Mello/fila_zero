import { Router } from "express";
import { askAssistant, getAssistantStatus } from "../services/ollama.js";

const router = Router();

function requireAuth(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ error: "Faça login." });
  }
  return next();
}

router.get("/status", requireAuth, (_req, res) => {
  res.json(getAssistantStatus());
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { message, restaurants } = req.body || {};
    const result = await askAssistant({ message, restaurants });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Falha no assistente" });
  }
});

export default router;
