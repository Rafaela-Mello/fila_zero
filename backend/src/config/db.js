import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

let pool;

/** Converte `?` do estilo MySQL para `$1, $2, ...` do Postgres. */
function toPgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/**
 * Ajustes leves de dialeto MySQL → Postgres (intervalos, datas, etc.).
 * ON DUPLICATE KEY / VALUES() precisam ser reescritos nas rotas.
 */
function adaptMysqlDialect(sql) {
  return sql
    .replace(/INTERVAL\s+(\d+)\s+MINUTE/gi, "INTERVAL '$1 minutes'")
    .replace(/INTERVAL\s+(\d+)\s+DAY/gi, "INTERVAL '$1 days'")
    .replace(/INTERVAL\s+(\d+)\s+HOUR/gi, "INTERVAL '$1 hours'")
    .replace(/\bCURDATE\(\)/gi, "CURRENT_DATE")
    .replace(/\bHOUR\(([^)]+)\)/gi, "EXTRACT(HOUR FROM $1)::int")
    .replace(/\bDATE\(([^)]+)\)/gi, "($1)::date");
}

/**
 * Postgres/node-pg devolve aliases sem aspas em minúsculo (placeName → placename).
 * Aspas preservam camelCase usado pelo frontend.
 */
function quoteCamelCaseAliases(sql) {
  return sql.replace(/\bAS\s+([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)\b/g, 'AS "$1"');
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  // Fallback legado (MySQL env) — só ajuda se alguém colar URI Postgres em DB_HOST por engano
  const host = process.env.DB_HOST;
  if (host && host.startsWith("postgres")) return host;

  return null;
}

export function getPool() {
  if (!pool) {
    const connectionString = databaseUrl();
    if (!connectionString) {
      throw new Error(
        "Defina DATABASE_URL no .env (Supabase → Project Settings → Database → URI)."
      );
    }
    try {
      const host = new URL(connectionString).host;
      console.log(`[db] Postgres pool → ${host}`);
    } catch {
      console.log("[db] Postgres pool → (DATABASE_URL inválida)");
    }
    pool = new Pool({
      connectionString,
      ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
      // Serverless: poucas conexões por instância (Supabase free estoura fácil)
      max: Number(process.env.DB_POOL_MAX || 2),
      connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
      idleTimeoutMillis: 10000,
    });
  }
  return pool;
}

/**
 * Executa SQL. Mantém API parecida com mysql2:
 * - SELECT → array de rows
 * - INSERT com id → rows + `.insertId`
 */
export async function query(sql, params = []) {
  let text = quoteCamelCaseAliases(adaptMysqlDialect(toPgPlaceholders(sql)));
  const isInsert = /^\s*INSERT\s+/i.test(text);
  if (isInsert && !/\bRETURNING\b/i.test(text)) {
    text = `${text.replace(/;?\s*$/, "")} RETURNING id`;
  }

  const result = await getPool().query(text, params);

  if (isInsert) {
    const insertId = result.rows[0]?.id ?? 0;
    return Object.assign(result.rows, {
      insertId,
      affectedRows: result.rowCount,
    });
  }

  if (result.command === "UPDATE" || result.command === "DELETE") {
    return Object.assign(result.rows, {
      affectedRows: result.rowCount,
      insertId: 0,
    });
  }

  return result.rows;
}

export async function pingDb() {
  const rows = await query("SELECT 1 AS ok");
  return Number(rows[0]?.ok) === 1;
}

export default getPool;
