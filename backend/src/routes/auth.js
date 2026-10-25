import { Router } from "express";
import bcrypt from "bcrypt";
import passport from "passport";
import { query } from "../config/db.js";

const router = Router();
const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:5173";
const USER_FIELDS = "id, google_id, email, name, avatar_url";
const SALT_ROUNDS = 10;

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar_url: row.avatar_url,
    google_id: row.google_id,
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post("/register", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || name.length < 2) {
      return res.status(400).json({ error: "Informe seu nome (mín. 2 caracteres)." });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "E-mail inválido." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "A senha precisa ter pelo menos 6 caracteres." });
    }

    const existing = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (existing[0]) {
      return res.status(409).json({ error: "Já existe uma conta com este e-mail. Faça login." });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await query(
      "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
      [email, passwordHash, name]
    );

    const rows = await query(`SELECT ${USER_FIELDS} FROM users WHERE id = ? LIMIT 1`, [
      result.insertId,
    ]);
    const user = publicUser(rows[0]);

    req.login(user, (err) => {
      if (err) return next(err);
      return res.status(201).json({ user });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: "Informe e-mail e senha." });
    }

    const rows = await query(
      `SELECT ${USER_FIELDS}, password_hash FROM users WHERE email = ? LIMIT 1`,
      [email]
    );
    const row = rows[0];

    if (!row || !row.password_hash) {
      return res.status(401).json({
        error: row?.google_id
          ? "Esta conta foi criada com Google. Use 'Entrar com Google' ou defina uma senha no cadastro com outro e-mail."
          : "E-mail ou senha incorretos.",
      });
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    const user = publicUser(row);
    req.login(user, (err) => {
      if (err) return next(err);
      return res.json({ user });
    });
  } catch (err) {
    next(err);
  }
});

router.get("/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${frontendUrl()}/login?error=google_not_configured`);
  }
  return passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })(req, res, next);
});

router.get(
  "/google/callback",
  (req, res, next) => {
    passport.authenticate("google", {
      failureRedirect: `${frontendUrl()}/login?error=google_failed`,
      session: true,
    })(req, res, next);
  },
  (_req, res) => {
    res.redirect(`${frontendUrl()}/app`);
  }
);

router.get("/me", (req, res) => {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ user: null });
  }
  return res.json({ user: publicUser(req.user) });
});

router.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });
});

export default router;
