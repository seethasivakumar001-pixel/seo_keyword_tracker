import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Database from "better-sqlite3";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const dbType = (process.env.DB_TYPE || "").toLowerCase();
const dbUrl = process.env.DATABASE_URL || "";

let dbClient = null;
let currentDbType = "sqlite";

// Dynamic initialization for PostgreSQL, MySQL, or SQLite fallback
export async function getDb() {
  if (dbClient) return { client: dbClient, type: currentDbType };

  // 1. PostgreSQL connection
  if (dbType === "postgres" || dbType === "postgresql" || dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) {
    try {
      const pg = await import("pg");
      const { Pool } = pg.default || pg;
      const pool = new Pool(
        dbUrl
          ? { connectionString: dbUrl, ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false }
          : {
              host: process.env.PGHOST || "localhost",
              port: Number(process.env.PGPORT) || 5432,
              user: process.env.PGUSER || "postgres",
              password: process.env.PGPASSWORD || "",
              database: process.env.PGDATABASE || "seo_tracker",
              ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
            }
      );

      // Test connection
      await pool.query("SELECT NOW()");
      console.log(" Connected successfully to PostgreSQL database.");
      dbClient = pool;
      currentDbType = "postgres";
      await initPostgresSchema(pool);
      return { client: dbClient, type: currentDbType };
    } catch (err) {
      console.error("❌ Failed to connect to PostgreSQL:", err.message);
      console.log("⚠️ Falling back to local SQLite database...");
    }
  }

  // 2. MySQL connection
  if (dbType === "mysql" || dbUrl.startsWith("mysql://")) {
    try {
      const mysql = await import("mysql2/promise");
      const host = process.env.MYSQL_HOST || "localhost";
      const port = Number(process.env.MYSQL_PORT) || 3306;
      const user = process.env.MYSQL_USER || "root";
      const password = process.env.MYSQL_PASSWORD || "";
      const database = process.env.MYSQL_DATABASE || "seo_tracker";

      // 1. Ensure the database exists
      try {
        const rootConn = await mysql.createConnection(
          dbUrl ? dbUrl.replace(/\/[^/?]+(\?.*)?$/, "$1") : { host, port, user, password }
        );
        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await rootConn.end();
      } catch (dbCreateErr) {
        console.warn("Notice during DB check/creation:", dbCreateErr.message);
      }

      // 2. Create the connection pool
      const pool = dbUrl
        ? mysql.createPool(dbUrl)
        : mysql.createPool({
            host,
            port,
            user,
            password,
            database,
            waitForConnections: true,
            connectionLimit: 10,
          });

      // Test connection
      await pool.query("SELECT 1");
      console.log(` Connected successfully to MySQL database "${database}".`);
      dbClient = pool;
      currentDbType = "mysql";
      await initMysqlSchema(pool);
      return { client: dbClient, type: currentDbType };
    } catch (err) {
      console.error("❌ Failed to connect to MySQL:", err.message);
      console.log("⚠️ Falling back to local SQLite database...");
    }
  }


  // 3. SQLite Fallback (default)
  const sqliteDb = new Database(join(__dirname, "seo_tracker.sqlite"));
  sqliteDb.pragma("journal_mode = WAL");
  initSqliteSchema(sqliteDb);
  console.log(" Running on SQLite database (server/seo_tracker.sqlite).");
  dbClient = sqliteDb;
  currentDbType = "sqlite";
  return { client: dbClient, type: currentDbType };
}

import crypto from "crypto";

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, key] = storedHash.split(":");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return hash === key;
}

// -------------------------------------------------------------
// SCHEMA INITIALIZERS
// -------------------------------------------------------------

async function initPostgresSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      avatar VARCHAR(512),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      domain VARCHAR(255),
      deleted_at TIMESTAMPTZ,
      deleted_with VARCHAR(64),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      deleted_at TIMESTAMPTZ,
      deleted_with VARCHAR(64),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS keywords (
      id VARCHAR(64) PRIMARY KEY,
      project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      keyword VARCHAR(255) NOT NULL,
      group_name VARCHAR(255),
      url VARCHAR(512),
      volume INTEGER DEFAULT 0,
      difficulty INTEGER DEFAULT 0,
      history JSONB DEFAULT '[]',
      monthly JSONB DEFAULT '{}',
      deleted_at TIMESTAMPTZ,
      deleted_with VARCHAR(64),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Seed default admin user
  const defaultPwHash = hashPassword("password123");
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING`,
    ["usr_admin", "Admin User", "admin@seotracker.io", defaultPwHash]
  );
}

async function initMysqlSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      avatar VARCHAR(512) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      domain VARCHAR(255),
      deleted_at DATETIME NULL,
      deleted_with VARCHAR(64) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      project_id VARCHAR(64) NOT NULL,
      deleted_at DATETIME NULL,
      deleted_with VARCHAR(64) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS keywords (
      id VARCHAR(64) PRIMARY KEY,
      project_id VARCHAR(64) NOT NULL,
      keyword VARCHAR(255) NOT NULL,
      group_name VARCHAR(255),
      url VARCHAR(512),
      volume INT DEFAULT 0,
      difficulty INT DEFAULT 0,
      history JSON,
      monthly JSON,
      deleted_at DATETIME NULL,
      deleted_with VARCHAR(64) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Seed default admin user
  const defaultPwHash = hashPassword("password123");
  await pool.query(
    `INSERT IGNORE INTO users (id, name, email, password_hash)
     VALUES (?, ?, ?, ?)`,
    ["usr_admin", "Admin User", "admin@seotracker.io", defaultPwHash]
  );
}

function initSqliteSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT,
      deleted_at TEXT,
      deleted_with TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      project_id TEXT NOT NULL,
      deleted_at TEXT,
      deleted_with TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS keywords (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      group_name TEXT,
      url TEXT,
      volume INTEGER DEFAULT 0,
      difficulty INTEGER DEFAULT 0,
      history TEXT DEFAULT '[]',
      monthly TEXT DEFAULT '{}',
      deleted_at TEXT,
      deleted_with TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
  `);

  const defaultPwHash = hashPassword("password123");
  db.prepare(`
    INSERT OR IGNORE INTO users (id, name, email, password_hash)
    VALUES (?, ?, ?, ?)
  `).run("usr_admin", "Admin User", "admin@seotracker.io", defaultPwHash);
}
