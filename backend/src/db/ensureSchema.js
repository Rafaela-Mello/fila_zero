import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function baseConfig() {
  return {
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "filazero",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "filazero",
  };
}

function candidateHosts() {
  const hosts = [];
  if (process.env.DB_HOST) hosts.push(process.env.DB_HOST);
  hosts.push("127.0.0.1", "localhost");
  try {
    const resolv = fs.readFileSync("/etc/resolv.conf", "utf8");
    const m = resolv.match(/nameserver\s+(\S+)/);
    if (m) hosts.push(m[1]);
  } catch {
    /* ignore */
  }
  try {
    const route = execSync("ip route show default", { encoding: "utf8" });
    const m = route.match(/via\s+(\S+)/);
    if (m) hosts.push(m[1]);
  } catch {
    /* ignore */
  }
  try {
    const out = execSync("ip -4 route", { encoding: "utf8" });
    for (const line of out.split("\n")) {
      const m = line.match(/^(\d+\.\d+\.\d+)\.0\//);
      if (m) hosts.push(`${m[1]}.1`);
    }
  } catch {
    /* ignore */
  }
  return [...new Set(hosts.filter(Boolean))];
}

async function connectWithFallback() {
  const cfg = baseConfig();
  const hosts = candidateHosts();
  const errors = [];

  for (const host of hosts) {
    try {
      const connection = await mysql.createConnection({
        host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        multipleStatements: true,
        connectTimeout: 4000,
      });
      if (host !== process.env.DB_HOST) {
        console.log(`[db] Conectou em ${host} (DB_HOST do .env era ${process.env.DB_HOST || "vazio"})`);
        try {
          const envPath = path.join(__dirname, "../../.env");
          if (fs.existsSync(envPath)) {
            let env = fs.readFileSync(envPath, "utf8");
            if (/^DB_HOST=/m.test(env)) {
              env = env.replace(/^DB_HOST=.*/m, `DB_HOST=${host}`);
            } else {
              env += `\nDB_HOST=${host}\n`;
            }
            fs.writeFileSync(envPath, env);
            console.log(`[db] DB_HOST atualizado no .env → ${host}`);
          }
        } catch {
          /* ignore */
        }
        process.env.DB_HOST = host;
      } else {
        console.log(`[db] Conectando em ${host}:${cfg.port} como ${cfg.user}...`);
      }
      return connection;
    } catch (err) {
      errors.push(`${host}: ${err.code || err.message}`);
    }
  }

  console.error("[db] Não conectou em nenhum host:");
  for (const e of errors) console.error(`  - ${e}`);
  if (errors.some((e) => e.includes("ER_ACCESS_DENIED"))) {
    console.error("[db] Do WSL não use DB_USER=root (só existe root@localhost).");
    console.error("[db] Use DB_USER=filazero e DB_PASSWORD=filazero123");
  }
  console.error("[db] Dicas: MySQL80 Running? usuário com host '%' ? Firewall porta 3306?");
  throw new Error(errors[errors.length - 1] || "Falha na conexão MySQL");
}

async function safeAlter(connection, sql) {
  try {
    await connection.query(sql);
  } catch (err) {
    // Ignora "duplicate column" / alterações já aplicadas
    if (err.errno === 1060 || err.errno === 1061) return;
    if (String(err.message).includes("Duplicate column")) return;
  }
}

/**
 * Conecta no MySQL, cria o banco e as tabelas se ainda não existirem.
 */
export async function ensureSchema() {
  const cfg = baseConfig();
  const connection = await connectWithFallback();
  const dbName = cfg.database.replace(/[^a-zA-Z0-9_]/g, "");

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${dbName}\``);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        google_id VARCHAR(64) NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NULL,
        name VARCHAR(255) NULL,
        avatar_url VARCHAR(512) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_users_google_id (google_id),
        UNIQUE KEY uq_users_email (email)
      ) ENGINE=InnoDB
    `);
    // Migra tabelas antigas (google_id era NOT NULL sem password_hash)
    await safeAlter(connection, "ALTER TABLE users MODIFY google_id VARCHAR(64) NULL");
    await safeAlter(connection, "ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL AFTER email");
    console.log(`[db] Banco '${dbName}' e tabelas OK (criados se não existiam).`);
  } finally {
    await connection.end();
  }
}
