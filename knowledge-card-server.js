"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const sharp = require("sharp");
const { TOPICS } = require("./social-official-rebuild");

const VERSION = "2.0.0";
const SITE = "https://ts15825868.github.io/xianjiawei/";
const FONT_NAME = "XJW Source Han Sans TW";
const FONT_URL = "https://raw.githubusercontent.com/adobe-fonts/source-han-sans/release/SubsetOTF/TW/SourceHanSansTW-Regular.otf";
const FONT_DIR = path.join(__dirname, ".cache", "knowledge-fonts");
const FONT_FILE = path.join(FONT_DIR, "SourceHanSansTW-Regular.otf");
const CACHE_DIR = path.join(os.tmpdir(), "xjw-knowledge-cards-v200");
const pending = new Map();
let renderQueue = Promise.resolve();
let fontPromise = null;
let satoriPromise = null;

sharp.cache(false);
sharp.concurrency(1);

const MASCOTS = {
  faq: `${SITE}images/brand/approved-v405/faq.webp?v=408.7`,
  guide: `${SITE}images/brand/approved-v405/guide-how-to-use.webp?v=408.7`,
  choose: `${SITE}images/brand/approved-v405/choose.webp?v=408.7`,
  products: `${SITE}images/brand/approved-v405/products-all.webp?v=408.7`,
  brand: `${SITE}images/brand/approved-v405/brand-story.webp?v=408.7`,
  recipes: `${SITE}images/brand/approved-v405/recipes.webp?v=408.7`,
};

const EYEBROWS = [
  "日常篇", "早晨篇", "午後篇", "情境篇", "型態篇", "規格篇",
  "單位篇", "換算篇", "規格篇", "份量篇", "型態篇", "成分篇",
  "沖泡篇", "口感篇", "風味篇", "沖泡篇", "保存篇", "保存篇",
  "收貨篇", "確認篇", "選購篇", "標示篇", "品牌篇", "資訊篇",
  "分享篇", "情境篇", "選擇篇", "選購篇", "日常篇", "沖泡篇",
];

const MASCOT_KEYS = [
  "brand", "guide", "guide", "choose", "products", "products",
  "choose", "products", "products", "choose", "products", "choose",
  "recipes", "guide", "recipes", "guide", "faq", "faq", "faq", "faq",
  "choose", "choose", "brand", "faq", "brand", "choose", "products", "choose", "guide", "guide",
];

const CARDS = Object.fromEntries(TOPICS.map((topic, index) => [topic.slug, {
  number: String(topic.number).padStart(2, "0"),
  eyebrow: EYEBROWS[index],
  title: splitTitle(topic.title),
  bullets: topic.bullets,
  mascot: MASCOT_KEYS[index],
}]));

function splitTitle(value) {
  const title = String(value || "").trim();
  const punctuation = ["，", "：", "？"];
  for (const mark of punctuation) {
    const at = title.indexOf(mark);
    if (at >= 4 && at <= 13) {
      return [title.slice(0, at + 1), title.slice(at + 1)];
    }
  }
  if (title.length <= 12) return [title, ""];
  const cut = Math.min(12, Math.max(7, Math.ceil(title.length / 2)));
  return [title.slice(0, cut), title.slice(cut)];
}

async function exists(file, minimum = 1000) {
  try {
    const stat = await fs.stat(file);
    return stat.isFile() && stat.size >= minimum;
  } catch {
    return false;
  }
}

function digest(value) {
  return crypto.createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 12);
}

async function atomicWrite(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, data);
  await fs.rename(temp, file);
}

async function fetchBuffer(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length) throw new Error("empty response");
      return buffer;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 700));
    }
  }
  throw lastError;
}

async function ensureFont() {
  if (await exists(FONT_FILE, 1024 * 1024)) return FONT_FILE;
  const font = await fetchBuffer(FONT_URL);
  if (font.length < 1024 * 1024) throw new Error(`Traditional Chinese font incomplete: ${font.length}`);
  await atomicWrite(FONT_FILE, font);
  return FONT_FILE;
}

async function fontData() {
  if (!fontPromise) {
    fontPromise = ensureFont().then((file) => fs.readFile(file)).catch((error) => {
      fontPromise = null;
      throw error;
    });
  }
  return fontPromise;
}

async function satoriRenderer() {
  if (!satoriPromise) {
    satoriPromise = import("satori").then((module) => module.default || module).catch((error) => {
      satoriPromise = null;
      throw error;
    });
  }
  return satoriPromise;
}

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function sourceBuffer(key) {
  await ensureCacheDir();
  const url = MASCOTS[key] || MASCOTS.faq;
  const file = path.join(CACHE_DIR, `source-${key}-${digest(url)}.webp`);
  if (await exists(file)) return fs.readFile(file);
  const source = await fetchBuffer(url);
  await atomicWrite(file, source);
  return source;
}

async function sceneFile(key) {
  await ensureCacheDir();
  const file = path.join(CACHE_DIR, `scene-${key}-${VERSION}.png`);
  if (await exists(file)) return file;
  const source = await sourceBuffer(key);
  const temp = `${file}.${process.pid}.tmp`;
  await sharp(source, { limitInputPixels: 64 * 1024 * 1024 })
    .resize(1080, 1080, { fit: "cover", position: "attention" })
    .blur(3.2)
    .modulate({ brightness: 0.48, saturation: 0.72 })
    .png({ compressionLevel: 9, effort: 5 })
    .toFile(temp);
  await fs.rename(temp, file);
  return file;
}

async function mascotFile(key) {
  await ensureCacheDir();
  const file = path.join(CACHE_DIR, `mascot-integrated-${key}-${VERSION}.png`);
  if (await exists(file)) return file;
  const source = await sourceBuffer(key);
  const width = 560;
  const height = 650;
  const mask = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="black" stop-opacity="0"/><stop offset="0.18" stop-color="white" stop-opacity="0.82"/><stop offset="0.34" stop-color="white"/><stop offset="1" stop-color="white"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#fade)"/></svg>`);
  const temp = `${file}.${process.pid}.tmp`;
  await sharp(source, { limitInputPixels: 64 * 1024 * 1024 })
    .resize(width, height, { fit: "cover", position: "right" })
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png({ compressionLevel: 9, effort: 5 })
    .toFile(temp);
  await fs.rename(temp, file);
  return file;
}

function element(type, style, children, attributes = {}) {
  const list = Array.isArray(children) ? children : children == null ? [] : [children];
  return {
    type,
    props: {
      ...attributes,
      style,
      children: list.length === 1 ? list[0] : list,
    },
  };
}

function text(value, style = {}) {
  return element("div", {
    display: "flex",
    fontFamily: FONT_NAME,
    fontWeight: 400,
    color: "#251e18",
    ...style,
  }, String(value));
}

function cardElement(card) {
  const bullets = card.bullets.map((item, index) => element("div", {
    position: "absolute",
    left: 92,
    top: 475 + index * 135,
    width: 505,
    minHeight: 100,
    display: "flex",
    alignItems: "flex-start",
  }, [
    element("div", {
      flexShrink: 0,
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: "#314d22",
      border: "2px solid #c9a65a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }, text(`${index + 1}.`, { color: "#fff8e8", fontSize: 28, fontWeight: 700 })),
    text(item, {
      marginLeft: 22,
      width: 420,
      fontSize: 31,
      fontWeight: 700,
      lineHeight: 1.35,
      whiteSpace: "pre-wrap",
    }),
  ]));

  return element("div", {
    width: 1080,
    height: 1080,
    position: "relative",
    display: "flex",
    fontFamily: FONT_NAME,
  }, [
    element("div", {
      position: "absolute",
      inset: 28,
      border: "3px solid #d4ad5d",
      borderRadius: 34,
      display: "flex",
    }, []),
    element("div", {
      position: "absolute",
      left: 38,
      top: 36,
      width: 1004,
      height: 250,
      borderRadius: 30,
      backgroundColor: "#071b32",
      border: "3px solid #d4ad5d",
      display: "flex",
    }, []),
    element("div", {
      position: "absolute",
      left: 74,
      top: 76,
      width: 82,
      height: 126,
      borderRadius: 28,
      backgroundColor: "#9b2727",
      border: "3px solid #d4ad5d",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }, text("仙\n加\n味", { color: "#fff4dd", fontSize: 27, fontWeight: 700, lineHeight: 1.12, whiteSpace: "pre-wrap", textAlign: "center" })),
    text(card.title[0], {
      position: "absolute",
      left: 190,
      top: card.title[1] ? 66 : 105,
      width: 800,
      justifyContent: "center",
      color: "#fff2d6",
      fontSize: card.title[0].length > 13 ? 50 : 61,
      fontWeight: 700,
      letterSpacing: 1,
    }),
    card.title[1] ? text(card.title[1], {
      position: "absolute",
      left: 190,
      top: 145,
      width: 800,
      justifyContent: "center",
      color: "#fff2d6",
      fontSize: card.title[1].length > 13 ? 50 : 61,
      fontWeight: 700,
      letterSpacing: 1,
    }) : null,
    element("div", {
      position: "absolute",
      left: 46,
      top: 284,
      width: 988,
      height: 674,
      borderRadius: 38,
      backgroundColor: "#f8eedc",
      border: "3px solid #d2b779",
      display: "flex",
    }, []),
    element("div", {
      position: "absolute",
      left: 340,
      top: 262,
      width: 400,
      height: 72,
      borderRadius: 36,
      backgroundColor: "#314d22",
      border: "3px solid #d4ad5d",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }, text(`小老闆知識卡 ${card.number}`, { color: "#fff4dd", fontSize: 32, fontWeight: 700 })),
    text(card.eyebrow, {
      position: "absolute",
      left: 92,
      top: 375,
      color: "#7a221f",
      fontSize: 30,
      fontWeight: 700,
    }),
    element("div", {
      position: "absolute",
      left: 92,
      top: 428,
      width: 500,
      height: 2,
      backgroundColor: "#c9a65a",
      display: "flex",
    }, []),
    ...bullets,
    element("div", {
      position: "absolute",
      left: 112,
      top: 852,
      width: 475,
      height: 78,
      borderRadius: 18,
      backgroundColor: "#fff9ed",
      border: "2px solid #b99b5f",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }, text("先看需求，再做選擇。", { color: "#314d22", fontSize: 31, fontWeight: 700 })),
    element("div", {
      position: "absolute",
      left: 38,
      top: 954,
      width: 1004,
      height: 92,
      borderRadius: 24,
      backgroundColor: "#243b1d",
      border: "3px solid #d4ad5d",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }, text("仙加味・龜鹿｜補養，是一種節奏。", { color: "#f5d9a0", fontSize: 35, fontWeight: 700 })),
  ].filter(Boolean), { lang: "zh-TW" });
}

async function renderCardSvg(slug) {
  const card = CARDS[slug];
  if (!card) return null;
  const [satori, font] = await Promise.all([satoriRenderer(), fontData()]);
  return satori(cardElement(card), {
    width: 1080,
    height: 1080,
    embedFont: true,
    fonts: [
      { name: FONT_NAME, data: font, weight: 400, style: "normal" },
      { name: FONT_NAME, data: font, weight: 700, style: "normal" },
    ],
  });
}

async function renderCardFile(slug) {
  const card = CARDS[slug];
  if (!card) return null;
  await ensureCacheDir();
  const file = path.join(CACHE_DIR, `${slug}-${digest({ version: VERSION, font: FONT_URL, card })}.png`);
  if (await exists(file)) return file;
  if (pending.has(file)) return pending.get(file);

  const task = renderQueue.catch(() => undefined).then(async () => {
    if (await exists(file)) return file;
    const [svg, scene, mascot] = await Promise.all([
      renderCardSvg(slug),
      sceneFile(card.mascot),
      mascotFile(card.mascot),
    ]);
    if (!svg) throw new Error(`unknown knowledge card: ${slug}`);
    if (svg.includes("<text")) throw new Error("knowledge card font was not embedded as paths");
    const temp = `${file}.${process.pid}.tmp`;
    await sharp(scene, { limitInputPixels: 64 * 1024 * 1024 })
      .composite([
        { input: Buffer.from(svg), left: 0, top: 0 },
        { input: mascot, left: 510, top: 314 },
      ])
      .png({ compressionLevel: 9, effort: 5 })
      .toFile(temp);
    await fs.rename(temp, file);
    return file;
  });

  renderQueue = task;
  pending.set(file, task);
  try {
    return await task;
  } finally {
    pending.delete(file);
  }
}

async function renderCard(slug) {
  const file = await renderCardFile(slug);
  return file ? fs.readFile(file) : null;
}

function mountKnowledgeCards(app) {
  app.get("/social-assets/knowledge/:slug.png", async (req, res) => {
    try {
      const file = await renderCardFile(String(req.params.slug || ""));
      if (!file) return res.status(404).send("not found");
      res.set({
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=604800, immutable",
        "X-XJW-Knowledge-Card": VERSION,
        "X-XJW-Font-Mode": "embedded-glyph-paths",
        "X-XJW-Layout": "approved-integrated-square",
      });
      return res.sendFile(file);
    } catch (error) {
      console.error("knowledge card render failed", error);
      return res.status(500).send("image render failed");
    }
  });
}

module.exports = {
  VERSION,
  FONT_URL,
  FONT_FILE,
  CACHE_DIR,
  CARDS,
  ensureFont,
  renderCardSvg,
  renderCard,
  renderCardFile,
  mountKnowledgeCards,
};
