"use strict";

/**
 * 仙加味｜官網 → LINE OA → CRM 來源歸因橋
 *
 * 目的：
 * - 只辨識官網目前正式固定的 LINE 預填句，不猜測一般使用者自行輸入的訊息。
 * - 暫存非敏感來源 metadata，並在既有 saveCRM() 的 POST payload 出站時補上來源。
 * - 不攔截、不改寫 LINE 對話回覆；不把 LINE UserID 或客戶個資寫進 GitHub。
 */

const line = require("@line/bot-sdk");

const VERSION = "2026-11-20-partner-public-entry-v9";
const requestedTtl = Number(process.env.LINE_SOURCE_ATTRIBUTION_TTL_MS || 24 * 60 * 60 * 1000);
const TTL_MS = Number.isFinite(requestedTtl) && requestedTtl > 0 ? Math.min(requestedTtl, 24 * 60 * 60 * 1000) : 24 * 60 * 60 * 1000;
const MAX_ORIGINS = 10000;
const CRM_URL = process.env.CRM_URL || "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec";
const SITE_URL = "https://ts15825868.github.io/xianjiawei/";
const origins = new Map();

// Exact current website CTA copy (site-core-v410.js and the page CTAs).
// Keep older explicit prefills below for customers returning from saved links;
// ordinary product questions must not be treated as website-source evidence.
// Exact released or staged website self-report wording; never infer a visit.
const EXPLICIT_ENTRY_PREFILLS = {
  "home": [
    "我從仙加味官網首頁進來，想了解目前產品怎麼選。",
    "我從仙加味官網進來，想詢問產品、試喝、購買或合作。"
  ],
  "choose": [
    "我從仙加味官網怎麼選頁面進來，想請你幫我比較產品。"
  ],
  "trial": [
    "我從仙加味官網試喝頁進來，想申請龜鹿飲30cc試喝組。"
  ],
  // This exact text is already the live recipes.html CTA.
  // Never attribute generic cooking questions without an explicit page source.
  "recipes": [
    "我從官網料理頁進來，想詢問產品料理與沖泡方式。"
  ],
  contact: ["我從仙加味官網聯絡頁進來，想詢問產品、規格、使用方式或購買配送。"],
  "contact-b2b": ["我從仙加味官網合作頁進來，想進行商家合作。"]
};
const CURRENT_PAGE_PREFILLS = {
  home: ["我從仙加味官網首頁進來，想了解產品與怎麼選。"],
  products: [
    "我從仙加味商品總覽進來，想了解商品規格、供貨與購買方式。",
    "我想比較仙加味目前產品與規格。",
    "我不確定仙加味目前產品怎麼選，想請你依我的使用習慣整理。",
  ],
  choose: [
    "我不確定怎麼選，想請你依我的生活方式幫我整理。",
    "我想依生活習慣比較仙加味產品。",
  ],
  brand: [
    "我從品牌故事頁進來，想認識仙加味與產品。",
    "我看完仙加味品牌故事，想了解產品與怎麼選。",
  ],
  trial: ["我想申請龜鹿飲30cc試喝組。"],
};

const PRODUCT_ENTRY_PREFILLS = [
  {
    "id": "guilu-gao",
    "label": "龜鹿膏",
    "path": "product-guilu-gao.html",
    "original": "我想了解龜鹿膏100g的使用與購買方式。",
    "message": "我從仙加味官網龜鹿膏商品頁進來，我想了解龜鹿膏100g的使用與購買方式。"
  },
  {
    "id": "guilu-drink-30",
    "label": "龜鹿飲30cc玻璃罐",
    "path": "product-guilu-drink-30cc.html",
    "original": "我想了解龜鹿飲30cc玻璃罐的使用、交期與購買方式。",
    "message": "我從仙加味官網龜鹿飲30cc玻璃罐商品頁進來，我想了解龜鹿飲30cc玻璃罐的使用、交期與購買方式。"
  },
  {
    "id": "guilu-drink-180",
    "label": "龜鹿飲180cc鋁袋",
    "path": "product-guilu-drink-180cc.html",
    "original": "我想了解龜鹿飲180cc鋁袋的使用、交期與購買方式。",
    "message": "我從仙加味官網龜鹿飲180cc鋁袋商品頁進來，我想了解龜鹿飲180cc鋁袋的使用、交期與購買方式。"
  },
  {
    "id": "luerong-fen",
    "label": "鹿茸粉",
    "path": "product-luerong-fen.html",
    "original": "我想了解鹿茸粉75g的使用與購買方式。",
    "message": "我從仙加味官網鹿茸粉商品頁進來，我想了解鹿茸粉75g的使用與購買方式。"
  }
];

// Only exact self-reported, approved public partner-food page links are attributed.
const PARTNER_ENTRY_PREFILLS = [
  {
    "id": "jinan-sisheng-siwuyin",
    "label": "參仲四物飲",
    "path": "product-jinan-siwuyin.html",
    "original": "參仲四物飲",
    "message": "我從仙加味官網參仲四物飲商品頁進來，想了解參仲四物飲的規格與購買方式。"
  },
  {
    "id": "danshen-tea-collection",
    "label": "丹參茶包系列",
    "path": "product-danshen-tea.html",
    "original": "丹參茶包系列",
    "message": "我從仙加味官網丹參茶包系列商品頁進來，想了解丹參茶包系列的規格與購買方式。"
  },
  {
    "id": "guilu-vitality",
    "label": "龜鹿活力飲（葡萄糖胺）",
    "path": "product-guilu-vitality.html",
    "original": "我想了解龜鹿活力飲（葡萄糖胺）的規格與購買方式。",
    "message": "我從仙加味官網龜鹿活力飲（葡萄糖胺）商品頁進來，想了解龜鹿活力飲（葡萄糖胺）的規格與購買方式。"
  },
  {
    "id": "uboss-sizhenbao",
    "label": "四珍寶",
    "path": "product-four-treasures.html",
    "original": "我想了解四珍寶的規格與購買方式。",
    "message": "我從仙加味官網四珍寶商品頁進來，想了解四珍寶的規格與購買方式。"
  },
  {
    "id": "royalherb-erzhenbao-64",
    "label": "二珍寶",
    "path": "product-er-zhen-bao.html",
    "original": "我想了解二珍寶的規格與購買方式。",
    "message": "我從仙加味官網二珍寶商品頁進來，想了解二珍寶的規格與購買方式。"
  },
  {
    "id": "baumann-ginseng-loquat",
    "label": "寶曼花旗參枇杷軟糖",
    "path": "product-baumann-ginseng-loquat.html",
    "original": "我想了解寶曼花旗參枇杷軟糖的規格與購買方式。",
    "message": "我從仙加味官網寶曼花旗參枇杷軟糖商品頁進來，想了解寶曼花旗參枇杷軟糖的規格與購買方式。"
  },
  {
    "id": "sun-e-ginseng-citrus",
    "label": "上裕花旗參冰橙檸檬軟糖",
    "path": "product-sun-e-ginseng-citrus.html",
    "original": "我想了解上裕花旗參冰橙檸檬軟糖的規格與購買方式。",
    "message": "我從仙加味官網上裕花旗參冰橙檸檬軟糖商品頁進來，想了解上裕花旗參冰橙檸檬軟糖的規格與購買方式。"
  }
];

const PAGE_RULES = [
  ...PRODUCT_ENTRY_PREFILLS.map(({id,label,path})=>({page:"product-"+id,label,path,campaignTag:"website-product-"+id+"-line",matches:()=>false})),
  { page: "contact", label: "聯絡頁", path: "contact.html", campaignTag: "website-contact-line", matches: () => false },
  { page: "contact-b2b", label: "合作頁", path: "contact.html#business-inquiry", campaignTag: "website-contact-b2b-line", matches: () => false },
  {
    page: "home",
    label: "首頁",
    path: "index.html",
    campaignTag: "website-home-line",
    matches: (text) => text.includes("我從仙加味官網首頁來，想先了解龜鹿系列產品"),
  },
  {
    page: "products",
    label: "產品頁",
    path: "products.html",
    campaignTag: "website-products-line",
    matches: (text) => text.includes("我正在看仙加味龜鹿產品，想了解各產品差異"),
  },
  {
    page: "choose",
    label: "怎麼選",
    path: "choose.html",
    campaignTag: "website-choose-line",
    matches: (text) => text.includes("我看過仙加味「怎麼選」頁面，想請你依我的使用情境"),
  },
  {
    page: "brand",
    label: "品牌故事",
    path: "brand.html",
    campaignTag: "website-brand-line",
    matches: (text) => text.includes("我看過仙加味品牌故事，想更了解龜鹿產品與日常使用方式"),
  },
  {
    page: "recipes",
    label: "料理頁",
    path: "recipes.html",
    campaignTag: "website-recipes-line",
    matches: () => false,
  },
  {
    page: "trial",
    label: "試喝頁",
    path: "trial.html",
    campaignTag: "website-trial-line",
    matches: (text) => text.includes("我想申請試喝，請協助我從試喝方案開始"),
  },
];

function clean(value, max = 500) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function detectWebsiteOrigin(text) {
  const value = clean(text);
  if (!value) return null;
  // Only a deliberate, exact customer self-report is a referral source.
  if (value === "我是經親友介紹認識仙加味，想申請龜鹿飲30cc試喝組。") return {
    source: "親友介紹→LINE OA", sourceEvidence: "referral_self_report",
    sourceDetail: "referral:trial", sourceLabel: "試喝頁",
    leadOrigin: `${SITE_URL}trial.html`, campaignTag: "referral-trial-line",
    capturedAt: new Date().toISOString(),
  };
  const partnerEntry = PARTNER_ENTRY_PREFILLS.find(item => item.message === value);
  if (partnerEntry) return {
    source: "官網→LINE OA",
    sourceEvidence: "website_self_report",
    sourceDetail: "website:partner-" + partnerEntry.id,
    sourceLabel: partnerEntry.label,
    leadOrigin: SITE_URL + partnerEntry.path,
    campaignTag: "website-partner-" + partnerEntry.id + "-line",
    capturedAt: new Date().toISOString(),
  };
  const productEntry = PRODUCT_ENTRY_PREFILLS.find(item => item.message === value);
  const rule = PAGE_RULES.find((item) =>
    (productEntry && item.page === 'product-'+productEntry.id) ||
    EXPLICIT_ENTRY_PREFILLS[item.page]?.includes(value) || CURRENT_PAGE_PREFILLS[item.page]?.includes(value) || item.matches(value));
  if (!rule) return null;
  // A matching CTA is not proof of a visit: the same text can be typed or
  // copied anywhere. Only explicit website self-report can be attributed.
  const explicit = Boolean(productEntry) || EXPLICIT_ENTRY_PREFILLS[rule.page]?.includes(value) || /^(?:我從仙加味(?:官網首頁|商品總覽|品牌故事頁)進來|我從仙加味官網首頁來|我看過仙加味「怎麼選」頁面|我看過仙加味品牌故事|我看完仙加味品牌故事)/.test(value);
  return {
    source: explicit ? "官網→LINE OA" : "LINE OA",
    sourceEvidence: explicit ? "website_self_report" : "prefill_match_only",
    sourceDetail: `website:${rule.page}`,
    sourceLabel: rule.label,
    leadOrigin: `${SITE_URL}${rule.path}`,
    campaignTag: rule.campaignTag,
    capturedAt: new Date().toISOString(),
  };
}

// Normalize only the exact opt-in website B2B prefill after signed capture.
function normalizeBusinessEntry(text) {
  return text === "我從仙加味官網合作頁進來，想進行商家合作。" ? "商家合作" : text;
}

// Restore the existing product inquiry text after signed capture. No new checkout route.
function normalizeProductEntry(text) {
  return PRODUCT_ENTRY_PREFILLS.find(item => item.message === text)?.original ||
    PARTNER_ENTRY_PREFILLS.find(item => item.message === text)?.original || text;
}

function cleanup(now = Date.now()) {
  for (const [userId, item] of origins) {
    if (!item || now < Number(item.capturedAtMs) || now - Number(item.capturedAtMs || 0) > TTL_MS) origins.delete(userId);
  }
}

function remember(userId, text, now = Date.now()) {
  const id = clean(userId, 250);
  if (!id) return null;
  const origin = detectWebsiteOrigin(text);
  if (!origin || !["website_self_report", "referral_self_report"].includes(origin.sourceEvidence)) return null;
  cleanup(now);
  // Preserve first explicit source during the bounded session; generic or
  // subsequent CTAs cannot overwrite it. Never persist raw messages.
  if (origins.has(id)) return { ...origins.get(id) };
  const saved = { ...origin, capturedAt: new Date(now).toISOString(), capturedAtMs: now };
  origins.set(id, saved);
  while (origins.size > MAX_ORIGINS) origins.delete(origins.keys().next().value);
  return saved;
}

function getRemembered(userId, now = Date.now()) {
  cleanup(now);
  const item = origins.get(clean(userId, 250));
  return item ? { ...item } : null;
}

// Fixed labels from verified private-chat self-reports, not raw customer text.
function ownerOriginSummary(event, now = Date.now()) {
  if (event?.source?.type !== "user" || typeof event.source.userId !== "string") return "";
  const origin = getRemembered(event.source.userId, now);
  if (!origin) return "客源：尚未取得客戶自述來源";
  return "客源：" + origin.source + "｜" + origin.sourceLabel + "（客戶自述）";
}

function isCrmRequest(input, init = {}) {
  const method = String(init.method || "GET").toUpperCase();
  if (method !== "POST") return false;
  const target = typeof input === "string" ? input : String(input?.url || "");
  if (!target) return false;
  return target === CRM_URL || target.startsWith(`${CRM_URL}?`);
}

function augmentCrmPayload(payload, now = Date.now()) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const userId = clean(payload.userId || payload.lineUserId, 250);
  const origin = getRemembered(userId, now);
  if (!origin) return payload;

  const existingSource = clean(payload.source || payload.orderSource, 200);
  // A manually specified source is authoritative, not a website hit.
  if (existingSource && existingSource !== "LINE OA") return payload;
  const source = `${origin.source}｜${origin.sourceLabel}`;

  return {
    ...payload,
    source,
    orderSource: source,
    sourceDetail: clean(payload.sourceDetail, 200) || origin.sourceDetail,
    leadOrigin: clean(payload.leadOrigin, 500) || origin.leadOrigin,
    sourceEvidence: origin.sourceEvidence,
    campaignTag: clean(payload.campaignTag || origin.campaignTag, 200),
    lineOaStatus: "connected",
  };
}

function captureEvents(body) {
  const events = Array.isArray(body?.events) ? body.events : [];
  for (const event of events) {
    // Same private-chat boundary as the actual customer order handler.
    if (event?.source?.type !== "user" || typeof event.source.userId !== "string") continue;
    if (event.type === "unfollow") { origins.delete(clean(event.source.userId,250)); continue; }
    if (event?.type !== "message" || event?.message?.type !== "text") continue;
    remember(event.source.userId, event.message.text || "");
  }
}

function installLineMiddlewareCapture() {
  if (global.__XJW_LINE_SOURCE_MIDDLEWARE_CAPTURE__) return;
  const originalMiddleware = line.middleware;
  if (typeof originalMiddleware !== "function") return;

  line.middleware = function xjwSourceAwareMiddleware(config) {
    const middleware = originalMiddleware(config);
    return function xjwSourceCapture(req, res, next) {
      return middleware(req, res, (error) => {
        if (!error) {
          try { captureEvents(req.body); }
          catch { console.warn("[XJW_SOURCE_ATTRIBUTION] capture_failed"); }
        }
        next(error);
      });
    };
  };

  global.__XJW_LINE_SOURCE_MIDDLEWARE_CAPTURE__ = true;
}

function installCrmFetchBridge() {
  if (global.__XJW_LINE_SOURCE_FETCH_BRIDGE__) return;
  if (typeof global.fetch !== "function") return;
  const originalFetch = global.fetch.bind(global);

  global.fetch = function xjwSourceAwareFetch(input, init = {}) {
    if (!isCrmRequest(input, init) || typeof init.body !== "string") {
      return originalFetch(input, init);
    }

    try {
      const parsed = JSON.parse(init.body);
      const nextPayload = augmentCrmPayload(parsed);
      if (nextPayload !== parsed) {
        return originalFetch(input, { ...init, body: JSON.stringify(nextPayload) });
      }
    } catch {
      console.warn("[XJW_SOURCE_ATTRIBUTION] crm_enrichment_failed");
    }
    return originalFetch(input, init);
  };

  global.__XJW_LINE_SOURCE_FETCH_BRIDGE__ = true;
}

installLineMiddlewareCapture();
installCrmFetchBridge();

module.exports = {
  VERSION,
  PAGE_RULES,
  PARTNER_ENTRY_PREFILLS,
  detectWebsiteOrigin,
  normalizeBusinessEntry,
  normalizeProductEntry,
  remember,
  getRemembered,
  ownerOriginSummary,
  augmentCrmPayload,
  captureEvents,
  isCrmRequest,
};
