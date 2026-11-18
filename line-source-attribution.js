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

const VERSION = "2026-11-18-explicit-source-evidence-v3";
const requestedTtl = Number(process.env.LINE_SOURCE_ATTRIBUTION_TTL_MS || 24 * 60 * 60 * 1000);
const TTL_MS = Number.isFinite(requestedTtl) && requestedTtl > 0 ? Math.min(requestedTtl, 24 * 60 * 60 * 1000) : 24 * 60 * 60 * 1000;
const MAX_ORIGINS = 10000;
const CRM_URL = process.env.CRM_URL || "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec";
const SITE_URL = "https://ts15825868.github.io/xianjiawei/";
const origins = new Map();

// Exact current website CTA copy (site-core-v410.js and the page CTAs).
// Keep older explicit prefills below for customers returning from saved links;
// ordinary product questions must not be treated as website-source evidence.
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

const PAGE_RULES = [
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
  const rule = PAGE_RULES.find((item) =>
    CURRENT_PAGE_PREFILLS[item.page]?.includes(value) || item.matches(value));
  if (!rule) return null;
  // A matching CTA is not proof of a visit: the same text can be typed or
  // copied anywhere. Only explicit website self-report can be attributed.
  const explicit = /^(?:我從仙加味(?:官網首頁|商品總覽|品牌故事頁)進來|我從仙加味官網首頁來|我看過仙加味「怎麼選」頁面|我看過仙加味品牌故事|我看完仙加味品牌故事)/.test(value);
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

function cleanup(now = Date.now()) {
  for (const [userId, item] of origins) {
    if (!item || now < Number(item.capturedAtMs) || now - Number(item.capturedAtMs || 0) > TTL_MS) origins.delete(userId);
  }
}

function remember(userId, text, now = Date.now()) {
  const id = clean(userId, 250);
  if (!id) return null;
  const origin = detectWebsiteOrigin(text);
  if (!origin || origin.sourceEvidence !== "website_self_report") return null;
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
  detectWebsiteOrigin,
  remember,
  getRemembered,
  augmentCrmPayload,
  captureEvents,
  isCrmRequest,
};
