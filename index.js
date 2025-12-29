const express = require("express");
const serverless = require("serverless-http");

const app = express();

app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.status(200).send("Pastebin Lite running on Vercel");
});

// API example
app.post("/api/paste", (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: "Content is required" });
  }

  res.json({
    success: true,
    content
  });
});

/**
 * ❌ DO NOT USE app.listen()
 * ❌ DO NOT USE PORT
 */

// ✅ Export handler (required)
module.exports = serverless(app);

