import dotenv from "dotenv";
import app from "./app.js";
import { ensureSchema } from "./db/ensureSchema.js";

dotenv.config();

const port = Number(process.env.PORT || 3001);
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

async function start() {
  try {
    await ensureSchema();
  } catch (err) {
    console.error("[db] Subindo a API mesmo assim — /api/health vai falhar até o Postgres conectar.");
    console.error(err.message || err);
  }

  app.listen(port, () => {
    console.log(`FilaZero API em http://localhost:${port}`);
    console.log(`CORS liberado para ${frontendUrl}`);
  });
}

start();
