require("tsx/cjs");

const path = require("node:path");
const fs = require("node:fs");
const express = require("express");

const appModule = require("./app.ts");
const app = appModule.default || appModule;

const STATIC_ROOT = path.resolve(__dirname, "..", "static-build");
const WEB_ROOT = path.join(STATIC_ROOT, "web");

app.use(express.static(WEB_ROOT));
app.use(express.static(STATIC_ROOT));

app.get("*", (req, res) => {
  const indexPath = path.join(WEB_ROOT, "index.html");

  if (!fs.existsSync(indexPath)) {
    return res.status(404).send("Web build not found.");
  }

  res.sendFile(indexPath);
});

const port = parseInt(process.env.PORT || "3000", 10);

app.listen(port, "0.0.0.0", () => {
  console.log(`Copointo web + API running on port ${port}`);
});
