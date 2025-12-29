
const express = require("express");

const app = express();
app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.status(200).send("Pastebin Lite is running ✅");
});

// Example API
app.post("/api/paste", (req, res) => {
  res.status(200).json({
    success: true,
    data: req.body
  });
});

/**
 * ✅ IMPORTANT
 * Export the app directly
 * ❌ NO app.listen()
 */
module.exports = app;
