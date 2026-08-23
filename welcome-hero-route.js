"use strict";

const fs = require("fs");
const path = require("path");

const VERSION = "20260823-approved-hd-welcome-v6-nonblocking";

function isCompleteJpeg(image) {
  return Buffer.isBuffer(image) &&
    image.length > 1024 &&
    image[0] === 0xff &&
    image[1] === 0xd8 &&
    image[image.length - 2] === 0xff &&
    image[image.length - 1] === 0xd9;
}

function loadEmbeddedWelcomeHero() {
  try {
    const file = path.join(__dirname, "welcome-hero-data.js");
    const raw = fs.readFileSync(file, "utf8");
    const marker = 'module.exports = "';
    const start = raw.indexOf(marker);
    if (start < 0) return null;

    let encoded = raw.slice(start + marker.length);
    const end = encoded.lastIndexOf('";');
    if (end >= 0) encoded = encoded.slice(0, end);
    encoded = encoded.replace(/\s+/g, "");

    const image = Buffer.from(encoded, "base64");
    return isCompleteJpeg(image) ? image : null;
  } catch (_error) {
    return null;
  }
}

function loadFallbackWelcomeHero() {
  try {
    const file = path.join(__dirname, "public", "mascot", "welcome.jpg");
    const image = fs.readFileSync(file);
    return isCompleteJpeg(image) ? image : null;
  } catch (_error) {
    return null;
  }
}

function loadWelcomeHeroBuffer() {
  return loadEmbeddedWelcomeHero() || loadFallbackWelcomeHero() || null;
}

const welcomeHeroBuffer = loadWelcomeHeroBuffer();

function install(app) {
  if (!app || app.__xjwWelcomeHeroRouteInstalled) return;

  // 歡迎圖是媒體資產，不得因資產截斷讓整個 LINE OA 啟動失敗。
  // 若目前兩份圖片都無效，保留服務正常上線；route 回 503，待正式完整圖片重新落檔後恢復 200。
  app.get("/mascot/welcome-hd.jpg", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Xianjiawei-Welcome-Version", VERSION);
    if (!welcomeHeroBuffer) {
      return res.status(503).type("text/plain").send("welcome hero unavailable");
    }
    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    return res.send(welcomeHeroBuffer);
  });

  Object.defineProperty(app, "__xjwWelcomeHeroRouteInstalled", { value: true });
}

module.exports = { VERSION, install };
