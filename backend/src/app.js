import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { configurePassport } from "./config/passport.js";
import { pingDb, getPool } from "./config/db.js";
import { ensureSchema } from "./db/ensureSchema.js";
import authRoutes from "./routes/auth.js";
import restaurantsRoutes from "./routes/restaurants.js";
import geoRoutes from "./routes/geo.js";
import userDataRoutes from "./routes/userData.js";
import chatRoutes from "./routes/chat.js";
import menusRoutes from "./routes/menus.js";
import placesRoutes from "./routes/places.js";
import partnersRoutes from "./routes/partners.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../uploads");

const app = express();
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
const PgSession = connectPgSimple(session);

let schemaReady;
async function bootSchema() {
  if (!schemaReady) {
    schemaReady = ensureSchema().catch((err) => {
      console.error("[db] ensureSchema falhou:", err.message || err);
      schemaReady = null;
    });
  }
  return schemaReady;
}

configurePassport();

app.set("trust proxy", 1);

app.use(async (_req, _res, next) => {
  await bootSchema();
  next();
});

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: "6mb" }));
app.use("/uploads", express.static(uploadsDir));
app.use(cookieParser());
app.use(
  session({
    store: new PgSession({
      pool: getPool(),
      tableName: "session",
      createTableIfMissing: true,
    }),
    name: "filazero.sid",
    secret: process.env.SESSION_SECRET || "dev-only-change-me",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      // Front faz proxy same-origin na Vercel → lax; none só se COOKIE_SAMESITE=none (API em outro domínio direto)
      sameSite: process.env.COOKIE_SAMESITE === "none" ? "none" : "lax",
      secure: isProd,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.get("/api/health", async (_req, res) => {
  try {
    const dbOk = await pingDb();
    res.json({
      ok: true,
      db: dbOk,
      engine: "postgres",
      frontendUrl,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      db: false,
      engine: "postgres",
      error: err.message,
    });
  }
});

app.use("/auth", authRoutes);
app.use("/api/restaurants", restaurantsRoutes);
app.use("/api/geo", geoRoutes);
app.use("/api/me", userDataRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/menus", menusRoutes);
app.use("/api/places", placesRoutes);
app.use("/api/partners", partnersRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno" });
});

export default app;
