"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");
const sharp = require("sharp");
const { POSTS } = require("./social-final-posts");

const VERSION = "1.1.0";
const CONTENT_VERSION = "approved-clear-extra-v2-direct";
const PUBLIC_BASE = String(process.env.RENDER_EXTERNAL_URL || "https://ts-line.onrender.com").replace(/\/$/, "");
const ROUTE_PREFIX = "/social-approved-extra";
const TARGET_SIZE = 1254;
const ASSET_DIR = path.join(__dirname, "assets", "social-approved", "clear-20260723");
const CACHE = new Map();
let installed = false;

const SOURCE_MAP = Object.freeze({
  "care-warm-meal.jpg": "care-warm-meal.avif",
  "guide-routine-choice.jpg": "guide-routine-choice.avif",
  "care-opened-storage.jpg": "care-opened-storage.avif",
  "care-hot-water-method.jpg": "care-hot-water-method.avif",
  "care-daily-hydration.jpg": "care-daily-hydration.avif",
  "care-sun-hydration.jpg": "care-sun-hydration.avif",
});

function assetUrl(name) {
  return `${PUBLIC_BASE}${ROUTE_PREFIX}/${encodeURIComponent(name)}?v=${CONTENT_VERSION}`;
}

function sourcePath(name) {
  const file = SOURCE_MAP[name];
  return file ? path.join(ASSET_DIR, file) : "";
}

async function imageBuffer(name) {
  const source = sourcePath(name);
  if (!source || !fs.existsSync(source)) return null;
  if (!CACHE.has(name)) {
    CACHE.set(name, (async () => {
      const input = fs.readFileSync(source);
      const meta = await sharp(input).metadata();
      if (meta.width !== TARGET_SIZE || meta.height !== TARGET_SIZE) {
        throw new Error(`${name} 尺寸必須為 ${TARGET_SIZE}×${TARGET_SIZE}`);
      }
      return sharp(input).jpeg({ quality: 96, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
    })());
  }
  return CACHE.get(name);
}

function mount(app) {
  if (!app || app.__xjwApprovedExtraAssetsMounted) return;
  Object.defineProperty(app, "__xjwApprovedExtraAssetsMounted", { value: true });
  app.get(`${ROUTE_PREFIX}/healthz`, async (_req, res) => {
    try {
      const assets = await Promise.all(Object.keys(SOURCE_MAP).map(async (name) => {
        const buffer = await imageBuffer(name);
        if (!buffer) return { name, ok: false, bytes: 0 };
        const meta = await sharp(buffer).metadata();
        return { name, sourceFile: SOURCE_MAP[name], ok: meta.width === TARGET_SIZE && meta.height === TARGET_SIZE, width: meta.width || 0, height: meta.height || 0, bytes: buffer.length, exactUserComposition: true };
      }));
      res.json({ ok: assets.every((item) => item.ok), version: VERSION, contentVersion: CONTENT_VERSION, targetSize: TARGET_SIZE, assets });
    } catch (error) {
      res.status(500).json({ ok: false, version: VERSION, error: error.message });
    }
  });
  app.get(`${ROUTE_PREFIX}/:name`, async (req, res) => {
    const name = path.basename(String(req.params.name || ""));
    if (!SOURCE_MAP[name]) return res.status(404).send("not found");
    try {
      const buffer = await imageBuffer(name);
      if (!buffer) return res.status(404).send("not found");
      return res.type("image/jpeg")
        .set("Cache-Control", "public, max-age=604800, immutable")
        .set("X-XJW-Asset-Version", CONTENT_VERSION)
        .set("X-XJW-Image-Size", "1254x1254")
        .set("X-XJW-Exact-User-Composition", "true")
        .send(buffer);
    } catch (error) {
      console.error("approved extra social asset failed", name, error.message);
      return res.status(500).send("asset failed");
    }
  });
}

const EXTRA_POSTS = [
  ["second-batch-v1-care-warm-meal-20260909", "care", "日常關心", "想吃得暖一點，日常也可以慢慢安排", "2026-09-09T11:30:00.000Z", "care-warm-meal.jpg", "想吃得暖一點時，不一定要把安排弄得很複雜。\n\n熱湯、燉煮料理，或一餐好好坐下來慢慢吃，都是讓步調放慢、讓自己舒服一點的方式。\n\n把日常節奏放穩，慢慢來也很好。\n\n#仙加味 #日常關心 #暖一點 #慢慢安排"],
  ["second-batch-v1-guide-routine-choice-20260911", "product", "選購提醒", "依照自己的作息，選擇適合的日常型態", "2026-09-11T12:00:00.000Z", "guide-routine-choice.jpg", "每個人的作息不同，安排方式也不一定一樣。\n\n先看自己的生活節奏、使用情境與習慣，再挑選適合自己的型態。\n\n#仙加味 #選購提醒 #日常型態 #依作息安排"],
  ["second-batch-v1-care-storage-opened-20260916", "care", "保存提醒", "開封後與平時保存，記得放在適合的地方", "2026-09-16T11:30:00.000Z", "care-opened-storage.jpg", "開封後與平時保存，都別忘了看清楚包裝標示。\n\n不同型態可能有不同保存方式，取用後也記得密封放好。\n\n#仙加味 #保存提醒 #開封後保存 #日常小提醒"],
  ["second-batch-v1-care-hot-water-20260918", "product", "使用提醒", "想喝熱熱的時候，記得先化開再調整溫度", "2026-09-18T12:00:00.000Z", "care-hot-water-method.jpg", "想喝熱熱的時候，記得先化開，再依自己的習慣調整溫度。\n\n實際做法仍以產品標示為準。\n\n#仙加味 #使用提醒 #熱水搭配 #日常安排"],
  ["second-batch-v1-care-daily-hydration-20260923", "care", "日常關心", "日常補水提醒，分次補充水分更安心", "2026-09-23T11:30:00.000Z", "care-daily-hydration.jpg", "忙起來時，最容易忘記的就是喝水。\n\n把水放在看得到、拿得到的地方，分次補充更容易融入日常。\n\n#仙加味 #日常關心 #補充水分 #日常小提醒"],
  ["second-batch-v1-care-sun-hydration-20260925", "product", "氣候關心", "天氣悶熱，外出記得留意防曬與補水", "2026-09-25T12:00:00.000Z", "care-sun-hydration.jpg", "天氣悶熱時，外出除了補水，也別忘了留意遮陽與防曬。\n\n帽子、陽傘、水壺先準備好，讓整天行程更舒服。\n\n#仙加味 #氣候關心 #防曬提醒 #補水提醒"],
].map(([id, sequenceRole, category, title, scheduledAt, imageName, caption]) => ({
  id,
  sequenceRole,
  category,
  title,
  scheduledAt,
  imageUrl: assetUrl(imageName),
  sourceImageFile: SOURCE_MAP[imageName],
  instagramCaption: caption,
  facebookCaption: caption,
  clearAssetVersion: CONTENT_VERSION,
  exactUserComposition: true,
  blurryAssetRemoved: true,
}));

function applyPosts() {
  const known = new Set(POSTS.map((post) => String(post.id || "")));
  for (const post of EXTRA_POSTS) if (!known.has(post.id)) POSTS.push(post);
  return POSTS.length;
}

function install() {
  if (installed) return;
  installed = true;
  applyPosts();
  const originalLoad = Module._load;
  Module._load = function loadWithApprovedExtraAssets(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./server" && loaded?.app) mount(loaded.app);
    return loaded;
  };
}

install();
module.exports = { VERSION, CONTENT_VERSION, ROUTE_PREFIX, TARGET_SIZE, ASSET_DIR, SOURCE_MAP, EXTRA_POSTS, assetUrl, sourcePath, imageBuffer, mount, applyPosts, install };
