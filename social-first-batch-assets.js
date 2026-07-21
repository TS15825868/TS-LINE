"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");
const sharp = require("sharp");

const VERSION = "2.0.0";
const ROUTE_PREFIX = "/social-assets/first-batch";
const CACHE = new Map();
const RAW_SOURCE = "https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/social/first-batch";
const RENDER_SOURCE = "https://ts-line.onrender.com/social-assets/first-batch";
const MASCOT_DIR = path.join(__dirname, "public", "mascot");

// 只使用已核准、已存在的正式小老闆圖片，不再用 SVG 或 AI 程式重畫角色。
const ASSETS = Object.freeze({
  "other-choose-form-2026-07-24.jpg": { file: "recommend.jpg" },
  "care-work-rest-2026-07-29.jpg": { file: "faq.jpg" },
  "other-hot-drink-2026-07-31.jpg": { file: "usage.jpg" },
  "care-family-2026-08-05.jpg": { file: "brand.jpg" },
  "other-storage-2026-08-07.jpg": { file: "service.jpg" },
  "care-temperature-gap-2026-08-12.jpg": { file: "recommend.jpg" },
  "other-warm-meal-2026-08-14.jpg": { file: "usage.jpg" },
  "care-hydration-2026-08-19.jpg": { file: "usage.jpg" },
  "care-rainy-day-2026-08-26.jpg": { file: "welcome.jpg" },
});

function addApprovedHost() {
  const hosts = new Set(
    String(process.env.SOCIAL_APPROVED_IMAGE_HOSTS || "raw.githubusercontent.com,ts15825868.github.io")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  hosts.add("ts-line.onrender.com");
  try {
    const host = new URL(String(process.env.RENDER_EXTERNAL_URL || "")).hostname;
    if (host) hosts.add(host);
  } catch {}
  process.env.SOCIAL_APPROVED_IMAGE_HOSTS = [...hosts].join(",");
}

function sourcePath(name) {
  const asset = ASSETS[name];
  if (!asset) throw new Error("unknown social asset");
  const file = path.join(MASCOT_DIR, asset.file);
  if (!fs.existsSync(file)) throw new Error(`approved mascot asset missing: ${asset.file}`);
  return file;
}

function renderSvg(config = {}) {
  const title = String(config.title || "仙加味正式小老闆素材").replace(/[&<>"']/g, "");
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"><rect width="1080" height="1080" fill="#f7f4ed"/><text x="540" y="540" text-anchor="middle" font-family="PingFang TC,Microsoft JhengHei,sans-serif" font-size="54" fill="#0b1f3b">${title}</text></svg>`;
}

async function imageBuffer(name) {
  if (!ASSETS[name]) throw new Error("unknown social asset");
  if (!CACHE.has(name)) {
    CACHE.set(
      name,
      sharp(sourcePath(name))
        .rotate()
        .resize(1080, 1080, {
          fit: "contain",
          position: "centre",
          background: { r: 247, g: 244, b: 237, alpha: 1 },
          withoutEnlargement: false,
        })
        .flatten({ background: "#f7f4ed" })
        .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
        .toBuffer()
    );
  }
  return CACHE.get(name);
}

function mount(app) {
  if (!app || app.__xjwFirstBatchAssetsMounted) return;
  Object.defineProperty(app, "__xjwFirstBatchAssetsMounted", { value: true });
  app.get(`${ROUTE_PREFIX}/:name`, async (req, res) => {
    const name = String(req.params.name || "");
    if (!Object.prototype.hasOwnProperty.call(ASSETS, name)) return res.status(404).send("not found");
    try {
      const buffer = await imageBuffer(name);
      res.set("Cache-Control", "public, max-age=3600, must-revalidate");
      res.type("image/jpeg").send(buffer);
    } catch (error) {
      console.error("approved social mascot asset failed", error);
      res.status(500).send("asset failed");
    }
  });
  app.get("/social-assets/healthz", (_req, res) =>
    res.json({
      ok: true,
      version: VERSION,
      mode: "approved-mascot-originals-only",
      assets: Object.keys(ASSETS).length,
    })
  );
}

function installSourcePatch() {
  const previousLoader = Module._extensions[".js"];
  if (previousLoader.__xjwFirstBatchAssetUrl) return;
  const wrapped = function loadWithFirstBatchAssetUrl(module, filename) {
    if (path.basename(filename) !== "social-first-batch-202607.js") return previousLoader(module, filename);
    const source = fs.readFileSync(filename, "utf8").replace(RAW_SOURCE, RENDER_SOURCE);
    return module._compile(source, filename);
  };
  Object.defineProperty(wrapped, "__xjwFirstBatchAssetUrl", { value: true });
  Module._extensions[".js"] = wrapped;
}

function install() {
  addApprovedHost();
  installSourcePatch();
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./server" && loaded?.app) mount(loaded.app);
    return loaded;
  };
}

install();

module.exports = {
  VERSION,
  ROUTE_PREFIX,
  ASSETS,
  renderSvg,
  imageBuffer,
  mount,
  addApprovedHost,
  installSourcePatch,
  install,
};
