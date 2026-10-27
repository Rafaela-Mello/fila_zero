import dotenv from "dotenv";
import { pingDb } from "../src/config/db.js";

dotenv.config();

try {
  const ok = await pingDb();
  console.log("ping ok:", ok);
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error("FAIL:", err.message);
  process.exit(1);
}
