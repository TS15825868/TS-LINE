"use strict";

const fs = require("fs/promises");
const path = require("path");
const { CARDS } = require("./knowledge-card-server");

const VERSION = "1.0.0";
const STATIC_DIR = path.join(__dirname, "public", "social-assets", "knowledge");

async function exists(file) {
  try {
    const stat = await fs.stat(file);
    return stat.isFile() && stat.size > 1000;
  } catch {
    return false;
  }
}

function mountKnowledgeCardStatic(app) {
  app.get("/social-assets/knowledge/:slug.png", async (req, res, next) => {
    const slug = String(req.params.slug || "");
    if (!Object.prototype.hasOwnProperty.call(CARDS, slug)) return next();

    const file = path.join(STATIC_DIR, `${slug}.png`);
    if (!(await exists(file))) return next();

    res.set({
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-XJW-Knowledge-Card-Source": `static-${VERSION}`,
    });
    return res.sendFile(file);
  });
}

module.exports = { VERSION, STATIC_DIR, mountKnowledgeCardStatic };
