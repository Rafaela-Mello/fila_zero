import dotenv from "dotenv";
import app from "../src/app.js";
import { ensureSchema } from "../src/db/ensureSchema.js";

dotenv.config();

let ready;
let schemaAttempted = false;

async function ensureReady() {
  if (schemaAttempted) return ready;
  schemaAttempted = true;
  ready = ensureSchema()
    .then(() => true)
    .catch((err) => {
      console.error("[db] ensureSchema falhou:", err.message || err);
      return false;
    });
  return ready;
}

export default async function handler(req, res) {
  await ensureReady();
  return app(req, res);
}
