"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");
const sharp = require("sharp");

const VERSION = "2.0.0";
const CONTENT_VERSION = "legacy-clear-assets-v12-deferred";
const ROUTE_PREFIX = "/social-approved-assets";
const TARGET_SIZE = 1254;
const ORIGINAL_DIR = path.join(__dirname, "assets", "social-approved", "v7-original");
const DIRECT_DIR = path.join(__dirname, "assets", "social-approved", "clear-20260723");
const DIRECT_ORIGINALS = {
  "care-work-rest.jpg": "care-work-rest-fixed.avif",
  "care-work-rest-clear.jpg": "care-work-rest-fixed.avif",
};
const ORIGINAL_BASES = {
  "care-work-rest.jpg": "care-work-rest.avif",
  "care-work-rest-clear.jpg": "care-work-rest.avif",
  "care-family.jpg": "care-family.avif",
  "care-temperature-gap.jpg": "care-temperature-gap.avif",
  "care-hot-hydration.jpg": "care-hydration.avif",
  "care-rainy-day.jpg": "care-rainy-day.avif",
};
const THEMES = {
  "care-work-rest.jpg": ["工作再忙，", "也別忘了休息一下", "把日常節奏放穩，慢慢來也很好。"],
  "care-work-rest-clear.jpg": ["工作再忙，", "也別忘了休息一下", "把日常節奏放穩，慢慢來也很好。"],
  "care-family.jpg": ["照顧自己，", "也別忘了關心家人", "陪伴，往往就是最溫柔的照顧。"],
  "care-temperature-gap.jpg": ["早晚溫差大，", "出門多帶一件薄外套", "慢慢照顧自己，日常更安心。"],
  "care-hot-hydration.jpg": ["天氣炎熱，", "記得分次補充水分", "照顧自己，也照顧家人。"],
  "care-rainy-day.jpg": ["下雨天在家，", "也別忘了留一點暖暖時間", "天氣有變化，也記得照顧自己。"],
};
const IMAGE_CACHE = new Map();
const ORIGINAL_CACHE = new Map();

function directOriginalChunks(name) {
  const base = DIRECT_ORIGINALS[name];
  if (!base || !fs.existsSync(DIRECT_DIR)) return [];
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}\\.\\d{3}\\.b64$`);
  return fs.readdirSync(DIRECT_DIR).filter((file) => pattern.test(file)).sort().map((file) => path.join(DIRECT_DIR, file));
}

function directOriginalFile(name) {
  return directOriginalChunks(name)[0] || "";
}

function directOriginalBuffer(name) {
  const chunks = directOriginalChunks(name);
  if (!chunks.length) return null;
  const encoded = chunks.map((file) => fs.readFileSync(file, "utf8").replace(/\s+/g, "")).join("");
  if (!encoded || /[^A-Za-z0-9+/=]/.test(encoded)) return null;
  return Buffer.from(encoded, "base64");
}

function originalChunks(name) {
  const base = ORIGINAL_BASES[name];
  if (!base || !fs.existsSync(ORIGINAL_DIR)) return [];
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}\\.\\d{3}\\.b64$`);
  return fs.readdirSync(ORIGINAL_DIR).filter((file) => pattern.test(file)).sort().map((file) => path.join(ORIGINAL_DIR, file));
}

async function exactOriginal(name) {
  if (!ORIGINAL_CACHE.has(name)) {
    ORIGINAL_CACHE.set(name, (async () => {
      try {
        let input = directOriginalBuffer(name);
        if (!input) {
          const files = originalChunks(name);
          if (!files.length) return null;
          const encoded = files.map((file) => fs.readFileSync(file, "utf8").replace(/\s+/g, "")).join("");
          if (!encoded || /[^A-Za-z0-9+/=]/.test(encoded)) return null;
          input = Buffer.from(encoded, "base64");
        }
        const metadata = await sharp(input).metadata();
        if (metadata.width !== TARGET_SIZE || metadata.height !== TARGET_SIZE) return null;
        return sharp(input).jpeg({ quality: 96, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
      } catch {
        return null;
      }
    })());
  }
  return ORIGINAL_CACHE.get(name);
}

function fallbackSvg(name) {
  const [line1, line2, footer] = THEMES[name] || ["仙加味", "日常小提醒", "慢慢來也很好。"];
  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]));
  return `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254"><style>text{font-family:'Noto Sans CJK TC','PingFang TC','Microsoft JhengHei',sans-serif}</style><rect width="1254" height="1254" fill="#f7f4ed"/><rect x="24" y="24" width="1206" height="1206" rx="38" fill="none" stroke="#c58c38" stroke-width="5"/><rect x="120" y="170" width="1014" height="760" rx="55" fill="#fffaf0" stroke="#0b2e52" stroke-width="6"/><text x="627" y="400" text-anchor="middle" font-size="86" font-weight="900" fill="#0b2e52">${esc(line1)}</text><text x="627" y="530" text-anchor="middle" font-size="72" font-weight="900" fill="#0b2e52">${esc(line2)}</text><text x="627" y="790" text-anchor="middle" font-size="48" font-weight="800" fill="#9f1f1e">${esc(footer)}</text><rect x="170" y="1060" width="914" height="96" rx="48" fill="#0b2e52"/><text x="627" y="1124" text-anchor="middle" font-size="42" font-weight="900" fill="#fff4d8">仙加味・日常關心</text></svg>`;
}

async function imageBuffer(name) {
  if (!THEMES[name]) return null;
  if (!IMAGE_CACHE.has(name)) IMAGE_CACHE.set(name, (async () => (await exactOriginal(name)) || sharp(Buffer.from(fallbackSvg(name))).jpeg({ quality: 96, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer())());
  return IMAGE_CACHE.get(name);
}

async function info(name) {
  try {
    const original = await exactOriginal(name);
    const buffer = await imageBuffer(name);
    if (!buffer) return { name, ok: false, width: 0, height: 0, bytes: 0 };
    const metadata = await sharp(buffer).metadata();
    return { name, ok: metadata.width === TARGET_SIZE && metadata.height === TARGET_SIZE, width: metadata.width || 0, height: metadata.height || 0, bytes: buffer.length, exactOriginalSource: Boolean(original), directOriginalSource: Boolean(directOriginalFile(name)), crispVectorFallback: !original, routeDeferredToApprovedWebsiteQBoss: true };
  } catch (error) {
    return { name, ok: false, width: 0, height: 0, bytes: 0, error: error.message };
  }
}

function mount(app) {
  if (!app || app.__xjwLegacyClearAssetsMounted) return;
  Object.defineProperty(app, "__xjwLegacyClearAssetsMounted", { value: true });
  app.get(`${ROUTE_PREFIX}/legacy-healthz`, async (_req, res) => {
    const assets = await Promise.all(Object.keys(THEMES).map(info));
    res.json({ ok: assets.every((item) => item.ok), version: VERSION, contentVersion: CONTENT_VERSION, targetSize: TARGET_SIZE, exactOriginalSourceCount: assets.filter((item) => item.exactOriginalSource).length, crispVectorFallbackCount: assets.filter((item) => item.crispVectorFallback).length, dynamicRouteDeferred: true, assets });
  });
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./server" && loaded?.app) mount(loaded.app);
    return loaded;
  };
}

install();
module.exports = { VERSION, CONTENT_VERSION, ROUTE_PREFIX, TARGET_SIZE, THEMES, ORIGINAL_DIR, DIRECT_DIR, DIRECT_ORIGINALS, ORIGINAL_BASES, directOriginalChunks, directOriginalFile, directOriginalBuffer, originalChunks, exactOriginal, fallbackSvg, imageBuffer, info, mount, install };
