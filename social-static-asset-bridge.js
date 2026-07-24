"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const Module = require("module");
const sharp = require("sharp");

const VERSION = "2026-07-24-raster-tc-v1";
const CONTENT_VERSION = "social-raster-tc-v1";
const TARGET_SIZE = 1254;
const PUBLIC_BASE = String(process.env.RENDER_EXTERNAL_URL || "https://ts-line.onrender.com").replace(/\/$/, "");
const FONT_CANDIDATES = [
  { url: "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/Variable/TTF/Subset/NotoSansTC-VF.ttf", file: "xjw-NotoSansTC-VF.ttf", family: "Noto Sans TC" },
  { url: "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTC/NotoSansCJK-Bold.ttc", file: "xjw-NotoSansCJK-Bold.ttc", family: "Noto Sans CJK TC" },
];

let batch = null;
let fontPromise = null;
let installed = false;
const cache = new Map();

function pango(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function ensureFont() {
  if (!fontPromise) {
    fontPromise = (async () => {
      for (const candidate of FONT_CANDIDATES) {
        const target = path.join(os.tmpdir(), candidate.file);
        try {
          const stat = fs.existsSync(target) ? fs.statSync(target) : null;
          if (!stat || stat.size < 1024 * 1024) {
            const response = await fetch(candidate.url, { signal: AbortSignal.timeout(60000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const buffer = Buffer.from(await response.arrayBuffer());
            if (buffer.length < 1024 * 1024) throw new Error("字型檔案過小");
            fs.writeFileSync(target, buffer, { mode: 0o600 });
          }
          return { path: target, family: candidate.family };
        } catch (error) {
          console.warn("Traditional Chinese font candidate failed", candidate.url, error.message);
        }
      }
      throw new Error("無法載入繁體中文字型，已停止產生貼文圖片以避免亂碼");
    })();
  }
  return fontPromise;
}

async function textLayer(text, width, height, color = "#0b2e52", weight = 900) {
  const font = await ensureFont();
  return sharp({
    text: {
      text: `<span foreground="${color}" font_weight="${weight}">${pango(text)}</span>`,
      font: font.family,
      fontfile: font.path,
      width,
      height,
      align: "center",
      wrap: "char",
      rgba: true,
    },
  }).png().toBuffer();
}

async function containScene(buffer, width, height) {
  return sharp(buffer)
    .resize({ width, height, fit: "contain", background: "#f7f4ed", withoutEnlargement: false })
    .flatten({ background: "#f7f4ed" })
    .png()
    .toBuffer();
}

async function careAssetBuffer(name) {
  const config = batch?.CARE_SCENES?.[name];
  if (!config) return null;
  const [source, badge, title, footer] = await Promise.all([
    batch.fetchRemoteBuffer(config.source),
    textLayer(config.badge, 300, 66, "#fff4d8", 900),
    textLayer(config.title, 760, 100, "#0b2e52", 900),
    textLayer(config.footer, 1000, 64, "#fff4d8", 900),
  ]);
  const scene = await containScene(source, 1170, 878);
  const shapes = Buffer.from(`<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><rect width="1254" height="1254" fill="#f7f4ed"/><rect x="32" y="22" width="1190" height="146" rx="38" fill="#f7f4ed" stroke="#c58c38" stroke-width="5"/><rect x="72" y="48" width="330" height="92" rx="46" fill="#0b2e52"/><rect x="80" y="1140" width="1094" height="92" rx="46" fill="#0b2e52" stroke="#c58c38" stroke-width="4"/></svg>`);
  return sharp(shapes)
    .composite([
      { input: badge, left: 87, top: 61 },
      { input: title, left: 432, top: 47 },
      { input: scene, left: 42, top: 184 },
      { input: footer, left: 127, top: 1153 },
    ])
    .jpeg({ quality: 96, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();
}

async function productAssetBuffer(name) {
  const urls = batch?.PRODUCT_SCENES?.[name];
  if (!urls) return null;
  const sources = await Promise.all(urls.map(batch.fetchRemoteBuffer));
  if (sources.length === 1) {
    const scene = await containScene(sources[0], 1170, 878);
    return sharp({ create: { width: TARGET_SIZE, height: TARGET_SIZE, channels: 4, background: "#f7f4ed" } })
      .composite([{ input: scene, left: 42, top: 188 }])
      .jpeg({ quality: 96, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toBuffer();
  }

  const [small, large, heading, subtitle, smallLabel, largeLabel] = await Promise.all([
    containScene(sources[0], 582, 437),
    containScene(sources[1], 582, 437),
    textLayer("龜鹿飲 30cc／180cc", 1050, 70, "#fff4d8", 900),
    textLayer("兩種真實包裝完整呈現，依生活情境安排", 1000, 45, "#f7dba8", 700),
    textLayer("30cc 玻璃小瓶", 400, 48, "#ffffff", 900),
    textLayer("180cc 鋁袋", 400, 48, "#ffffff", 900),
  ]);
  const shapes = Buffer.from(`<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><rect width="1254" height="1254" fill="#f7f4ed"/><rect x="36" y="26" width="1182" height="152" rx="38" fill="#0b2e52" stroke="#c58c38" stroke-width="5"/><rect x="90" y="213" width="460" height="68" rx="34" fill="#9f1f1e"/><rect x="704" y="213" width="460" height="68" rx="34" fill="#9f1f1e"/></svg>`);
  return sharp(shapes)
    .composite([
      { input: heading, left: 102, top: 42 },
      { input: subtitle, left: 127, top: 118 },
      { input: smallLabel, left: 120, top: 223 },
      { input: largeLabel, left: 734, top: 223 },
      { input: small, left: 22, top: 300 },
      { input: large, left: 650, top: 300 },
    ])
    .jpeg({ quality: 96, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();
}

async function assetBuffer(name) {
  const safe = path.basename(String(name || ""));
  if (!cache.has(safe)) {
    cache.set(safe, batch?.PRODUCT_SCENES?.[safe] ? productAssetBuffer(safe) : careAssetBuffer(safe));
  }
  return cache.get(safe);
}

function versionedImageUrl(value) {
  try {
    const url = new URL(String(value || ""), PUBLIC_BASE);
    if (!url.pathname.startsWith("/social-approved-assets/")) return String(value || "");
    url.searchParams.set("v", CONTENT_VERSION);
    return url.toString();
  } catch {
    return String(value || "");
  }
}

function normalizeStore(store) {
  if (!store || !Array.isArray(store.posts)) return store;
  store.posts = store.posts.map((post) => {
    const imageUrl = versionedImageUrl(post.imageUrl);
    if (imageUrl === post.imageUrl && post.contentVersion === CONTENT_VERSION) return post;
    return { ...post, imageUrl, contentVersion: CONTENT_VERSION, rasterTextVersion: VERSION };
  });
  return store;
}

function patchBatch(loaded) {
  if (!loaded || loaded.__xjwRasterTcPatched) return loaded;
  batch = loaded;
  loaded.assetBuffer = assetBuffer;
  loaded.careAssetBuffer = careAssetBuffer;
  loaded.productAssetBuffer = productAssetBuffer;
  loaded.CONTENT_VERSION = CONTENT_VERSION;
  Object.defineProperty(loaded, "__xjwRasterTcPatched", { value: true });
  return loaded;
}

function patchSocialServer(loaded) {
  if (!loaded || loaded.__xjwRasterStorePatched) return loaded;
  const originalRead = loaded.readStore;
  const originalWrite = loaded.writeStore;
  if (typeof originalRead === "function") loaded.readStore = () => normalizeStore(originalRead());
  if (typeof originalWrite === "function") loaded.writeStore = (store) => originalWrite(normalizeStore(store));
  Object.defineProperty(loaded, "__xjwRasterStorePatched", { value: true });
  return loaded;
}

function mountHealth(app) {
  if (!app || app.locals?.xjwRasterTcHealthMounted) return;
  app.locals.xjwRasterTcHealthMounted = true;
  app.get("/social/raster-healthz", async (_req, res) => {
    try {
      const font = await ensureFont();
      const sampleText = "繁體中文測試｜龜鹿膏100g｜30cc／180cc";
      const sample = await textLayer(sampleText, 1100, 120, "#0b2e52", 900);
      const metadata = await sharp(sample).metadata();
      const ok = metadata.format === "png" && Number(metadata.width || 0) > 300 && Number(metadata.height || 0) > 20 && sample.length > 1000;
      res.status(ok ? 200 : 503).json({
        ok,
        service: "仙加味繁體中文貼文圖片",
        version: VERSION,
        contentVersion: CONTENT_VERSION,
        targetSize: `${TARGET_SIZE}x${TARGET_SIZE}`,
        fontFamily: font.family,
        fontBytes: fs.statSync(font.path).size,
        sampleText,
        sampleFormat: metadata.format || "",
        sampleWidth: metadata.width || 0,
        sampleHeight: metadata.height || 0,
        sampleBytes: sample.length,
        rasterText: true,
        preventsGibberish: true,
      });
    } catch (error) {
      res.status(503).json({
        ok: false,
        service: "仙加味繁體中文貼文圖片",
        version: VERSION,
        contentVersion: CONTENT_VERSION,
        error: error.message,
      });
    }
  });
}

function install() {
  if (installed) return;
  installed = true;
  const previousLoad = Module._load;
  Module._load = function loadWithRasterTraditionalChinese(request, parent, isMain) {
    const loaded = previousLoad.apply(this, arguments);
    if (request === "./server" && loaded?.app) mountHealth(loaded.app);
    if (request === "./social-final-approved-batch") patchBatch(loaded);
    if (request === "./social-server") patchSocialServer(loaded);
    return loaded;
  };
}

install();
module.exports = { VERSION, CONTENT_VERSION, TARGET_SIZE, FONT_CANDIDATES, ensureFont, textLayer, careAssetBuffer, productAssetBuffer, assetBuffer, versionedImageUrl, normalizeStore, patchBatch, patchSocialServer, mountHealth, install };
