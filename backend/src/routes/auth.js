import { Router } from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import { query } from "../config/db.js";

const router = Router();
const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:5173";
const USER_FIELDS =
  "id, google_id, email, name, avatar_url, COALESCE(role, 'diner') AS role, (password_hash IS NOT NULL AND password_hash <> '') AS has_password";
const SALT_ROUNDS = 10;

function requireAuth(req, res) {
  if (!req.isAuthenticated?.() || !req.user) {
    res.status(401).json({ error: "Faça login para continuar." });
    return null;
  }
  return req.user;
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar_url: row.avatar_url,
    google_id: row.google_id || null,
    has_password: Boolean(Number(row.has_password)),
    role: row.role || "diner",
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

router.get("/me", async (req, res, next) => {
  try {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ user: null });
    }
    const rows = await query(`SELECT ${USER_FIELDS} FROM users WHERE id = ? LIMIT 1`, [
      req.user.id,
    ]);
    const user = publicUser(rows[0] || req.user);
    if (user) {
      const partner = await query(
        `SELECT place_id AS placeId FROM partner_restaurants WHERE owner_user_id = ? LIMIT 1`,
        [user.id]
      );
      user.partnerPlaceId = partner[0]?.placeId || null;
      if (user.partnerPlaceId) user.role = "partner";
    }
    return res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.patch("/profile", async (req, res, next) => {
  try {
    const current = requireAuth(req, res);
    if (!current) return;

    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!name || name.length < 2) {
      return res.status(400).json({ error: "Informe seu nome (mín. 2 caracteres)." });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "E-mail inválido." });
    }

    const taken = await query(
      "SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1",
      [email, current.id]
    );
    if (taken[0]) {
      return res.status(409).json({ error: "Já existe uma conta com este e-mail." });
    }

    await query("UPDATE users SET name = ?, email = ? WHERE id = ?", [
      name,
      email,
      current.id,
    ]);

    const rows = await query(`SELECT ${USER_FIELDS} FROM users WHERE id = ? LIMIT 1`, [
      current.id,
    ]);
    const user = publicUser(rows[0]);
    req.login(user, (err) => {
      if (err) return next(err);
      return res.json({ user });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/password", async (req, res, next) => {
  try {
    const current = requireAuth(req, res);
    if (!current) return;

    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "A nova senha precisa ter pelo menos 6 caracteres." });
    }

    const rows = await query(
      "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
      [current.id]
    );
    const row = rows[0];
    if (!row) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const hasPassword = Boolean(row.password_hash);
    if (hasPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Informe a senha atual." });
      }
      const ok = await bcrypt.compare(currentPassword, row.password_hash);
      if (!ok) {
        return res.status(401).json({ error: "Senha atual incorreta." });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await query("UPDATE users SET password_hash = ? WHERE id = ?", [
      passwordHash,
      current.id,
    ]);

    const updated = await query(`SELECT ${USER_FIELDS} FROM users WHERE id = ? LIMIT 1`, [
      current.id,
    ]);
    return res.json({ ok: true, user: publicUser(updated[0]) });
  } catch (err) {
    next(err);
  }
});

function clearSessionCookie(res) {
  const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  res.clearCookie("connect.sid", {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
  });
}

router.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      clearSessionCookie(res);
      res.json({ ok: true });
    });
  });
});

router.delete("/account", async (req, res, next) => {
  try {
    const current = requireAuth(req, res);
    if (!current) return;

    const confirm = String(req.body.confirm || "").trim();
    const password = String(req.body.password || "");

    if (confirm.toUpperCase() !== "EXCLUIR") {
      return res.status(400).json({
        error: 'Digite EXCLUIR para confirmar a exclusão da conta.',
      });
    }

    const rows = await query(
      "SELECT id, password_hash FROM users WHERE id = ? LIMIT 1",
      [current.id]
    );
    const row = rows[0];
    if (!row) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    if (row.password_hash) {
      if (!password) {
        return res.status(400).json({ error: "Informe sua senha para excluir a conta." });
      }
      const ok = await bcrypt.compare(password, row.password_hash);
      if (!ok) {
        return res.status(401).json({ error: "Senha incorreta." });
      }
    }

    await query("DELETE FROM users WHERE id = ?", [current.id]);

    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(() => {
        clearSessionCookie(res);
        res.json({ ok: true });
      });
    });
  } catch (err) {
    next(err);
  }
});

export default router;
