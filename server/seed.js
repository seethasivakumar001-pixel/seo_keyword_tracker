import dotenv from "dotenv";
import { getDb } from "./db.js";
import { initialProjects, initialCategories, initialKeywords } from "../src/data.js";

dotenv.config();

async function seed() {
  console.log("🌱 Starting MySQL database migration & initial data seeding...");
  const { client, type } = await getDb();
  console.log(`Database engine: ${type}`);

  if (type === "mysql") {
    // 1. Insert initial projects
    for (const p of initialProjects) {
      await client.query(
        `INSERT INTO projects (id, name, domain, deleted_at, deleted_with)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), domain = VALUES(domain), deleted_at = VALUES(deleted_at), deleted_with = VALUES(deleted_with)`,
        [p.id, p.name, p.domain, p.deletedAt, p.deletedWith]
      );
    }
    console.log(`✅ Seeded ${initialProjects.length} projects`);

    // 2. Insert initial categories
    for (const c of initialCategories) {
      await client.query(
        `INSERT INTO categories (id, name, project_id, deleted_at, deleted_with)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), project_id = VALUES(project_id), deleted_at = VALUES(deleted_at), deleted_with = VALUES(deleted_with)`,
        [c.id, c.name, c.projectId, c.deletedAt, c.deletedWith]
      );
    }
    console.log(`✅ Seeded ${initialCategories.length} categories`);

    // 3. Insert initial keywords
    for (const k of initialKeywords) {
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
    console.log(`✅ Seeded ${initialKeywords.length} keywords`);

    const [tables] = await client.query("SHOW TABLES");
    console.log("\n📋 Tables currently in database:", tables);

    const [pCount] = await client.query("SELECT COUNT(*) AS count FROM projects");
    const [cCount] = await client.query("SELECT COUNT(*) AS count FROM categories");
    const [kCount] = await client.query("SELECT COUNT(*) AS count FROM keywords");

    console.log(`\n🎉 MySQL Database is ready!`);
    console.log(`- Projects: ${pCount[0].count}`);
    console.log(`- Categories: ${cCount[0].count}`);
    console.log(`- Keywords: ${kCount[0].count}`);
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
