"use strict";

const fs = require("fs/promises");
const path = require("path");
const { CARDS } = require("./knowledge-card-server");

const VERSION = "3.0.0";
const IMAGE_PATH_VERSION = "v10";
const STATIC_ROOT = path.join(__dirname, "public", "social-assets", "knowledge");
const STATIC_DIR = path.join(STATIC_ROOT, IMAGE_PATH_VERSION);

async function exists(file) {
  try {
    const stat = await fs.stat(file);
    return stat.isFile() && stat.size > 1000;
  } catch {
    return false;
  }
}

function mountKnowledgeCardStatic(app) {
  app.get(`/social-assets/knowledge/${IMAGE_PATH_VERSION}/:slug.png`, async (req, res, next) => {
    const slug = String(req.params.slug || "");
    if (!Object.prototype.hasOwnProperty.call(CARDS, slug)) return next();

    const file = path.join(STATIC_DIR, `${slug}.png`);
    if (!(await exists(file))) return next();

    res.set({
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-XJW-Knowledge-Card-Source": `static-${VERSION}-${IMAGE_PATH_VERSION}`,
      "X-XJW-Layout": "approved-integrated-square",
    });
    return res.sendFile(file);
  });

  app.get("/social-assets/knowledge/:slug.png", (req, res, next) => {
    const slug = String(req.params.slug || "");
    if (!Object.prototype.hasOwnProperty.call(CARDS, slug)) return next();
    res.set({
      "Cache-Control": "no-store, max-age=0",
      "X-XJW-Knowledge-Card-Replaced-By": `/social-assets/knowledge/${IMAGE_PATH_VERSION}/${slug}.png`,
    });
    return res.status(410).send("knowledge card image replaced");
  });
}

module.exports = {
  VERSION,
  IMAGE_PATH_VERSION,
  STATIC_ROOT,
  STATIC_DIR,
  mountKnowledgeCardStatic,
};
