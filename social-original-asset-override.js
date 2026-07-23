"use strict";

const path = require("path");
const Module = require("module");
const sharp = require("sharp");

const VERSION = "1.1.0";
const CONTENT_VERSION = "approved-original-1254-v9";
const ROUTE_PREFIX = "/social-approved-assets";
const TARGET_SIZE = 1254;
const CACHE = new Map();
const ORIGINAL_DIR = path.join(__dirname, "assets", "social-approved", "v7-original");
const ORIGINAL_BASES = {
  "care-work-rest.jpg": "care-work-rest.avif",
  "care-work-rest-clear.jpg": "care-work-rest.avif",
  "care-family.jpg": "care-family.avif",
  "care-temperature-gap.jpg": "care-temperature-gap.avif",
  "care-hot-hydration.jpg": "care-hydration.avif",
  "care-rainy-day.jpg": "care-rainy-day.avif",
};

const THEMES = {
  "care-work-rest.jpg": {
    eyebrow: "仙加味日常關心",
    title: ["工作再忙，", "也別忘了休息一下"],
    tips: ["久坐時起身伸展", "喝水也要記得補上", "留一點時間照顧自己"],
    footer: "把日常節奏放穩，慢慢來也很好。",
    prop: "cup",
  },
  "care-work-rest-clear.jpg": {
    eyebrow: "仙加味日常關心",
    title: ["工作再忙，", "也別忘了休息一下"],
    tips: ["久坐時起身伸展", "喝水也要記得補上", "留一點時間照顧自己"],
    footer: "把日常節奏放穩，慢慢來也很好。",
    prop: "cup",
  },
  "care-family.jpg": {
    eyebrow: "仙加味日常關心",
    title: ["照顧自己，", "也別忘了關心家人"],
    tips: ["一句問候很有溫度", "一起吃飯、一起休息", "把關心放進日常裡"],
    footer: "陪伴，往往就是最溫柔的照顧。",
    prop: "heart",
  },
  "care-temperature-gap.jpg": {
    eyebrow: "仙加味日常關心",
    title: ["早晚溫差大，", "出門多帶一件薄外套"],
    tips: ["室內外溫差大時保暖", "忙碌一天也留點休息", "照顧自己也關心家人"],
    footer: "慢慢照顧自己，日常更安心。",
    prop: "coat",
  },
  "care-hot-hydration.jpg": {
    eyebrow: "仙加味日常關心",
    title: ["日常補水提醒", "分次補充水分更安心"],
    tips: ["外出記得帶水瓶", "不要等口渴才喝", "忙碌時也記得休息"],
    footer: "照顧自己，也照顧家人。",
    prop: "bottle",
  },
  "care-rainy-day.jpg": {
    eyebrow: "仙加味日常關心",
    title: ["下雨天在家，", "也別忘了留一點暖暖時間"],
    tips: ["泡一杯溫熱飲品", "把步調放慢一點", "也別忘了關心家人"],
    footer: "天氣有變化，照顧自己也照顧身邊的人。",
    prop: "rain",
  },
};

function esc(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  }[char]));
}

function icon(type, x, y) {
  const common = `fill="none" stroke="#fff8e8" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"`;
  if (type === "cup") return `<g transform="translate(${x} ${y})" ${common}><path d="M-42-20h70v45c0 28-18 45-35 45h-5c-18 0-30-17-30-45z"/><path d="M28-5h16c22 0 22 38 0 38H30"/><path d="M-22-48c-10-15 10-21 0-36M2-48c-10-15 10-21 0-36M26-48c-10-15 10-21 0-36"/></g>`;
  if (type === "heart") return `<g transform="translate(${x} ${y})" ${common}><path d="M0 58C-75 15-75-58-20-58 5-58 18-39 22-27 29-42 42-58 66-58 119-58 115 15 0 58z"/></g>`;
  if (type === "coat") return `<g transform="translate(${x} ${y})" ${common}><path d="M-42-60L-12-78 0-50 12-78 42-60 72 5 38 22 28 5v72h-56V5l-10 17-34-17z"/><path d="M0-50v127"/></g>`;
  if (type === "bottle") return `<g transform="translate(${x} ${y})" ${common}><path d="M-20-76h40v30l16 18v92c0 14-10 24-24 24h-24c-14 0-24-10-24-24v-92l16-18z"/><path d="M-20-46h40M-28 10h56"/></g>`;
  return `<g transform="translate(${x} ${y})" ${common}><path d="M-65-18c18-34 43-51 65-51s47 17 65 51"/><path d="M0-69v137"/><path d="M-52 5c10 18 23 18 33 0M19 5c10 18 23 18 33 0"/><path d="M-72 70h144"/></g>`;
}

function owner(prop) {
  const held = prop === "bottle"
    ? `<g transform="translate(185 756)"><rect x="-35" y="-75" width="70" height="132" rx="20" fill="#8fc6d5" stroke="#17364f" stroke-width="6"/><rect x="-22" y="-100" width="44" height="30" rx="8" fill="#315f77"/><path d="M-20-25h40" stroke="#fff" stroke-width="5" opacity=".7"/></g>`
    : prop === "coat"
      ? `<path d="M118 694c50-30 105-25 140 12l-16 142c-52 25-101 23-145-8z" fill="#c9b99f" stroke="#765c3a" stroke-width="6"/>`
      : `<g transform="translate(190 760)"><ellipse rx="54" ry="25" fill="#edf3f2" stroke="#1d4558" stroke-width="6"/><rect x="-48" y="-8" width="96" height="68" rx="18" fill="#d7e7e8" stroke="#1d4558" stroke-width="6"/><path d="M48 5h22c22 0 22 38 0 38H48" fill="none" stroke="#1d4558" stroke-width="7"/><path d="M-18-36c-8-13 8-18 0-30M10-36c-8-13 8-18 0-30" fill="none" stroke="#fff" stroke-width="6"/></g>`;
  return `<g transform="translate(85 315)">
    <ellipse cx="205" cy="210" rx="155" ry="165" fill="#f5c69d" stroke="#633c2c" stroke-width="7"/>
    <path d="M55 202C38 80 116 20 210 28c107 8 171 85 148 197-23-46-61-70-98-86-43 31-104 44-173 39-6 14-17 28-32 38z" fill="#171717"/>
    <path d="M75 159c42-17 70-53 86-92 15 34 43 55 78 66 31-17 61-40 81-72" fill="none" stroke="#2d2927" stroke-width="22" stroke-linecap="round"/>
    <ellipse cx="155" cy="225" rx="20" ry="30" fill="#261810"/><ellipse cx="265" cy="225" rx="20" ry="30" fill="#261810"/>
    <circle cx="149" cy="216" r="7" fill="#fff"/><circle cx="259" cy="216" r="7" fill="#fff"/>
    <path d="M167 289c29 29 61 29 89 0" fill="#fff" stroke="#8a3e2c" stroke-width="7" stroke-linecap="round"/>
    <ellipse cx="113" cy="273" rx="30" ry="16" fill="#ef8f83" opacity=".55"/><ellipse cx="304" cy="273" rx="30" ry="16" fill="#ef8f83" opacity=".55"/>
    <path d="M93 384c49-51 190-52 242 0l32 280H58z" fill="#f4ead7" stroke="#84623d" stroke-width="7"/>
    <path d="M125 402l-25 263h227l-29-263-47 28h-78z" fill="#344f2d" stroke="#1d321d" stroke-width="8"/>
    <rect x="174" y="453" width="76" height="126" rx="24" fill="#9f1f1e" stroke="#75100f" stroke-width="5"/>
    <text x="212" y="491" text-anchor="middle" font-size="27" font-weight="800" fill="#fff">仙</text><text x="212" y="528" text-anchor="middle" font-size="27" font-weight="800" fill="#fff">加</text><text x="212" y="565" text-anchor="middle" font-size="27" font-weight="800" fill="#fff">味</text>
    <path d="M310 455c75-7 91 24 81 68-8 36-38 56-70 77" fill="none" stroke="#f5c69d" stroke-width="38" stroke-linecap="round"/>
    <path d="M330 440l42-42M337 445l12-58M330 442l60-14" stroke="#633c2c" stroke-width="6" stroke-linecap="round"/>
    ${held}
  </g>`;
}

function deer() {
  return `<g transform="translate(505 830)"><ellipse cx="82" cy="95" rx="70" ry="77" fill="#c77b35" stroke="#6e3f22" stroke-width="7"/><circle cx="82" cy="25" r="63" fill="#d58a42" stroke="#6e3f22" stroke-width="7"/><path d="M52-25L25-80M52-25L10-48M112-25l25-55M112-25l40-24" fill="none" stroke="#6e3f22" stroke-width="12" stroke-linecap="round"/><ellipse cx="59" cy="21" rx="12" ry="18" fill="#2a180f"/><ellipse cx="106" cy="21" rx="12" ry="18" fill="#2a180f"/><circle cx="55" cy="16" r="4" fill="#fff"/><circle cx="102" cy="16" r="4" fill="#fff"/><ellipse cx="82" cy="48" rx="12" ry="9" fill="#2a180f"/><path d="M62 61c14 18 28 18 42 0" fill="none" stroke="#6e3f22" stroke-width="5"/><path d="M25 91c-38-10-52 8-52 29M139 92c38-8 52 10 52 31" fill="none" stroke="#c77b35" stroke-width="25" stroke-linecap="round"/><path d="M25 108c-31 1-34 22-10 39M139 109c31 1 34 22 10 39" fill="none" stroke="#6e3f22" stroke-width="5"/></g>`;
}

function turtle() {
  return `<g transform="translate(720 830)"><ellipse cx="94" cy="103" rx="84" ry="74" fill="#768e45" stroke="#42572d" stroke-width="7"/><circle cx="94" cy="28" r="62" fill="#a9b96a" stroke="#42572d" stroke-width="7"/><circle cx="70" cy="20" r="12" fill="#1f2414"/><circle cx="116" cy="20" r="12" fill="#1f2414"/><circle cx="66" cy="16" r="4" fill="#fff"/><circle cx="112" cy="16" r="4" fill="#fff"/><path d="M73 57c15 14 29 14 43 0" fill="none" stroke="#42572d" stroke-width="5"/><circle cx="70" cy="20" r="25" fill="none" stroke="#263647" stroke-width="5"/><circle cx="116" cy="20" r="25" fill="none" stroke="#263647" stroke-width="5"/><path d="M95 20h-3" stroke="#263647" stroke-width="5"/><path d="M38 95c35-25 76-25 111 0-8 43-28 65-56 69-29-4-49-26-55-69z" fill="#5f783b" stroke="#42572d" stroke-width="5"/><path d="M94 75v82M53 94l78 52M135 94l-78 52" stroke="#9dad64" stroke-width="4" opacity=".75"/><path d="M18 110c-32-4-37 25-8 38M169 110c32-4 37 25 8 38" fill="none" stroke="#a9b96a" stroke-width="23" stroke-linecap="round"/></g>`;
}

function svgFor(name) {
  const theme = THEMES[name];
  if (!theme) return null;
  const [line1, line2] = theme.title;
  const tipY = [540, 665, 790];
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff9e8"/><stop offset=".58" stop-color="#f7e8c9"/><stop offset="1" stop-color="#e7c793"/></linearGradient>
      <linearGradient id="navy" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#153a60"/><stop offset="1" stop-color="#071d34"/></linearGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#4e2c12" flood-opacity=".22"/></filter>
      <pattern id="grain" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="4" cy="5" r="1" fill="#9f6d31" opacity=".08"/><circle cx="16" cy="16" r="1" fill="#9f6d31" opacity=".06"/></pattern>
      <style>text{font-family:"Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",sans-serif}.serif{font-family:"Noto Serif CJK TC","PingFang TC","Microsoft JhengHei",serif}</style>
    </defs>
    <rect width="1254" height="1254" fill="url(#bg)"/><rect width="1254" height="1254" fill="url(#grain)"/>
    <rect x="24" y="24" width="1206" height="1206" rx="36" fill="none" stroke="#b67828" stroke-width="4"/><rect x="38" y="38" width="1178" height="1178" rx="28" fill="none" stroke="#ddb56b" stroke-width="2"/>
    <g transform="translate(60 55)"><rect width="66" height="132" rx="23" fill="#a32020" stroke="#6d1010" stroke-width="4"/><text x="33" y="40" text-anchor="middle" font-size="27" font-weight="800" fill="#fff">仙</text><text x="33" y="78" text-anchor="middle" font-size="27" font-weight="800" fill="#fff">加</text><text x="33" y="116" text-anchor="middle" font-size="27" font-weight="800" fill="#fff">味</text><text x="92" y="53" font-size="51" font-weight="900" fill="#101820">仙加味</text><text x="94" y="97" font-size="20" font-weight="600" letter-spacing="4" fill="#314258">自然・安心・好漢方</text></g>
    <g filter="url(#shadow)"><rect x="418" y="64" width="460" height="84" rx="42" fill="url(#navy)" stroke="#c58c38" stroke-width="4"/><text x="648" y="119" text-anchor="middle" font-size="41" font-weight="800" letter-spacing="4" fill="#fff4d8">${esc(theme.eyebrow)}</text></g>
    <circle cx="1085" cy="132" r="64" fill="#f6a51b"/><circle cx="1063" cy="125" r="6" fill="#6c4318"/><circle cx="1107" cy="125" r="6" fill="#6c4318"/><path d="M1065 154c14 14 28 14 42 0" fill="none" stroke="#6c4318" stroke-width="5" stroke-linecap="round"/>
    <text class="serif" x="760" y="280" text-anchor="middle" font-size="92" font-weight="900" fill="#092c52" letter-spacing="4">${esc(line1)}</text>
    <text class="serif" x="790" y="380" text-anchor="middle" font-size="72" font-weight="900" fill="#092c52" letter-spacing="3">${esc(line2)}</text>
    ${owner(theme.prop)}
    <g filter="url(#shadow)"><rect x="608" y="448" width="565" height="430" rx="38" fill="#fff9e9" stroke="#c78b35" stroke-width="5"/></g>
    ${theme.tips.map((tip, index) => `<g><circle cx="685" cy="${tipY[index]}" r="55" fill="url(#navy)" stroke="#c58c38" stroke-width="4"/>${icon(index === 0 ? theme.prop : index === 1 ? "cup" : "heart", 685, tipY[index])}<text class="serif" x="770" y="${tipY[index] + 13}" font-size="38" font-weight="800" fill="#102f4e">${esc(tip)}</text>${index < 2 ? `<path d="M645 ${tipY[index] + 68}h472" stroke="#d3a862" stroke-width="3" stroke-dasharray="6 8"/>` : ""}</g>`).join("")}
    ${deer()}${turtle()}
    <g filter="url(#shadow)"><rect x="175" y="1110" width="904" height="96" rx="48" fill="url(#navy)" stroke="#c58c38" stroke-width="4"/><text class="serif" x="627" y="1174" text-anchor="middle" font-size="43" font-weight="800" letter-spacing="3" fill="#fff2d0">${esc(theme.footer)}</text></g>
  </svg>`;
}

function originalChunks(name) {
  const base = ORIGINAL_BASES[name];
  if (!base || !require("fs").existsSync(ORIGINAL_DIR)) return [];
  return require("fs").readdirSync(ORIGINAL_DIR)
    .filter((file) => new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\d{3}\\.b64$`).test(file))
    .sort()
    .map((file) => path.join(ORIGINAL_DIR, file));
}

async function exactOriginal(name) {
  const files = originalChunks(name);
  if (!files.length) return null;
  const encoded = files.map((file) => require("fs").readFileSync(file, "utf8").trim()).join("");
  if (!encoded || /[^A-Za-z0-9+/=]/.test(encoded)) throw new Error(`原圖分段內容不完整：${name}`);
  const input = Buffer.from(encoded, "base64");
  const meta = await sharp(input).metadata();
  if (meta.width !== TARGET_SIZE || meta.height !== TARGET_SIZE) throw new Error(`原圖尺寸不是1254×1254：${name}`);
  return sharp(input).jpeg({ quality: 96, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
}

async function imageBuffer(name) {
  if (!THEMES[name]) return null;
  if (!CACHE.has(name)) {
    CACHE.set(name, (async () => {
      const original = await exactOriginal(name);
      if (original) return original;
      return sharp(Buffer.from(svgFor(name))).jpeg({ quality: 96, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
    })());
  }
  return CACHE.get(name);
}

async function info(name) {
  try {
    const files = originalChunks(name);
    const buffer = await imageBuffer(name);
    if (!buffer) return { name, ok: false, width: 0, height: 0, bytes: 0 };
    const meta = await sharp(buffer).metadata();
    return { name, ok: meta.width === TARGET_SIZE && meta.height === TARGET_SIZE, width: meta.width || 0, height: meta.height || 0, bytes: buffer.length, exactOriginalSource: files.length > 0, crispVectorFallback: files.length === 0 };
  } catch (error) {
    return { name, ok: false, width: 0, height: 0, bytes: 0, error: error.message };
  }
}

function mount(app) {
  if (!app || app.__xjwCrispCareAssetsMounted) return;
  Object.defineProperty(app, "__xjwCrispCareAssetsMounted", { value: true });
  app.get(`${ROUTE_PREFIX}/healthz`, async (_req, res) => {
    const assets = await Promise.all(Object.keys(THEMES).map(info));
    res.json({ ok: assets.every((item) => item.ok), version: VERSION, contentVersion: CONTENT_VERSION, targetSize: TARGET_SIZE, exactOriginalSourceCount: assets.filter((item) => item.exactOriginalSource).length, crispVectorFallbackCount: assets.filter((item) => item.crispVectorFallback).length, assets });
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
module.exports = { VERSION, CONTENT_VERSION, TARGET_SIZE, THEMES, ORIGINAL_DIR, ORIGINAL_BASES, originalChunks, exactOriginal, svgFor, imageBuffer, info, mount, install };
