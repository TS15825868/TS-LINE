"use strict";

const fs = require("fs/promises");
const path = require("path");

const VERSION = "1.0.0";
const APPROVED_VERSION = "v1";
const STATIC_DIR = path.join(__dirname, "public", "social-assets", "approved", APPROVED_VERSION);

async function exists(file) {
  try {
    const stat = await fs.stat(file);
    return stat.isFile() && stat.size > 10000;
  } catch {
    return false;
  }
}

function mountApprovedPostStatic(app) {
  app.get(`/social-assets/approved/${APPROVED_VERSION}/:slug.jpg`, async (req, res, next) => {
    const slug = String(req.params.slug || "");
    if (!/^[a-z0-9-]+$/i.test(slug)) return next();
    const file = path.join(STATIC_DIR, `${slug}.jpg`);
    if (!(await exists(file))) return next();
    res.set({
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-XJW-Approved-Post": `${VERSION}-${APPROVED_VERSION}`,
    });
    return res.sendFile(file);
  });
}

module.exports = {
  VERSION,
  APPROVED_VERSION,
  STATIC_DIR,
  mountApprovedPostStatic,
};
