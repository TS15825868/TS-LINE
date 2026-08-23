"use strict";

const fs = require("fs");
const path = require("path");

const VERSION = "20260823-approved-hd-welcome-v2";

function loadWelcomeHeroBuffer() {
  const file = path.join(__dirname, "welcome-hero-data.js");
  const raw = fs.readFileSync(file, "utf8");
  const marker = 'module.exports = "';
  const start = raw.indexOf(marker);
  if (start < 0) throw new Error("找不到正式歡迎圖資料起點");

  let encoded = raw.slice(start + marker.length);
  const end = encoded.lastIndexOf('";');
  if (end >= 0) encoded = encoded.slice(0, end);
  encoded = encoded.replace(/\s+/g, "");

  const image = Buffer.from(encoded, "base64");
  if (image.length < 100000 || image[0] !== 0xff || image[1] !== 0xd8) {
    throw new Error("正式歡迎圖資料不是有效高解析 JPEG");
  }
  return image;
}

const welcomeHeroBuffer = loadWelcomeHeroBuffer();

function install(app) {
  if (!app || app.__xjwWelcomeHeroRouteInstalled) return;
  app.get("/mascot/welcome-hd.jpg", (_req, res) => {
    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    res.set("X-Xianjiawei-Welcome-Version", VERSION);
    res.send(welcomeHeroBuffer);
  });
  Object.defineProperty(app, "__xjwWelcomeHeroRouteInstalled", { value: true });
}

module.exports = { VERSION, install };
