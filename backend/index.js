import dotenv from "dotenv";
import app from "./src/app.js";

dotenv.config();

const isVercel = Boolean(process.env.VERCEL);

if (!isVercel) {
  const port = Number(process.env.PORT || 3001);
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  app.listen(port, () => {
    console.log(`FilaZero API em http://localhost:${port}`);
    console.log(`CORS liberado para ${frontendUrl}`);
  });
}

export default app;
