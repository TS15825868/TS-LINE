"use strict";

const fs = require("fs");
const path = require("path");

const VERSION = "20260823-approved-hd-welcome-v4";

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
  // JPEG 完整性依 SOI/EOI 檔案簽章判定；壓縮後檔案大小不是有效性條件。
  const isJpeg =
    image.length > 1024 &&
    image[0] === 0xff &&
    image[1] === 0xd8 &&
    image[image.length - 2] === 0xff &&
    image[image.length - 1] === 0xd9;
  if (!isJpeg) {
    throw new Error(`正式歡迎圖資料不是完整 JPEG（${image.length} bytes）`);
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
