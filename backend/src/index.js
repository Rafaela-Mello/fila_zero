import express from "express";
import session from "express-session";
import passport from "passport";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { configurePassport } from "./config/passport.js";
import { pingDb } from "./config/db.js";
import { ensureSchema } from "./db/ensureSchema.js";
import authRoutes from "./routes/auth.js";
import restaurantsRoutes from "./routes/restaurants.js";
import geoRoutes from "./routes/geo.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

configurePassport();

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-only-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.get("/api/health", async (_req, res) => {
  try {
    const dbOk = await pingDb();
    res.json({ ok: true, db: dbOk });
  } catch (err) {
    res.status(500).json({ ok: false, db: false, error: err.message });
  }
});

app.use("/auth", authRoutes);
app.use("/api/restaurants", restaurantsRoutes);
app.use("/api/geo", geoRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno" });
});

async function start() {
  try {
    await ensureSchema();
  } catch {
    console.error("[db] Subindo a API mesmo assim — /api/health vai falhar até o MySQL conectar.");
  }

  app.listen(port, () => {
    console.log(`FilaZero API em http://localhost:${port}`);
    console.log(`CORS liberado para ${frontendUrl}`);
  });
}

start();
