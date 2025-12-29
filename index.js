

const express = require("express");
const Database = require("better-sqlite3");
const { nanoid } = require("nanoid");
const cors = require("cors");

const app = express();

/* ---------------- MIDDLEWARE ---------------- */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------------- DATABASE ---------------- */
const db = new Database("pastes.db");

db.prepare(`
  CREATE TABLE IF NOT EXISTS pastes (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    expires_at INTEGER,
    max_views INTEGER,
    views INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`).run();

/* ---------------- TIME HANDLING ---------------- */
function getNow(req) {
  if (
    process.env.TEST_MODE === "1" &&
    req.headers["x-test-now-ms"]
  ) {
    return Number(req.headers["x-test-now-ms"]);
  }
  return Date.now();
}

/* ---------------- HOME PAGE ---------------- */
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Pastebin Lite</title>
      </head>
      <body>
        <h2>Create Paste</h2>
        <form method="POST" action="/api/pastes">
          <textarea name="content" rows="10" cols="60" required></textarea><br><br>
          TTL (seconds): <input type="number" name="ttl_seconds"><br><br>
          Max Views: <input type="number" name="max_views"><br><br>
          <button type="submit">Create Paste</button>
        </form>
      </body>
    </html>
  `);
});

/* ---------------- HEALTH CHECK ---------------- */
app.get("/api/healthz", (req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

/* ---------------- CREATE PASTE ---------------- */
app.post("/api/pastes", (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  if (!content || typeof content !== "string" || content.trim() === "") {
    return res.status(400).json({ error: "Invalid content" });
  }

  if (ttl_seconds && (!Number.isInteger(Number(ttl_seconds)) || ttl_seconds < 1)) {
    return res.status(400).json({ error: "Invalid ttl_seconds" });
  }

  if (max_views && (!Number.isInteger(Number(max_views)) || max_views < 1)) {
    return res.status(400).json({ error: "Invalid max_views" });
  }

  const id = nanoid(10);
  const now = Date.now();

  const expires_at = ttl_seconds
    ? now + Number(ttl_seconds) * 1000
    : null;

  db.prepare(`
    INSERT INTO pastes (id, content, expires_at, max_views, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, content, expires_at, max_views || null, now);

  res.status(201).json({
    id,
    url: `${req.protocol}://${req.get("host")}/p/${id}`
  });
});

/* ---------------- FETCH PASTE (API) ---------------- */
app.get("/api/pastes/:id", (req, res) => {
  const paste = db.prepare(
    "SELECT * FROM pastes WHERE id = ?"
  ).get(req.params.id);

  if (!paste) return res.status(404).json({ error: "Not found" });

  const now = getNow(req);

  if (paste.expires_at && now >= paste.expires_at) {
    return res.status(404).json({ error: "Expired" });
  }

  if (paste.max_views !== null && paste.views >= paste.max_views) {
    return res.status(404).json({ error: "View limit exceeded" });
  }

  db.prepare(
    "UPDATE pastes SET views = views + 1 WHERE id = ?"
  ).run(paste.id);

  const remaining_views =
    paste.max_views === null
      ? null
      : Math.max(0, paste.max_views - (paste.views + 1));

  res.json({
    content: paste.content,
    remaining_views,
    expires_at: paste.expires_at
      ? new Date(paste.expires_at).toISOString()
      : null
  });
});

/* ---------------- VIEW PASTE (HTML) ---------------- */
app.get("/p/:id", (req, res) => {
  const paste = db.prepare(
    "SELECT * FROM pastes WHERE id = ?"
  ).get(req.params.id);

  if (!paste) return res.status(404).send("Not found");

  const now = getNow(req);

  if (paste.expires_at && now >= paste.expires_at) {
    return res.status(404).send("Expired");
  }

  if (paste.max_views !== null && paste.views >= paste.max_views) {
    return res.status(404).send("View limit exceeded");
  }

  db.prepare(
    "UPDATE pastes SET views = views + 1 WHERE id = ?"
  ).run(paste.id);

  res.send(`
    <html>
      <body>
        <pre>${paste.content.replace(/</g, "&lt;")}</pre>
      </body>
    </html>
  `);
});

/* ---------------- START SERVER ---------------- */

/**
 * ✅ IMPORTANT
 * Export the app directly
 * ❌ NO app.listen()
 */
module.exports = app;
