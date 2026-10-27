import dotenv from "dotenv";
import { ensureSchema } from "./ensureSchema.js";

dotenv.config();

ensureSchema()
  .then(() => {
    console.log("Init OK.");
    process.exit(0);
  })
  .catch(() => process.exit(1));
