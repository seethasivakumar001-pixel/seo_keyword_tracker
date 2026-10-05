import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getDb, hashPassword, verifyPassword } from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Helper to normalize rows from PG/MySQL/SQLite
function formatUserRow(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatar: u.avatar || null,
    createdAt: u.created_at || u.createdAt || null,
  };
}

function formatKeywordRow(k) {
  return {
    id: k.id,
    projectId: k.project_id || k.projectId,
    keyword: k.keyword,
    group: k.group_name || k.group || "General",
    url: k.url || "",
    volume: Number(k.volume) || 0,
    difficulty: Number(k.difficulty) || 0,
    history: typeof k.history === "string" ? JSON.parse(k.history || "[]") : k.history || [],
    monthly: typeof k.monthly === "string" ? JSON.parse(k.monthly || "{}") : k.monthly || {},
    deletedAt: k.deleted_at || k.deletedAt || null,
    deletedWith: k.deleted_with || k.deletedWith || null,
  };
}

function formatProjectRow(p) {
  return {
    id: p.id,
    name: p.name,
    domain: p.domain || "",
    deletedAt: p.deleted_at || p.deletedAt || null,
    deletedWith: p.deleted_with || p.deletedWith || null,
  };
}

function formatCategoryRow(c) {
  return {
    id: c.id,
    name: c.name,
    projectId: c.project_id || c.projectId,
    deletedAt: c.deleted_at || c.deletedAt || null,
    deletedWith: c.deleted_with || c.deletedWith || null,
  };
}

// Health check
app.get("/api/health", async (req, res) => {
  try {
    const { type } = await getDb();
    res.json({ status: "ok", database: type });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// -------------------------------------------------------------
// AUTHENTICATION ENDPOINTS
// -------------------------------------------------------------

// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const { client, type } = await getDb();

    // Check if user already exists
    let existing = null;
    if (type === "postgres") {
      const r = await client.query("SELECT * FROM users WHERE LOWER(email) = $1", [cleanEmail]);
      existing = r.rows[0];
    } else if (type === "mysql") {
      const [rows] = await client.query("SELECT * FROM users WHERE LOWER(email) = ?", [cleanEmail]);
      existing = rows[0];
    } else {
      existing = client.prepare("SELECT * FROM users WHERE LOWER(email) = ?").get(cleanEmail);
    }

    if (existing) {
      return res.status(400).json({ error: "An account with this email address already exists." });
    }

    const id = "usr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const passwordHash = hashPassword(password);
    const avatar = null;

    if (type === "postgres") {
      await client.query(
        "INSERT INTO users (id, name, email, password_hash, avatar) VALUES ($1, $2, $3, $4, $5)",
        [id, cleanName, cleanEmail, passwordHash, avatar]
      );
    } else if (type === "mysql") {
      await client.query(
        "INSERT INTO users (id, name, email, password_hash, avatar) VALUES (?, ?, ?, ?, ?)",
        [id, cleanName, cleanEmail, passwordHash, avatar]
      );
    } else {
      client.prepare(
        "INSERT INTO users (id, name, email, password_hash, avatar) VALUES (?, ?, ?, ?, ?)"
      ).run(id, cleanName, cleanEmail, passwordHash, avatar);
    }

    const user = { id, name: cleanName, email: cleanEmail, avatar, createdAt: new Date().toISOString() };
    const token = "token_" + Buffer.from(`${id}:${cleanEmail}:${Date.now()}`).toString("base64");

    res.status(201).json({ success: true, user, token });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const { client, type } = await getDb();

    let userRow = null;
    if (type === "postgres") {
      const r = await client.query("SELECT * FROM users WHERE LOWER(email) = $1", [cleanEmail]);
      userRow = r.rows[0];
    } else if (type === "mysql") {
      const [rows] = await client.query("SELECT * FROM users WHERE LOWER(email) = ?", [cleanEmail]);
      userRow = rows[0];
    } else {
      userRow = client.prepare("SELECT * FROM users WHERE LOWER(email) = ?").get(cleanEmail);
    }

    if (!userRow) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const isMatch = verifyPassword(password, userRow.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = formatUserRow(userRow);
    const token = "token_" + Buffer.from(`${user.id}:${user.email}:${Date.now()}`).toString("base64");

    res.json({ success: true, user, token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
app.get("/api/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

    if (!token || !token.startsWith("token_")) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const raw = Buffer.from(token.replace("token_", ""), "base64").toString("utf-8");
    const [userId] = raw.split(":");

    const { client, type } = await getDb();
    let userRow = null;
    if (type === "postgres") {
      const r = await client.query("SELECT * FROM users WHERE id = $1", [userId]);
      userRow = r.rows[0];
    } else if (type === "mysql") {
      const [rows] = await client.query("SELECT * FROM users WHERE id = ?", [userId]);
      userRow = rows[0];
    } else {
      userRow = client.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    }

    if (!userRow) {
      return res.status(401).json({ error: "User session expired or not found." });
    }

    res.json({ success: true, user: formatUserRow(userRow) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
app.post("/api/auth/logout", (req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
});

// GET /api/data - Fetch all data
app.get("/api/data", async (req, res) => {
  try {
    const { client, type } = await getDb();

    let rawProjects = [], rawCategories = [], rawKeywords = [];

    if (type === "postgres") {
      const pRes = await client.query("SELECT * FROM projects ORDER BY created_at ASC");
      const cRes = await client.query("SELECT * FROM categories ORDER BY created_at ASC");
      const kRes = await client.query("SELECT * FROM keywords ORDER BY created_at DESC");
      rawProjects = pRes.rows;
      rawCategories = cRes.rows;
      rawKeywords = kRes.rows;
    } else if (type === "mysql") {
      const [pRows] = await client.query("SELECT * FROM projects ORDER BY created_at ASC");
      const [cRows] = await client.query("SELECT * FROM categories ORDER BY created_at ASC");
      const [kRows] = await client.query("SELECT * FROM keywords ORDER BY created_at DESC");
      rawProjects = pRows;
      rawCategories = cRows;
      rawKeywords = kRows;
    } else {
      rawProjects = client.prepare("SELECT * FROM projects").all();
      rawCategories = client.prepare("SELECT * FROM categories").all();
      rawKeywords = client.prepare("SELECT * FROM keywords").all();
    }

    res.json({
      projects: rawProjects.map(formatProjectRow),
      categories: rawCategories.map(formatCategoryRow),
      keywords: rawKeywords.map(formatKeywordRow),
      dbType: type,
    });
  } catch (err) {
    console.error("Error in GET /api/data:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sync - Batch initial seeding / sync
app.post("/api/sync", async (req, res) => {
  try {
    const { projects = [], categories = [], keywords = [] } = req.body;
    const { client, type } = await getDb();

    if (type === "postgres") {
      for (const p of projects) {
        await client.query(
          `INSERT INTO projects (id, name, domain, deleted_at, deleted_with)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET name = $2, domain = $3, deleted_at = $4, deleted_with = $5`,
          [p.id, p.name, p.domain, p.deletedAt, p.deletedWith]
        );
      }
      for (const c of categories) {
        await client.query(
          `INSERT INTO categories (id, name, project_id, deleted_at, deleted_with)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET name = $2, project_id = $3, deleted_at = $4, deleted_with = $5`,
          [c.id, c.name, c.projectId, c.deletedAt, c.deletedWith]
        );
      }
      for (const k of keywords) {
        await client.query(
          `INSERT INTO keywords (id, project_id, keyword, group_name, url, volume, difficulty, history, monthly, deleted_at, deleted_with)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE SET
             project_id = $2, keyword = $3, group_name = $4, url = $5, volume = $6, difficulty = $7,
             history = $8, monthly = $9, deleted_at = $10, deleted_with = $11`,
          [
            String(k.id),
            k.projectId,
            k.keyword,
            k.group,
            k.url,
            k.volume || 0,
            k.difficulty || 0,
            JSON.stringify(k.history || []),
            JSON.stringify(k.monthly || {}),
            k.deletedAt,
            k.deletedWith,
          ]
        );
      }
    } else if (type === "mysql") {
      for (const p of projects) {
        await client.query(
          `INSERT INTO projects (id, name, domain, deleted_at, deleted_with)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), domain = VALUES(domain), deleted_at = VALUES(deleted_at), deleted_with = VALUES(deleted_with)`,
          [p.id, p.name, p.domain, p.deletedAt, p.deletedWith]
        );
      }
      for (const c of categories) {
        await client.query(
          `INSERT INTO categories (id, name, project_id, deleted_at, deleted_with)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), project_id = VALUES(project_id), deleted_at = VALUES(deleted_at), deleted_with = VALUES(deleted_with)`,
          [c.id, c.name, c.projectId, c.deletedAt, c.deletedWith]
        );
      }
      for (const k of keywords) {
        await client.query(
          `INSERT INTO keywords (id, project_id, keyword, group_name, url, volume, difficulty, history, monthly, deleted_at, deleted_with)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             project_id = VALUES(project_id), keyword = VALUES(keyword), group_name = VALUES(group_name),
             url = VALUES(url), volume = VALUES(volume), difficulty = VALUES(difficulty),
             history = VALUES(history), monthly = VALUES(monthly), deleted_at = VALUES(deleted_at), deleted_with = VALUES(deleted_with)`,
          [
            String(k.id),
            k.projectId,
            k.keyword,
            k.group,
            k.url,
            k.volume || 0,
            k.difficulty || 0,
            JSON.stringify(k.history || []),
            JSON.stringify(k.monthly || {}),
            k.deletedAt,
            k.deletedWith,
          ]
        );
      }
    } else {
      const insertProj = client.prepare(`
        INSERT OR REPLACE INTO projects (id, name, domain, deleted_at, deleted_with)
        VALUES (?, ?, ?, ?, ?)
      `);
      const insertCat = client.prepare(`
        INSERT OR REPLACE INTO categories (id, name, project_id, deleted_at, deleted_with)
        VALUES (?, ?, ?, ?, ?)
      `);
      const insertKw = client.prepare(`
        INSERT OR REPLACE INTO keywords (id, project_id, keyword, group_name, url, volume, difficulty, history, monthly, deleted_at, deleted_with)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const tx = client.transaction(() => {
        projects.forEach((p) => insertProj.run(p.id, p.name, p.domain, p.deletedAt, p.deletedWith));
        categories.forEach((c) => insertCat.run(c.id, c.name, c.projectId, c.deletedAt, c.deletedWith));
        keywords.forEach((k) =>
          insertKw.run(
            String(k.id),
            k.projectId,
            k.keyword,
            k.group,
            k.url,
            k.volume || 0,
            k.difficulty || 0,
            JSON.stringify(k.history || []),
            JSON.stringify(k.monthly || {}),
            k.deletedAt,
            k.deletedWith
          )
        );
      });
      tx();
    }

    res.json({ success: true, count: { projects: projects.length, categories: categories.length, keywords: keywords.length } });
  } catch (err) {
    console.error("Error in /api/sync:", err);
    res.status(500).json({ error: err.message });
  }
});

// Projects endpoints
app.post("/api/projects", async (req, res) => {
  try {
    const { id, name, domain } = req.body;
    const trimmedName = (name || "").trim();
    if (!trimmedName) {
      return res.status(400).json({ error: "Project name is required" });
    }

    const { client, type } = await getDb();

    // Check for duplicate active project name
    let existing = null;
    if (type === "postgres") {
      const result = await client.query(
        "SELECT id FROM projects WHERE LOWER(TRIM(name)) = LOWER($1) AND deleted_at IS NULL LIMIT 1",
        [trimmedName]
      );
      existing = result.rows[0];
    } else if (type === "mysql") {
      const [rows] = await client.query(
        "SELECT id FROM projects WHERE LOWER(TRIM(name)) = LOWER(?) AND deleted_at IS NULL LIMIT 1",
        [trimmedName]
      );
      existing = rows[0];
    } else {
      existing = client.prepare(
        "SELECT id FROM projects WHERE LOWER(TRIM(name)) = LOWER(?) AND deleted_at IS NULL LIMIT 1"
      ).get(trimmedName);
    }

    if (existing) {
      return res.status(409).json({ error: `A project named "${trimmedName}" already exists` });
    }

    if (type === "postgres") {
      await client.query("INSERT INTO projects (id, name, domain) VALUES ($1, $2, $3)", [id, trimmedName, domain]);
    } else if (type === "mysql") {
      await client.query("INSERT INTO projects (id, name, domain) VALUES (?, ?, ?)", [id, trimmedName, domain]);
    } else {
      client.prepare("INSERT INTO projects (id, name, domain) VALUES (?, ?, ?)").run(id, trimmedName, domain);
    }
    res.status(201).json({ id, name: trimmedName, domain, deletedAt: null, deletedWith: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, domain, deletedAt, deletedWith } = req.body;
    const { client, type } = await getDb();

    if (name !== undefined) {
      const trimmedName = name.trim();
      let existing = null;
      if (type === "postgres") {
        const result = await client.query(
          "SELECT id FROM projects WHERE LOWER(TRIM(name)) = LOWER($1) AND id != $2 AND deleted_at IS NULL LIMIT 1",
          [trimmedName, id]
        );
        existing = result.rows[0];
      } else if (type === "mysql") {
        const [rows] = await client.query(
          "SELECT id FROM projects WHERE LOWER(TRIM(name)) = LOWER(?) AND id != ? AND deleted_at IS NULL LIMIT 1",
          [trimmedName, id]
        );
        existing = rows[0];
      } else {
        existing = client.prepare(
          "SELECT id FROM projects WHERE LOWER(TRIM(name)) = LOWER(?) AND id != ? AND deleted_at IS NULL LIMIT 1"
        ).get(trimmedName, id);
      }

      if (existing) {
        return res.status(409).json({ error: `A project named "${trimmedName}" already exists` });
      }
    }

    if (type === "postgres") {
      await client.query(
        `UPDATE projects SET
           name = COALESCE($1, name),
           domain = COALESCE($2, domain),
           deleted_at = $3,
           deleted_with = $4
         WHERE id = $5`,
        [name, domain, deletedAt, deletedWith, id]
      );
    } else if (type === "mysql") {
      await client.query(
        `UPDATE projects SET
           name = COALESCE(?, name),
           domain = COALESCE(?, domain),
           deleted_at = ?,
           deleted_with = ?
         WHERE id = ?`,
        [name, domain, deletedAt, deletedWith, id]
      );
    } else {
      client.prepare(
        `UPDATE projects SET
           name = COALESCE(?, name),
           domain = COALESCE(?, domain),
           deleted_at = ?,
           deleted_with = ?
         WHERE id = ?`
      ).run(name, domain, deletedAt, deletedWith, id);
    }
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Categories endpoints
app.post("/api/categories", async (req, res) => {
  try {
    const { id, name, projectId, deletedAt, deletedWith } = req.body;
    const trimmedName = (name || "").trim();
    if (!trimmedName || !projectId) {
      return res.status(400).json({ error: "Category name and projectId are required" });
    }

    const { client, type } = await getDb();

    // Check for duplicate active category name in same project
    let existing = null;
    if (type === "postgres") {
      const result = await client.query(
        "SELECT id FROM categories WHERE project_id = $1 AND LOWER(TRIM(name)) = LOWER($2) AND deleted_at IS NULL LIMIT 1",
        [projectId, trimmedName]
      );
      existing = result.rows[0];
    } else if (type === "mysql") {
      const [rows] = await client.query(
        "SELECT id FROM categories WHERE project_id = ? AND LOWER(TRIM(name)) = LOWER(?) AND deleted_at IS NULL LIMIT 1",
        [projectId, trimmedName]
      );
      existing = rows[0];
    } else {
      existing = client.prepare(
        "SELECT id FROM categories WHERE project_id = ? AND LOWER(TRIM(name)) = LOWER(?) AND deleted_at IS NULL LIMIT 1"
      ).get(projectId, trimmedName);
    }

    if (existing) {
      return res.status(409).json({ error: `A category named "${trimmedName}" already exists in this project` });
    }

    const catId = id || `cat-${Date.now()}`;
    if (type === "postgres") {
      await client.query(
        "INSERT INTO categories (id, name, project_id, deleted_at, deleted_with) VALUES ($1, $2, $3, $4, $5)",
        [catId, trimmedName, projectId, deletedAt || null, deletedWith || null]
      );
    } else if (type === "mysql") {
      await client.query(
        "INSERT INTO categories (id, name, project_id, deleted_at, deleted_with) VALUES (?, ?, ?, ?, ?)",
        [catId, trimmedName, projectId, deletedAt || null, deletedWith || null]
      );
    } else {
      client.prepare(
        "INSERT INTO categories (id, name, project_id, deleted_at, deleted_with) VALUES (?, ?, ?, ?, ?)"
      ).run(catId, trimmedName, projectId, deletedAt || null, deletedWith || null);
    }

    res.status(201).json({ id: catId, name: trimmedName, projectId, deletedAt: null, deletedWith: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Keywords endpoints
app.post("/api/keywords", async (req, res) => {
  try {
    const k = req.body;
    const { client, type } = await getDb();
    const id = String(k.id || Date.now());

    if (type === "postgres") {
      await client.query(
        `INSERT INTO keywords (id, project_id, keyword, group_name, url, volume, difficulty, history, monthly, deleted_at, deleted_with)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          id,
          k.projectId,
          k.keyword,
          k.group,
          k.url,
          k.volume || 0,
          k.difficulty || 0,
          JSON.stringify(k.history || []),
          JSON.stringify(k.monthly || {}),
          k.deletedAt || null,
          k.deletedWith || null,
        ]
      );
    } else if (type === "mysql") {
      await client.query(
        `INSERT INTO keywords (id, project_id, keyword, group_name, url, volume, difficulty, history, monthly, deleted_at, deleted_with)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          k.projectId,
          k.keyword,
          k.group,
          k.url,
          k.volume || 0,
          k.difficulty || 0,
          JSON.stringify(k.history || []),
          JSON.stringify(k.monthly || {}),
          k.deletedAt || null,
          k.deletedWith || null,
        ]
      );
    } else {
      client.prepare(
        `INSERT INTO keywords (id, project_id, keyword, group_name, url, volume, difficulty, history, monthly, deleted_at, deleted_with)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        k.projectId,
        k.keyword,
        k.group,
        k.url,
        k.volume || 0,
        k.difficulty || 0,
        JSON.stringify(k.history || []),
        JSON.stringify(k.monthly || {}),
        k.deletedAt || null,
        k.deletedWith || null
      );
    }
    res.status(201).json({ ...k, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete project
app.delete("/api/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { client, type } = await getDb();
    if (type === "postgres") {
      await client.query("DELETE FROM keywords WHERE project_id = $1", [id]);
      await client.query("DELETE FROM categories WHERE project_id = $1", [id]);
      await client.query("DELETE FROM projects WHERE id = $1", [id]);
    } else if (type === "mysql") {
      await client.query("DELETE FROM keywords WHERE project_id = ?", [id]);
      await client.query("DELETE FROM categories WHERE project_id = ?", [id]);
      await client.query("DELETE FROM projects WHERE id = ?", [id]);
    } else {
      client.prepare("DELETE FROM keywords WHERE project_id = ?").run(id);
      client.prepare("DELETE FROM categories WHERE project_id = ?").run(id);
      client.prepare("DELETE FROM projects WHERE id = ?").run(id);
    }
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update category
app.patch("/api/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, deletedAt, deletedWith } = req.body;
    const { client, type } = await getDb();

    if (name !== undefined) {
      const trimmedName = name.trim();
      // First find the project_id of this category
      let currentCat = null;
      if (type === "postgres") {
        const resCurrent = await client.query("SELECT project_id FROM categories WHERE id = $1", [id]);
        currentCat = resCurrent.rows[0];
      } else if (type === "mysql") {
        const [resCurrent] = await client.query("SELECT project_id FROM categories WHERE id = ?", [id]);
        currentCat = resCurrent[0];
      } else {
        currentCat = client.prepare("SELECT project_id FROM categories WHERE id = ?").get(id);
      }

      if (currentCat && currentCat.project_id) {
        let existing = null;
        if (type === "postgres") {
          const resDup = await client.query(
            "SELECT id FROM categories WHERE project_id = $1 AND LOWER(TRIM(name)) = LOWER($2) AND id != $3 AND deleted_at IS NULL LIMIT 1",
            [currentCat.project_id, trimmedName, id]
          );
          existing = resDup.rows[0];
        } else if (type === "mysql") {
          const [resDup] = await client.query(
            "SELECT id FROM categories WHERE project_id = ? AND LOWER(TRIM(name)) = LOWER(?) AND id != ? AND deleted_at IS NULL LIMIT 1",
            [currentCat.project_id, trimmedName, id]
          );
          existing = resDup[0];
        } else {
          existing = client.prepare(
            "SELECT id FROM categories WHERE project_id = ? AND LOWER(TRIM(name)) = LOWER(?) AND id != ? AND deleted_at IS NULL LIMIT 1"
          ).get(currentCat.project_id, trimmedName, id);
        }

        if (existing) {
          return res.status(409).json({ error: `A category named "${trimmedName}" already exists in this project` });
        }
      }
    }

    if (type === "postgres") {
      await client.query(
        "UPDATE categories SET name = COALESCE($1, name), deleted_at = $2, deleted_with = $3 WHERE id = $4",
        [name !== undefined ? name.trim() : null, deletedAt, deletedWith, id]
      );
    } else if (type === "mysql") {
      await client.query(
        "UPDATE categories SET name = COALESCE(?, name), deleted_at = ?, deleted_with = ? WHERE id = ?",
        [name !== undefined ? name.trim() : null, deletedAt, deletedWith, id]
      );
    } else {
      client.prepare(
        "UPDATE categories SET name = COALESCE(?, name), deleted_at = ?, deleted_with = ? WHERE id = ?"
      ).run(name !== undefined ? name.trim() : null, deletedAt, deletedWith, id);
    }
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete category
app.delete("/api/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { client, type } = await getDb();
    if (type === "postgres") {
      await client.query("DELETE FROM keywords WHERE deleted_with = $1", [id]);
      await client.query("DELETE FROM categories WHERE id = $1", [id]);
    } else if (type === "mysql") {
      await client.query("DELETE FROM keywords WHERE deleted_with = ?", [id]);
      await client.query("DELETE FROM categories WHERE id = ?", [id]);
    } else {
      client.prepare("DELETE FROM keywords WHERE deleted_with = ?").run(id);
      client.prepare("DELETE FROM categories WHERE id = ?").run(id);
    }
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update keyword
app.patch("/api/keywords/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { keyword, group, url, volume, difficulty, history, monthly, deletedAt, deletedWith } = req.body;
    const { client, type } = await getDb();
    const historyJson = history !== undefined ? JSON.stringify(history) : undefined;
    const monthlyJson = monthly !== undefined ? JSON.stringify(monthly) : undefined;

    if (type === "postgres") {
      await client.query(
        `UPDATE keywords SET
           keyword = COALESCE($1, keyword),
           group_name = COALESCE($2, group_name),
           url = COALESCE($3, url),
           volume = COALESCE($4, volume),
           difficulty = COALESCE($5, difficulty),
           history = COALESCE($6, history),
           monthly = COALESCE($7, monthly),
           deleted_at = $8,
           deleted_with = $9
         WHERE id = $10`,
        [keyword, group, url, volume, difficulty, historyJson, monthlyJson, deletedAt, deletedWith, id]
      );
    } else if (type === "mysql") {
      await client.query(
        `UPDATE keywords SET
           keyword = COALESCE(?, keyword),
           group_name = COALESCE(?, group_name),
           url = COALESCE(?, url),
           volume = COALESCE(?, volume),
           difficulty = COALESCE(?, difficulty),
           history = COALESCE(?, history),
           monthly = COALESCE(?, monthly),
           deleted_at = ?,
           deleted_with = ?
         WHERE id = ?`,
        [keyword, group, url, volume, difficulty, historyJson, monthlyJson, deletedAt, deletedWith, id]
      );
    } else {
      client.prepare(
        `UPDATE keywords SET
           keyword = COALESCE(?, keyword),
           group_name = COALESCE(?, group_name),
           url = COALESCE(?, url),
           volume = COALESCE(?, volume),
           difficulty = COALESCE(?, difficulty),
           history = COALESCE(?, history),
           monthly = COALESCE(?, monthly),
           deleted_at = ?,
           deleted_with = ?
         WHERE id = ?`
      ).run(keyword, group, url, volume, difficulty, historyJson, monthlyJson, deletedAt, deletedWith, id);
    }
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete keyword
app.delete("/api/keywords/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { client, type } = await getDb();
    if (type === "postgres") {
      await client.query("DELETE FROM keywords WHERE id = $1", [id]);
    } else if (type === "mysql") {
      await client.query("DELETE FROM keywords WHERE id = ?", [id]);
    } else {
      client.prepare("DELETE FROM keywords WHERE id = ?").run(id);
    }
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 SEO Tracker API server running on http://localhost:${PORT}`);
  try {
    const { type } = await getDb();
    console.log(`✅ Connected and initialized database schema (${type})`);
  } catch (err) {
    console.error("Database initialization error on startup:", err);
  }
});
