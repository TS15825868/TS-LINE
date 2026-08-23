"use strict";

const fs = require("fs");
const path = require("path");

const VERSION = "20260823-approved-hd-welcome-v5-resilient";

function isCompleteJpeg(image) {
  return Buffer.isBuffer(image) &&
    image.length > 1024 &&
    image[0] === 0xff &&
    image[1] === 0xd8 &&
    image[image.length - 2] === 0xff &&
    image[image.length - 1] === 0xd9;
}

function loadEmbeddedWelcomeHero() {
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
}

function loadFallbackWelcomeHero() {
  const file = path.join(__dirname, "public", "mascot", "welcome.jpg");
  const image = fs.readFileSync(file);
  if (!isCompleteJpeg(image)) {
    throw new Error(`備援歡迎圖不是完整 JPEG（${image.length} bytes）`);
  }
  return image;
}

function loadWelcomeHeroBuffer() {
  const embedded = loadEmbeddedWelcomeHero();
  if (embedded) return embedded;

  // 新版高解析資料若因傳輸/提交被截斷，不允許整個 LINE OA 因圖片而啟動失敗。
  // 先使用 repository 內既有完整正式歡迎圖維持服務；待高解析原圖重新完整落檔後會自動優先使用新版。
  return loadFallbackWelcomeHero();
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
