import dotenv from "dotenv";
import app from "../src/app.js";
import { ensureSchema } from "../src/db/ensureSchema.js";

dotenv.config();

let ready;

async function ensureReady() {
  if (!ready) {
    ready = ensureSchema().catch((err) => {
      console.error("[db] ensureSchema falhou:", err.message || err);
      ready = null;
      throw err;
    });
  }
  return ready;
}

export default async function handler(req, res) {
  try {
    await ensureReady();
  } catch {
    // health ainda responde o erro de DB
  }
  return app(req, res);
}
