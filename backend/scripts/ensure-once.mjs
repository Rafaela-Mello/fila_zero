import { ensureSchema } from "../src/db/ensureSchema.js";

ensureSchema()
  .then(() => {
    console.log("schema ok");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
