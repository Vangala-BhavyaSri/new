
const express = require("express");
const { nanoid } = require("nanoid");
const cors = require("cors");

const app = express();

/* ---------------- MIDDLEWARE ---------------- */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------------- IN-MEMORY DATABASE ---------------- */
/**
 * ✅ REQUIRED FOR VERCEL
 * Serverless-safe storage
 */
const pastes = new Map();

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
  res.json({ ok: true });
});

/* ---------------- CREATE PASTE ---------------- */
app.post("/api/pastes", (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  if (!content || content.trim() === "") {
    return res.status(400).json({ error: "Invalid content" });
  }

  const id = nanoid(10);
  const now = Date.now();

  const expires_at = ttl_seconds
    ? now + Number(ttl_seconds) * 1000
    : null;

  pastes.set(id, {
    id,
    content,
    expires_at,
    max_views: max_views ? Number(max_views) : null,
    views: 0,
    created_at: now
  });

  res.status(201).json({
    id,
    url: `${req.protocol}://${req.get("host")}/p/${id}`
  });
});

/* ---------------- FETCH PASTE (API) ---------------- */
app.get("/api/pastes/:id", (req, res) => {
  const paste = pastes.get(req.params.id);
  if (!paste) return res.status(404).json({ error: "Not found" });

  const now = getNow(req);

  if (paste.expires_at && now >= paste.expires_at) {
    return res.status(404).json({ error: "Expired" });
  }

  if (paste.max_views !== null && paste.views >= paste.max_views) {
    return res.status(404).json({ error: "View limit exceeded" });
  }

  paste.views++;

  res.json({
    content: paste.content,
    remaining_views:
      paste.max_views === null
        ? null
        : Math.max(0, paste.max_views - paste.views),
    expires_at: paste.expires_at
      ? new Date(paste.expires_at).toISOString()
      : null
  });
});

/* ---------------- VIEW PASTE (HTML) ---------------- */
app.get("/p/:id", (req, res) => {
  const paste = pastes.get(req.params.id);
  if (!paste) return res.status(404).send("Not found");

  const now = getNow(req);

  if (paste.expires_at && now >= paste.expires_at) {
    return res.status(404).send("Expired");
  }

  if (paste.max_views !== null && paste.views >= paste.max_views) {
    return res.status(404).send("View limit exceeded");
  }

  paste.views++;

  res.send(`
    <html>
      <body>
        <pre>${paste.content.replace(/</g, "&lt;")}</pre>
      </body>
    </html>
  `);
});

/* ---------------- EXPORT APP ---------------- */
module.exports = app;
