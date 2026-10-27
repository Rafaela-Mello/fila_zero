import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "filazero",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "filazero",
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

export async function pingDb() {
  const rows = await query("SELECT 1 AS ok");
  return rows[0]?.ok === 1;
}

export default getPool;
