"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const sharp = require("sharp");

const VERSION = "1.2.0";
const SITE = "https://ts15825868.github.io/xianjiawei/";
const FONT_STACK = "Noto Sans CJK TC, Noto Sans TC, PingFang TC, Microsoft JhengHei, Arial Unicode MS, sans-serif";
const CACHE_DIR = path.join(os.tmpdir(), "xjw-knowledge-cards-v120");
const pending = new Map();
let renderQueue = Promise.resolve();

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
  "hot-water": { eyebrow: "小老闆知識卡｜沖泡篇", title: ["沖泡一定要用", "滾水嗎？"], bullets: ["熱水能均勻化開即可", "不必持續煮滾", "濃淡再依口味調整"], mascot: "guide" },
  "cold-texture": { eyebrow: "小老闆知識卡｜取用篇", title: ["冷藏後變得較稠", "怎麼取用？"], bullets: ["使用乾燥湯匙", "先取需要的份量", "再用溫熱水慢慢化開"], mascot: "guide" },
  sediment: { eyebrow: "小老闆知識卡｜觀察篇", title: ["杯底有少量沉澱", "先別急著判斷"], bullets: ["先攪拌或搖勻", "觀察氣味與包裝", "有疑問再拍照詢問"], mascot: "faq" },
  color: { eyebrow: "小老闆知識卡｜比較篇", title: ["顏色深淺", "能判斷品質嗎？"], bullets: ["不能只看顏色", "要看成分與規格", "保存方式也要一起確認"], mascot: "choose" },
  serving: { eyebrow: "小老闆知識卡｜標示篇", title: ["看總重量之外", "也要看每次份量"], bullets: ["總容量是整包規格", "每次取用量是日常安排", "兩個數字要分開理解"], mascot: "choose" },
  "one-format": { eyebrow: "小老闆知識卡｜日常篇", title: ["同一天不一定要", "安排多種型態"], bullets: ["依當天情境選一種即可", "外出、沖泡、料理分開想", "簡單才容易持續"], mascot: "products" },
  "batch-info": { eyebrow: "小老闆知識卡｜收貨篇", title: ["收到商品後", "先確認哪些資訊？"], bullets: ["先看包裝是否完整", "確認品名、規格與期限", "依標示方式妥善保存"], mascot: "faq" },
  "support-photos": { eyebrow: "小老闆知識卡｜客服篇", title: ["詢問產品問題", "先拍這三張"], bullets: ["完整包裝正反面", "產品名稱與有效日期", "實際內容與保存狀況"], mascot: "faq" },
  "delivery-check": { eyebrow: "小老闆知識卡｜宅配篇", title: ["宅配外箱破損", "先怎麼處理？"], bullets: ["保留外箱與物流標籤", "拍下六面與內包裝", "帶訂單資料聯絡客服"], mascot: "faq" },
  "clean-cup": { eyebrow: "小老闆知識卡｜沖泡篇", title: ["杯子殘留咖啡味", "會影響口感"], bullets: ["先把杯子洗乾淨", "避免其他飲品氣味", "再調整自己喜歡的濃淡"], mascot: "guide" },
  "soup-balance": { eyebrow: "小老闆知識卡｜料理篇", title: ["燉湯完成後", "再調整濃淡"], bullets: ["先看整鍋水量", "少量加入再試味道", "不用一次放得很複雜"], mascot: "recipes" },
  "similar-name": { eyebrow: "小老闆知識卡｜選購篇", title: ["名稱相近的產品", "配方仍要逐項看"], bullets: ["先看完整成分", "再看規格與配料", "不要只看品名下判斷"], mascot: "choose" },
  units: { eyebrow: "小老闆知識卡｜單位篇", title: ["g 與 cc", "不能只看數字比較"], bullets: ["g 是重量，cc 是容量", "數字相同不代表相同份量", "先看單位再看使用方式"], mascot: "choose" },
  "pieces-weight": { eyebrow: "小老闆知識卡｜規格篇", title: ["片數多", "不等於總重量多"], bullets: ["片數是切分方式", "總重量是完整規格", "再看每片約重"], mascot: "products" },
  "taiwan-catty": { eyebrow: "小老闆知識卡｜換算篇", title: ["一台斤", "到底是多少公克？"], bullets: ["台灣一台斤通常是 600g", "斤數與公克一起確認", "以包裝標示為準"], mascot: "products" },
  "dissolve-speed": { eyebrow: "小老闆知識卡｜沖泡篇", title: ["化開快慢", "能判斷品質嗎？"], bullets: ["水溫會影響化開速度", "塊大小與攪拌也有差", "快慢不能單獨判斷品質"], mascot: "guide" },
  "taste-strength": { eyebrow: "小老闆知識卡｜口感篇", title: ["味道比較重", "原料就一定比較多？"], bullets: ["味道受配料與水量影響", "飲用溫度也會改變口感", "比較仍要看成分與規格"], mascot: "faq" },
  "fair-compare": { eyebrow: "小老闆知識卡｜選擇篇", title: ["比較產品前", "先了解自己的需求"], bullets: ["先看成分與規格", "選擇能融入日常的型態", "依自己的使用習慣決定"], mascot: "choose" },
  "ad-vs-label": { eyebrow: "小老闆知識卡｜標示篇", title: ["廣告圖", "不是完整產品標示"], bullets: ["廣告圖只整理重點", "完整資訊看實際包裝", "成分規格期限都要確認"], mascot: "faq" },
  "spoon-material": { eyebrow: "小老闆知識卡｜取用篇", title: ["取用重點", "不在木匙或金屬匙"], bullets: ["湯匙材質不是唯一重點", "乾淨乾燥更重要", "取用後立即密封保存"], mascot: "guide" },
};

function esc(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  }[char]));
}

async function exists(file) {
  try {
    const stat = await fs.stat(file);
    return stat.isFile() && stat.size > 1000;
  } catch {
    return false;
  }
}

function digest(value) {
  return crypto.createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 12);
}

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function mascotFile(key) {
  await ensureCacheDir();
  const url = MASCOTS[key] || MASCOTS.faq;
  const file = path.join(CACHE_DIR, `mascot-${key}-${digest(url)}.png`);
  if (await exists(file)) return file;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`mascot HTTP ${response.status}`);
  const source = Buffer.from(await response.arrayBuffer());
  const temp = `${file}.${process.pid}.tmp`;
  await sharp(source, { limitInputPixels: 64 * 1024 * 1024 })
    .resize({ width: 390, height: 350, fit: "contain", withoutEnlargement: true })
    .png({ compressionLevel: 9, effort: 7 })
    .toFile(temp);
  await fs.rename(temp, file);
  return file;
}

function svg(card) {
  const [line1, line2] = card.title;
  const bulletMarkup = card.bullets.map((item, index) => `
    <g transform="translate(0 ${index * 88})">
      <circle cx="92" cy="635" r="24" fill="#315c45"/>
      <text x="92" y="644" text-anchor="middle" font-family="${FONT_STACK}" font-size="23" font-weight="800" fill="#fff">${index + 1}</text>
      <text x="140" y="646" font-family="${FONT_STACK}" font-size="32" font-weight="700" fill="#24211d">${esc(item)}</text>
    </g>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#0b1f3b" flood-opacity="0.14"/></filter>
      <pattern id="dots" width="42" height="42" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2" fill="#d9c9a7" opacity="0.35"/></pattern>
    </defs>
    <rect width="1080" height="1350" fill="#f7f4ed"/>
    <rect width="1080" height="1350" fill="url(#dots)"/>
    <rect x="46" y="46" width="988" height="1258" rx="42" fill="#fffdf8" stroke="#d8c6a4" stroke-width="3" filter="url(#shadow)"/>
    <rect x="46" y="46" width="988" height="126" rx="42" fill="#0b1f3b"/>
    <rect x="46" y="130" width="988" height="42" fill="#0b1f3b"/>
    <text x="92" y="122" font-family="${FONT_STACK}" font-size="34" font-weight="800" fill="#fff">仙加味・龜鹿</text>
    <text x="988" y="122" text-anchor="end" font-family="${FONT_STACK}" font-size="27" font-weight="600" fill="#f4d9a0">補養，是一種節奏。</text>
    <text x="90" y="248" font-family="${FONT_STACK}" font-size="28" font-weight="800" fill="#9b2f2f">${esc(card.eyebrow)}</text>
    <text x="88" y="370" font-family="${FONT_STACK}" font-size="72" font-weight="900" fill="#0b1f3b">${esc(line1)}</text>
    <text x="88" y="466" font-family="${FONT_STACK}" font-size="72" font-weight="900" fill="#0b1f3b">${esc(line2)}</text>
    <line x1="90" y1="540" x2="990" y2="540" stroke="#d8c6a4" stroke-width="3"/>
    ${bulletMarkup}
    <rect x="566" y="842" width="428" height="350" rx="32" fill="#f2eadb" stroke="#d8c6a4" stroke-width="2"/>
    <text x="92" y="1122" font-family="${FONT_STACK}" font-size="27" font-weight="700" fill="#6b655d">看清楚內容，再依自己的日常選擇。</text>
    <rect x="88" y="1230" width="214" height="54" rx="27" fill="#9b2f2f"/>
    <text x="195" y="1267" text-anchor="middle" font-family="${FONT_STACK}" font-size="27" font-weight="800" fill="#fff">仙加味小老闆</text>
    <text x="988" y="1267" text-anchor="end" font-family="${FONT_STACK}" font-size="26" font-weight="700" fill="#315c45">LINE｜@762jybnm</text>
  </svg>`;
}

async function renderCardFile(slug) {
  const card = CARDS[slug];
  if (!card) return null;
  await ensureCacheDir();
  const file = path.join(CACHE_DIR, `${slug}-${digest({ version: VERSION, card })}.png`);
  if (await exists(file)) return file;
  if (pending.has(file)) return pending.get(file);

  const task = renderQueue
    .catch(() => undefined)
    .then(async () => {
      if (await exists(file)) return file;
      const mascot = await mascotFile(card.mascot);
      const temp = `${file}.${process.pid}.tmp`;
      try {
        await sharp(Buffer.from(svg(card)), { density: 72, limitInputPixels: 64 * 1024 * 1024 })
          .resize(1080, 1350, { fit: "fill" })
          .composite([{ input: mascot, left: 584, top: 842 }])
          .png({ compressionLevel: 9, effort: 7 })
          .toFile(temp);
      } catch (error) {
        console.warn("knowledge card mascot fallback", slug, error.message);
        await sharp(Buffer.from(svg(card)), { density: 72, limitInputPixels: 64 * 1024 * 1024 })
          .resize(1080, 1350, { fit: "fill" })
          .png({ compressionLevel: 9, effort: 7 })
          .toFile(temp);
      }
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
  CACHE_DIR,
  CARDS,
  renderCard,
  renderCardFile,
  mountKnowledgeCards,
};
