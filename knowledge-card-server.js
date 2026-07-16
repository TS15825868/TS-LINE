"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const sharp = require("sharp");

const VERSION = "1.4.0";
const SITE = "https://ts15825868.github.io/xianjiawei/";
const FONT_NAME = "XJW Source Han Sans TW";
const FONT_URL = "https://raw.githubusercontent.com/adobe-fonts/source-han-sans/release/SubsetOTF/TW/SourceHanSansTW-Regular.otf";
const FONT_DIR = path.join(__dirname, ".cache", "knowledge-fonts");
const FONT_FILE = path.join(FONT_DIR, "SourceHanSansTW-Regular.otf");
const CACHE_DIR = path.join(os.tmpdir(), "xjw-knowledge-cards-v140");
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

const CARDS = {
  "hot-water": { number: "01", eyebrow: "沖泡篇", title: ["沖泡一定要用", "滾水嗎？"], bullets: ["熱水能均勻化開即可", "不必持續煮滾", "濃淡再依口味調整"], mascot: "guide" },
  "cold-texture": { number: "02", eyebrow: "取用篇", title: ["冷藏後變得較稠", "怎麼取用？"], bullets: ["使用乾淨乾燥湯匙", "先取需要的份量", "再用溫熱水慢慢化開"], mascot: "guide" },
  sediment: { number: "03", eyebrow: "觀察篇", title: ["杯底有少量沉澱", "先怎麼確認？"], bullets: ["先攪拌或搖勻", "確認氣味與保存狀況", "有疑問保留包裝再詢問"], mascot: "faq" },
  color: { number: "04", eyebrow: "選購篇", title: ["顏色深淺", "能判斷內容嗎？"], bullets: ["不能只看顏色", "要看成分與規格", "保存與製作方式也要確認"], mascot: "choose" },
  serving: { number: "05", eyebrow: "標示篇", title: ["看總重量之外", "也要看每次份量"], bullets: ["總重量是完整規格", "每次份量是日常安排", "兩個數字要分開理解"], mascot: "choose" },
  "one-format": { number: "06", eyebrow: "日常篇", title: ["同一天不一定要", "安排多種型態"], bullets: ["依當天情境選一種即可", "外出沖泡料理分開想", "簡單才容易持續"], mascot: "products" },
  "batch-info": { number: "07", eyebrow: "收貨篇", title: ["收到商品後", "先確認哪些資訊？"], bullets: ["先看包裝是否完整", "確認品名規格與期限", "依標示方式妥善保存"], mascot: "faq" },
  "support-photos": { number: "08", eyebrow: "客服篇", title: ["詢問產品問題", "先拍這三張"], bullets: ["完整包裝正反面", "產品名稱與有效日期", "實際內容與保存狀況"], mascot: "faq" },
  "delivery-check": { number: "09", eyebrow: "宅配篇", title: ["宅配外箱破損", "先怎麼處理？"], bullets: ["保留外箱與物流標籤", "拍下六面與內包裝", "帶訂單資料聯絡客服"], mascot: "faq" },
  "clean-cup": { number: "10", eyebrow: "沖泡篇", title: ["杯子殘留氣味", "會影響口感"], bullets: ["先把杯子洗乾淨", "避免其他飲品氣味", "再調整喜歡的濃淡"], mascot: "guide" },
  "soup-balance": { number: "11", eyebrow: "料理篇", title: ["燉湯完成後", "再調整濃淡"], bullets: ["先看整鍋水量", "少量加入再試味道", "不用一次放得很複雜"], mascot: "recipes" },
  "similar-name": { number: "12", eyebrow: "選購篇", title: ["名稱相近的產品", "內容仍要逐項看"], bullets: ["先看完整成分", "再看規格與配料", "不要只看品名下判斷"], mascot: "choose" },
  units: { number: "13", eyebrow: "單位篇", title: ["g 與 cc", "不能只看數字比較"], bullets: ["g 是重量 cc 是容量", "數字相同不代表同份量", "先看單位再看使用方式"], mascot: "choose" },
  "pieces-weight": { number: "14", eyebrow: "規格篇", title: ["片數比較多", "不等於總重量多"], bullets: ["片數是切分方式", "總重量是完整規格", "再一起看每片約重"], mascot: "products" },
  "taiwan-catty": { number: "15", eyebrow: "換算篇", title: ["一台斤", "是多少公克？"], bullets: ["台灣一台斤通常是 600g", "斤數與公克一起確認", "以包裝標示為準"], mascot: "products" },
  "dissolve-speed": { number: "16", eyebrow: "沖泡篇", title: ["化開快慢", "不能單獨判斷內容"], bullets: ["水溫會影響化開速度", "塊大小與攪拌也有差", "先統一沖泡條件再觀察"], mascot: "guide" },
  "taste-strength": { number: "17", eyebrow: "口感篇", title: ["味道濃淡", "不能代表原料多寡"], bullets: ["配料與水量會影響", "飲用溫度也會改變口感", "比較仍要看成分與規格"], mascot: "faq" },
  "fair-compare": { number: "18", eyebrow: "選擇篇", title: ["比較產品前", "先了解自己的需求"], bullets: ["先看成分與規格", "選擇能融入日常的型態", "依自己的使用習慣決定"], mascot: "choose" },
  "ad-vs-label": { number: "19", eyebrow: "標示篇", title: ["廣告圖", "不是完整產品標示"], bullets: ["廣告圖只整理重點", "完整資訊看實際包裝", "成分規格期限都要確認"], mascot: "faq" },
  "spoon-material": { number: "20", eyebrow: "取用篇", title: ["取用重點", "是乾淨與乾燥"], bullets: ["湯匙材質不是唯一重點", "乾淨乾燥更重要", "取用後立即密封保存"], mascot: "guide" },
};

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

async function mascotFile(key) {
  await ensureCacheDir();
  const url = MASCOTS[key] || MASCOTS.faq;
  const file = path.join(CACHE_DIR, `mascot-${key}-${digest(url)}.png`);
  if (await exists(file)) return file;
  const source = await fetchBuffer(url);
  const temp = `${file}.${process.pid}.tmp`;
  await sharp(source, { limitInputPixels: 64 * 1024 * 1024 })
    .resize({ width: 390, height: 350, fit: "contain", withoutEnlargement: true })
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
    color: "#24211d",
    ...style,
  }, String(value));
}

function cardElement(card) {
  const bullets = card.bullets.map((item, index) => element("div", {
    position: "absolute",
    left: 88,
    top: 602 + index * 102,
    width: 492,
    height: 78,
    display: "flex",
    alignItems: "center",
  }, [
    element("div", {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: "#315c45",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }, text(index + 1, { color: "#ffffff", fontSize: 23, fontWeight: 700 })),
    text(item, { marginLeft: 20, fontSize: 31, fontWeight: 700, lineHeight: 1.25 }),
  ]));

  return element("div", {
    width: 1080,
    height: 1350,
    position: "relative",
    display: "flex",
    backgroundColor: "#f7f4ed",
    fontFamily: FONT_NAME,
  }, [
    element("div", {
      position: "absolute",
      left: 46,
      top: 46,
      width: 988,
      height: 1258,
      borderRadius: 42,
      backgroundColor: "#fffdf8",
      border: "3px solid #d8c6a4",
      display: "flex",
    }, []),
    element("div", {
      position: "absolute",
      left: 46,
      top: 46,
      width: 988,
      height: 126,
      borderRadius: 42,
      backgroundColor: "#0b1f3b",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      paddingLeft: 46,
      paddingRight: 46,
    }, [
      text("仙加味・龜鹿", { color: "#ffffff", fontSize: 34, fontWeight: 700 }),
      text("補養，是一種節奏。", { color: "#f4d9a0", fontSize: 27, fontWeight: 700 }),
    ]),
    element("div", {
      position: "absolute",
      left: 88,
      top: 205,
      width: 245,
      height: 54,
      borderRadius: 27,
      backgroundColor: "#9b2f2f",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }, text(`小老闆知識 ${card.number}`, { color: "#ffffff", fontSize: 25, fontWeight: 700 })),
    text(card.eyebrow, {
      position: "absolute",
      left: 360,
      top: 217,
      fontSize: 27,
      fontWeight: 700,
      color: "#315c45",
    }),
    text(card.title[0], {
      position: "absolute",
      left: 88,
      top: 315,
      fontSize: 68,
      fontWeight: 700,
      color: "#0b1f3b",
      letterSpacing: -1,
    }),
    text(card.title[1], {
      position: "absolute",
      left: 88,
      top: 408,
      fontSize: 68,
      fontWeight: 700,
      color: "#0b1f3b",
      letterSpacing: -1,
    }),
    element("div", {
      position: "absolute",
      left: 90,
      top: 548,
      width: 900,
      height: 3,
      backgroundColor: "#d8c6a4",
      display: "flex",
    }, []),
    ...bullets,
    element("div", {
      position: "absolute",
      left: 566,
      top: 858,
      width: 428,
      height: 350,
      borderRadius: 32,
      backgroundColor: "#f2eadb",
      border: "2px solid #d8c6a4",
      display: "flex",
    }, []),
    text("看清楚內容，再依自己的日常選擇。", {
      position: "absolute",
      left: 92,
      top: 1096,
      fontSize: 27,
      fontWeight: 700,
      color: "#6b655d",
    }),
    element("div", {
      position: "absolute",
      left: 88,
      top: 1230,
      width: 214,
      height: 54,
      borderRadius: 27,
      backgroundColor: "#9b2f2f",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }, text("仙加味小老闆", { color: "#ffffff", fontSize: 27, fontWeight: 700 })),
    text("LINE｜@762jybnm", {
      position: "absolute",
      right: 92,
      top: 1244,
      fontSize: 26,
      fontWeight: 700,
      color: "#315c45",
    }),
  ], { lang: "zh-TW" });
}

async function renderCardSvg(slug) {
  const card = CARDS[slug];
  if (!card) return null;
  const [satori, font] = await Promise.all([satoriRenderer(), fontData()]);
  return satori(cardElement(card), {
    width: 1080,
    height: 1350,
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
    const [svg, mascot] = await Promise.all([renderCardSvg(slug), mascotFile(card.mascot)]);
    if (!svg) throw new Error(`unknown knowledge card: ${slug}`);
    if (svg.includes("<text")) throw new Error("knowledge card font was not embedded as paths");
    const temp = `${file}.${process.pid}.tmp`;
    await sharp(Buffer.from(svg), { density: 72, limitInputPixels: 64 * 1024 * 1024 })
      .resize(1080, 1350, { fit: "fill" })
      .composite([{ input: mascot, left: 584, top: 858 }])
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
