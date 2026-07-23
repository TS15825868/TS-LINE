"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");
const sharp = require("sharp");

const VERSION = "1.3.0";
const CONTENT_VERSION = "approved-original-1254-v11-direct";
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
  "care-hot-hydration.jpg": ["日常補水提醒", "分次補充水分更安心", "照顧自己，也照顧家人。"],
  "care-rainy-day.jpg": ["下雨天在家，", "也別忘了留一點暖暖時間", "天氣有變化，也記得照顧自己。"],
};
const IMAGE_CACHE = new Map();
const ORIGINAL_CACHE = new Map();

function esc(value) {
  return String(value || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

function directOriginalChunks(name) {
  const base = DIRECT_ORIGINALS[name];
  if (!base || !fs.existsSync(DIRECT_DIR)) return [];
  const pattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\d{3}\\.b64$`);
  return fs.readdirSync(DIRECT_DIR).filter((file) => pattern.test(file)).sort().map((file) => path.join(DIRECT_DIR, file));
}

function directOriginalFile(name) {
  return directOriginalChunks(name)[0] || "";
}

function directOriginalBuffer(name) {
  const chunks = directOriginalChunks(name);
  if (!chunks.length) return null;
  const encoded = chunks.map((file) => fs.readFileSync(file, "utf8").trim()).join("");
  if (!encoded || /[^A-Za-z0-9+/=]/.test(encoded)) return null;
  return Buffer.from(encoded, "base64");
}

function originalChunks(name) {
  const base = ORIGINAL_BASES[name];
  if (!base || !fs.existsSync(ORIGINAL_DIR)) return [];
  const pattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\d{3}\\.b64$`);
  return fs.readdirSync(ORIGINAL_DIR).filter((file) => pattern.test(file)).sort().map((file) => path.join(ORIGINAL_DIR, file));
}

async function exactOriginal(name) {
  if (!ORIGINAL_CACHE.has(name)) {
    ORIGINAL_CACHE.set(name, (async () => {
      try {
        const direct = directOriginalBuffer(name);
        let input = null;
        if (direct) {
          input = direct;
        } else {
          const files = originalChunks(name);
          if (!files.length) return null;
          const encoded = files.map((file) => fs.readFileSync(file, "utf8").trim()).join("");
          if (!encoded || /[^A-Za-z0-9+/=]/.test(encoded)) return null;
          input = Buffer.from(encoded, "base64");
        }
        const meta = await sharp(input).metadata();
        if (meta.width !== TARGET_SIZE || meta.height !== TARGET_SIZE) return null;
        return sharp(input).jpeg({ quality: 96, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
      } catch {
        return null;
      }
    })());
  }
  return ORIGINAL_CACHE.get(name);
}

function fallbackSvg(name) {
  const [line1, line2, footer] = THEMES[name];
  return `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254">
  <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#fff9e8"/><stop offset="1" stop-color="#e7c793"/></linearGradient><style>text{font-family:"Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",sans-serif}</style></defs>
  <rect width="1254" height="1254" fill="url(#bg)"/><rect x="24" y="24" width="1206" height="1206" rx="38" fill="none" stroke="#b67828" stroke-width="4"/>
  <g transform="translate(58 50)"><rect width="68" height="136" rx="23" fill="#9f1f1e"/><text x="34" y="41" text-anchor="middle" font-size="27" font-weight="800" fill="#fff">仙</text><text x="34" y="80" text-anchor="middle" font-size="27" font-weight="800" fill="#fff">加</text><text x="34" y="119" text-anchor="middle" font-size="27" font-weight="800" fill="#fff">味</text><text x="98" y="58" font-size="52" font-weight="900" fill="#111827">仙加味</text><text x="100" y="100" font-size="21" letter-spacing="4" fill="#314258">自然・安心・好漢方</text></g>
  <rect x="420" y="64" width="455" height="84" rx="42" fill="#0b2e52" stroke="#c58c38" stroke-width="4"/><text x="648" y="119" text-anchor="middle" font-size="40" font-weight="800" fill="#fff4d8">仙加味日常關心</text>
  <text x="760" y="282" text-anchor="middle" font-size="91" font-weight="900" fill="#092c52">${esc(line1)}</text><text x="790" y="386" text-anchor="middle" font-size="70" font-weight="900" fill="#092c52">${esc(line2)}</text>
  <g transform="translate(105 310)"><circle cx="185" cy="175" r="150" fill="#f5c69d" stroke="#633c2c" stroke-width="7"/><path d="M42 170C25 62 96 8 186 15c101 8 164 75 142 178-30-47-68-66-105-78-45 31-97 42-155 35z" fill="#171717"/><ellipse cx="140" cy="190" rx="19" ry="28" fill="#281810"/><ellipse cx="240" cy="190" rx="19" ry="28" fill="#281810"/><circle cx="134" cy="181" r="6" fill="#fff"/><circle cx="234" cy="181" r="6" fill="#fff"/><path d="M145 250c28 27 55 27 82 0" fill="#fff" stroke="#8a3e2c" stroke-width="7"/>
  <path d="M70 340c48-48 184-48 232 0l32 310H38z" fill="#f4ead7" stroke="#84623d" stroke-width="7"/><path d="M105 365L82 650h210l-27-285-43 26h-72z" fill="#344f2d" stroke="#1d321d" stroke-width="8"/><rect x="150" y="420" width="72" height="122" rx="22" fill="#9f1f1e"/><text x="186" y="459" text-anchor="middle" font-size="25" font-weight="800" fill="#fff">仙</text><text x="186" y="495" text-anchor="middle" font-size="25" font-weight="800" fill="#fff">加</text><text x="186" y="531" text-anchor="middle" font-size="25" font-weight="800" fill="#fff">味</text><path d="M285 390c72-8 98 38 54 94" fill="none" stroke="#f5c69d" stroke-width="38" stroke-linecap="round"/></g>
  <g transform="translate(575 830)"><circle cx="0" cy="0" r="72" fill="#d58a42" stroke="#6e3f22" stroke-width="7"/><path d="M-30-55l-25-50M32-55l25-50" stroke="#6e3f22" stroke-width="11" stroke-linecap="round"/><circle cx="-23" cy="-5" r="11" fill="#25170e"/><circle cx="23" cy="-5" r="11" fill="#25170e"/><path d="M-22 28c15 17 29 17 44 0" fill="none" stroke="#6e3f22" stroke-width="5"/><ellipse cy="105" rx="72" ry="78" fill="#c77b35" stroke="#6e3f22" stroke-width="7"/></g>
  <g transform="translate(805 830)"><circle cx="0" cy="0" r="70" fill="#a9b96a" stroke="#42572d" stroke-width="7"/><circle cx="-23" cy="-6" r="11" fill="#202514"/><circle cx="23" cy="-6" r="11" fill="#202514"/><circle cx="-23" cy="-6" r="24" fill="none" stroke="#263647" stroke-width="5"/><circle cx="23" cy="-6" r="24" fill="none" stroke="#263647" stroke-width="5"/><path d="M-22 28c15 15 29 15 44 0" fill="none" stroke="#42572d" stroke-width="5"/><ellipse cy="110" rx="86" ry="76" fill="#668044" stroke="#42572d" stroke-width="7"/></g>
  <rect x="610" y="466" width="560" height="405" rx="38" fill="#fff9e9" stroke="#c78b35" stroke-width="5"/><g fill="#0b2e52" font-size="39" font-weight="800"><text x="700" y="570">✓ 圖片清楚再發布</text><text x="700" y="685">✓ 忙碌時也記得休息</text><text x="700" y="800">✓ 照顧自己與家人</text></g>
  <rect x="170" y="1110" width="914" height="96" rx="48" fill="#0b2e52" stroke="#c58c38" stroke-width="4"/><text x="627" y="1174" text-anchor="middle" font-size="42" font-weight="800" fill="#fff2d0">${esc(footer)}</text></svg>`;
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
    const meta = await sharp(buffer).metadata();
    return { name, ok: meta.width === TARGET_SIZE && meta.height === TARGET_SIZE, width: meta.width || 0, height: meta.height || 0, bytes: buffer.length, exactOriginalSource: Boolean(original), directOriginalSource: Boolean(directOriginalFile(name)), crispVectorFallback: !original };
  } catch (error) {
    return { name, ok: false, width: 0, height: 0, bytes: 0, error: error.message };
  }
}

function mount(app) {
  if (!app || app.__xjwCrispCareAssetsMounted) return;
  Object.defineProperty(app, "__xjwCrispCareAssetsMounted", { value: true });
  app.get(`${ROUTE_PREFIX}/healthz`, async (_req, res) => {
    const assets = await Promise.all(Object.keys(THEMES).map(info));
    res.json({ ok: assets.every((item) => item.ok), version: VERSION, contentVersion: CONTENT_VERSION, targetSize: TARGET_SIZE, exactOriginalSourceCount: assets.filter((item) => item.exactOriginalSource).length, directOriginalSourceCount: assets.filter((item) => item.directOriginalSource).length, crispVectorFallbackCount: assets.filter((item) => item.crispVectorFallback).length, assets });
  });
  app.get(`${ROUTE_PREFIX}/:name`, async (req, res, next) => {
    const name = path.basename(String(req.params.name || ""));
    if (!THEMES[name]) return next();
    try {
      const buffer = await imageBuffer(name);
      return res.type("image/jpeg").set("Cache-Control", "public, max-age=604800, immutable").set("X-XJW-Asset-Version", CONTENT_VERSION).set("X-XJW-Image-Size", "1254x1254").send(buffer);
    } catch (error) {
      console.error("crisp care asset failed", name, error.message);
      return res.status(500).send("asset failed");
    }
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
module.exports = { VERSION, CONTENT_VERSION, TARGET_SIZE, THEMES, ORIGINAL_DIR, DIRECT_DIR, DIRECT_ORIGINALS, ORIGINAL_BASES, directOriginalChunks, directOriginalFile, directOriginalBuffer, originalChunks, exactOriginal, fallbackSvg, imageBuffer, info, mount, install };
