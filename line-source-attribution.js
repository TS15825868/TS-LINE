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

const VERSION = "2026-09-16-v1";
const TTL_MS = Number(process.env.LINE_SOURCE_ATTRIBUTION_TTL_MS || 24 * 60 * 60 * 1000);
const CRM_URL = process.env.CRM_URL || "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec";
const SITE_URL = "https://ts15825868.github.io/xianjiawei/";
const origins = new Map();

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
  const rule = PAGE_RULES.find((item) => item.matches(value));
  if (!rule) return null;
  return {
    source: "官網→LINE OA",
    sourceDetail: `website:${rule.page}`,
    sourceLabel: rule.label,
    leadOrigin: `${SITE_URL}${rule.path}`,
    campaignTag: rule.campaignTag,
    capturedAt: new Date().toISOString(),
  };
}

function cleanup(now = Date.now()) {
  for (const [userId, item] of origins) {
    if (!item || now - Number(item.capturedAtMs || 0) > TTL_MS) origins.delete(userId);
  }
}

function remember(userId, text, now = Date.now()) {
  const id = clean(userId, 250);
  if (!id) return null;
  const origin = detectWebsiteOrigin(text);
  if (!origin) return null;
  cleanup(now);
  const saved = { ...origin, capturedAtMs: now };
  origins.set(id, saved);
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
  const source = existingSource && existingSource !== "LINE OA"
    ? existingSource
    : `${origin.source}｜${origin.sourceLabel}`;

  return {
    ...payload,
    source,
    orderSource: source,
    sourceDetail: origin.sourceDetail,
    leadOrigin: origin.leadOrigin,
    campaignTag: clean(payload.campaignTag || origin.campaignTag, 200),
    lineOaStatus: "connected",
  };
}

function captureEvents(body) {
  const events = Array.isArray(body?.events) ? body.events : [];
  for (const event of events) {
    if (event?.type !== "message" || event?.message?.type !== "text") continue;
    remember(event?.source?.userId || "", event.message.text || "");
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
          catch (captureError) { console.warn("LINE來源歸因讀取失敗：", captureError?.message || captureError); }
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
    } catch (error) {
      console.warn("LINE CRM來源歸因補寫失敗：", error?.message || error);
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
