"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");
const sharp = require("sharp");
const { POSTS } = require("./social-final-posts");

const VERSION = "1.2.0";
const CONTENT_VERSION = "approved-clear-extra-v3-fallback";
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

const THEMES = Object.freeze({
  "care-warm-meal.jpg": {
    badge: "仙加味日常分享",
    title: ["想吃得暖一點，", "日常也可以慢慢安排"],
    bullets: ["依料理與生活節奏安排", "熱湯與燉煮都很日常", "從順手的小地方開始"],
    footer: "把生活安排得穩穩的，也是照顧自己的方式。",
  },
  "guide-routine-choice.jpg": {
    badge: "仙加味日常選擇",
    title: ["依照自己的作息，", "選擇適合的日常型態"],
    bullets: ["先看使用情境與習慣", "膏、飲、湯塊、粉各有方便", "選自己做得到的方式"],
    footer: "不求一次選很多，先選順手的更重要。",
  },
  "care-opened-storage.jpg": {
    badge: "仙加味保存小提醒",
    title: ["開封後與平時保存，", "記得放在適合的地方"],
    bullets: ["先閱讀包裝保存標示", "取用後記得密封放好", "不同型態做法可能不同"],
    footer: "把保存方式看清楚，日常使用更安心。",
  },
  "care-hot-water-method.jpg": {
    badge: "仙加味使用小提醒",
    title: ["想喝熱熱的時候，", "記得先化開再調整溫度"],
    bullets: ["先依產品標示處理", "再調整水量與溫度", "慢慢找到習慣的口感"],
    footer: "一步一步來，簡單就好。",
  },
  "care-daily-hydration.jpg": {
    badge: "仙加味日常關心",
    title: ["日常補水提醒，", "分次補充水分更安心"],
    bullets: ["外出記得帶水瓶", "不必等口渴才喝", "忙碌時也安排休息"],
    footer: "照顧自己，也照顧家人。",
  },
  "care-sun-hydration.jpg": {
    badge: "仙加味日常關心",
    title: ["天氣悶熱，", "外出記得防曬與補水"],
    bullets: ["帽子、陽傘先準備", "外出補充水分更安心", "回家後也休息一下"],
    footer: "天氣熱的時候，也要記得照顧好自己。",
  },
});

function esc(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[char]);
}

function assetUrl(name) {
  return `${PUBLIC_BASE}${ROUTE_PREFIX}/${encodeURIComponent(name)}?v=${CONTENT_VERSION}`;
}

function sourceChunks(name) {
  const base = SOURCE_MAP[name];
  if (!base || !fs.existsSync(ASSET_DIR)) return [];
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}\\.\\d{3}\\.b64$`);
  return fs.readdirSync(ASSET_DIR)
    .filter((file) => pattern.test(file))
    .sort()
    .map((file) => path.join(ASSET_DIR, file));
}

function sourceBuffer(name) {
  const chunks = sourceChunks(name);
  if (!chunks.length) return null;
  const encoded = chunks.map((file) => fs.readFileSync(file, "utf8").trim()).join("");
  if (!encoded || /[^A-Za-z0-9+/=]/.test(encoded)) return null;
  return Buffer.from(encoded, "base64");
}

function fallbackSvg(name) {
  const theme = THEMES[name];
  if (!theme) return "";
  const bullets = theme.bullets.map((item, index) =>
    `<g transform="translate(650 ${560 + index * 120})"><circle cx="0" cy="0" r="26" fill="#0b2e52"/><text x="0" y="11" text-anchor="middle" font-size="30" font-weight="900" fill="#fff">✓</text><text x="55" y="13" font-size="43" font-weight="800" fill="#0b2e52">${esc(item)}</text></g>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff9e8"/><stop offset="1" stop-color="#ead0a0"/></linearGradient>
      <style>text{font-family:"Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",sans-serif}</style>
    </defs>
    <rect width="1254" height="1254" fill="url(#bg)"/>
    <rect x="24" y="24" width="1206" height="1206" rx="38" fill="none" stroke="#b77a2a" stroke-width="4"/>
    <g transform="translate(58 48)">
      <rect width="70" height="140" rx="23" fill="#9f1f1e"/>
      <text x="35" y="42" text-anchor="middle" font-size="27" font-weight="900" fill="#fff">仙</text>
      <text x="35" y="82" text-anchor="middle" font-size="27" font-weight="900" fill="#fff">加</text>
      <text x="35" y="122" text-anchor="middle" font-size="27" font-weight="900" fill="#fff">味</text>
      <text x="100" y="62" font-size="55" font-weight="900" fill="#151515">仙加味</text>
      <text x="103" y="104" font-size="21" letter-spacing="4" fill="#314258">自然・安心・好漢方</text>
    </g>
    <rect x="420" y="64" width="480" height="84" rx="42" fill="#0b2e52" stroke="#c58c38" stroke-width="4"/>
    <text x="660" y="119" text-anchor="middle" font-size="39" font-weight="900" fill="#fff4d8">${esc(theme.badge)}</text>
    <text x="770" y="275" text-anchor="middle" font-size="79" font-weight="900" fill="#092c52">${esc(theme.title[0])}</text>
    <text x="785" y="376" text-anchor="middle" font-size="67" font-weight="900" fill="#092c52">${esc(theme.title[1])}</text>
    <g transform="translate(92 325)">
      <circle cx="190" cy="176" r="150" fill="#f3c49b" stroke="#6e4230" stroke-width="7"/>
      <path d="M45 170C28 63 100 10 190 17c100 8 163 75 140 178-31-46-68-66-105-78-44 31-98 42-154 34z" fill="#171717"/>
      <ellipse cx="143" cy="193" rx="19" ry="28" fill="#281810"/><ellipse cx="242" cy="193" rx="19" ry="28" fill="#281810"/>
      <circle cx="137" cy="184" r="6" fill="#fff"/><circle cx="236" cy="184" r="6" fill="#fff"/>
      <path d="M148 252c27 27 54 27 81 0" fill="#fff" stroke="#8a3e2c" stroke-width="7"/>
      <path d="M74 344c48-48 184-48 232 0l32 335H42z" fill="#f4ead7" stroke="#84623d" stroke-width="7"/>
      <path d="M108 369L86 676h210l-27-307-43 27h-73z" fill="#344f2d" stroke="#1d321d" stroke-width="8"/>
      <rect x="153" y="430" width="73" height="125" rx="22" fill="#9f1f1e"/>
      <text x="190" y="470" text-anchor="middle" font-size="25" font-weight="900" fill="#fff">仙</text><text x="190" y="507" text-anchor="middle" font-size="25" font-weight="900" fill="#fff">加</text><text x="190" y="544" text-anchor="middle" font-size="25" font-weight="900" fill="#fff">味</text>
      <path d="M293 400c70-8 99 40 55 96" fill="none" stroke="#f3c49b" stroke-width="38" stroke-linecap="round"/>
    </g>
    <rect x="600" y="460" width="580" height="430" rx="38" fill="#fff9e9" stroke="#c78b35" stroke-width="5"/>
    ${bullets}
    <g transform="translate(560 913)"><circle cx="0" cy="0" r="69" fill="#d58a42" stroke="#6e3f22" stroke-width="7"/><path d="M-30-54l-25-48M31-54l25-48" stroke="#6e3f22" stroke-width="11" stroke-linecap="round"/><circle cx="-22" cy="-4" r="10" fill="#25170e"/><circle cx="22" cy="-4" r="10" fill="#25170e"/><ellipse cy="102" rx="69" ry="73" fill="#c77b35" stroke="#6e3f22" stroke-width="7"/></g>
    <g transform="translate(780 913)"><circle cx="0" cy="0" r="68" fill="#a9b96a" stroke="#42572d" stroke-width="7"/><circle cx="-22" cy="-5" r="10" fill="#202514"/><circle cx="22" cy="-5" r="10" fill="#202514"/><circle cx="-22" cy="-5" r="23" fill="none" stroke="#263647" stroke-width="5"/><circle cx="22" cy="-5" r="23" fill="none" stroke="#263647" stroke-width="5"/><ellipse cy="104" rx="83" ry="72" fill="#668044" stroke="#42572d" stroke-width="7"/></g>
    <rect x="155" y="1110" width="944" height="96" rx="48" fill="#0b2e52" stroke="#c58c38" stroke-width="4"/>
    <text x="627" y="1173" text-anchor="middle" font-size="37" font-weight="900" fill="#fff2d0">${esc(theme.footer)}</text>
  </svg>`;
}

async function imageBuffer(name) {
  if (!THEMES[name]) return null;
  if (!CACHE.has(name)) {
    CACHE.set(name, (async () => {
      const exact = sourceBuffer(name);
      if (exact) {
        const metadata = await sharp(exact).metadata();
        if (metadata.width === TARGET_SIZE && metadata.height === TARGET_SIZE) {
          return sharp(exact).jpeg({ quality: 96, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
        }
      }
      return sharp(Buffer.from(fallbackSvg(name))).jpeg({ quality: 96, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
    })());
  }
  return CACHE.get(name);
}

async function assetInfo(name) {
  const exact = sourceBuffer(name);
  const buffer = await imageBuffer(name);
  if (!buffer) return { name, ok: false, width: 0, height: 0, bytes: 0 };
  const metadata = await sharp(buffer).metadata();
  return {
    name,
    sourceFile: SOURCE_MAP[name],
    ok: metadata.width === TARGET_SIZE && metadata.height === TARGET_SIZE,
    width: metadata.width || 0,
    height: metadata.height || 0,
    bytes: buffer.length,
    exactUploadedSource: Boolean(exact),
    clearFallback: !exact,
    blurryAssetRemoved: true,
  };
}

function mount(app) {
  if (!app || app.__xjwApprovedExtraAssetsMounted) return;
  Object.defineProperty(app, "__xjwApprovedExtraAssetsMounted", { value: true });
  app.get(`${ROUTE_PREFIX}/healthz`, async (_req, res) => {
    try {
      const assets = await Promise.all(Object.keys(SOURCE_MAP).map(assetInfo));
      res.json({
        ok: assets.every((item) => item.ok),
        version: VERSION,
        contentVersion: CONTENT_VERSION,
        targetSize: TARGET_SIZE,
        exactUploadedCount: assets.filter((item) => item.exactUploadedSource).length,
        clearFallbackCount: assets.filter((item) => item.clearFallback).length,
        blurryAssetsEnabled: false,
        assets,
      });
    } catch (error) {
      res.status(500).json({ ok: false, version: VERSION, error: error.message });
    }
  });
  app.get(`${ROUTE_PREFIX}/:name`, async (req, res) => {
    const name = path.basename(String(req.params.name || ""));
    if (!SOURCE_MAP[name]) return res.status(404).send("not found");
    try {
      const buffer = await imageBuffer(name);
      return res.type("image/jpeg")
        .set("Cache-Control", "public, max-age=604800, immutable")
        .set("X-XJW-Asset-Version", CONTENT_VERSION)
        .set("X-XJW-Image-Size", "1254x1254")
        .set("X-XJW-Blurry-Asset", "false")
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
  approvedClearTheme: true,
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
module.exports = {
  VERSION,
  CONTENT_VERSION,
  ROUTE_PREFIX,
  TARGET_SIZE,
  ASSET_DIR,
  SOURCE_MAP,
  THEMES,
  EXTRA_POSTS,
  assetUrl,
  sourceChunks,
  sourceBuffer,
  fallbackSvg,
  imageBuffer,
  assetInfo,
  mount,
  applyPosts,
  install,
};
