"use strict";

const fs = require("fs");
const path = require("path");

const originalReadFileSync = fs.readFileSync.bind(fs);
const masterPath = path.join(__dirname, "line-sales-master.json");
let master = null;

// 正式主檔管理售價、活動，以及已由老闆確認的產品名稱／包裝識別。
// 產品圖片與一般介紹仍沿用官網共用目錄；只有明確列在主檔的欄位才會覆蓋。
const SALES_OVERRIDE_FIELDS = Object.freeze([
  "name",
  "displayName",
  "specification",
  "size",
  "spec",
  "unit",
  "description",
  "usage",
  "storage",
  "fit",
  "purposeDirection",
  "aliases",
  "price",
  "originalPrice",
  "offers",
  "priceText",
  "originalPriceText",
  "priceLabel",
  "quoteOnly",
]);

function getMaster() {
  if (master) return master;
  master = JSON.parse(originalReadFileSync(masterPath, "utf8"));
  return master;
}

function rootCombos(comboOffers = []) {
  return comboOffers.map((combo) => ({
    id: combo.id,
    name: combo.name,
    aliases: combo.aliases || [],
    items: combo.items || [],
    gift: combo.gift || "",
    desc: combo.desc || "",
    unit: combo.unit || "組",
    products: combo.products || [],
    quantityOptions: combo.quantityOptions || [1, 2, 3, 5],
    priceNote: "實際組合金額由正式產品建議售價計算；活動與通路條件請洽客服確認。",
  }));
}

function normalizeProductOffers(product, override = {}) {
  const raw = Array.isArray(override.offers) ? override.offers : (Array.isArray(product.offers) ? product.offers : []);
  const price = Number(override.price ?? product.price ?? 0);
  const offers = [];
  const promotionTexts = [];

  for (const entry of raw) {
    if (entry && typeof entry === "object") {
      const qty = Number(entry.qty || 0);
      const total = Number(entry.total || 0);
      const label = String(entry.label || "").trim();
      if (qty > 0 && total >= 0 && label) offers.push({ qty, total, label });
      continue;
    }

    const label = String(entry || "").trim();
    if (!label) continue;
    promotionTexts.push(label);
    if (/買\s*10\s*送\s*2/.test(label) && price > 0) {
      offers.push({ qty: 12, total: price * 10, label: "買10送2" });
    }
  }

  return { offers, promotionTexts };
}

function salesOverride(override = {}) {
  return Object.fromEntries(
    SALES_OVERRIDE_FIELDS
      .filter((field) => override[field] !== undefined)
      .map((field) => [field, override[field]])
  );
}

function applyMaster(data) {
  const policy = getMaster();
  const productOverrides = policy.products || {};
  const comboOffers = Array.isArray(policy.comboOffers) ? policy.comboOffers : [];

  data.products = (data.products || []).map((product) => {
    const rawOverride = productOverrides[product.id] || {};
    const override = salesOverride(rawOverride);
    const normalized = normalizeProductOffers(product, override);
    const quantityOptions = [...new Set([
      ...(Array.isArray(product.quantityOptions) ? product.quantityOptions : [1, 2, 3, 5]),
      ...normalized.offers.map((offer) => offer.qty),
    ].map(Number).filter((value) => Number.isFinite(value) && value > 0))];

    return {
      ...product,
      ...override,
      offers: normalized.offers,
      promotionTexts: normalized.promotionTexts,
      quantityOptions,
    };
  });

  data.offers = {
    ...(data.offers || {}),
    comboOffers,
  };
  data.combos = rootCombos(comboOffers);
  data.retentionOffers = {
    ...(data.retentionOffers || {}),
    combos: Object.fromEntries(comboOffers.map((combo) => [
      combo.name,
      "可依組合內容、數量與需求協助整理較適合的方案。",
    ])),
  };

  data.runtime = {
    ...(data.runtime || {}),
    imagePolicy: {
      ...((data.runtime || {}).imagePolicy || {}),
      ...(policy.imagePolicy || {}),
    },
    contentApproval: {
      mode: "review-only",
      defaultStatus: "pending_review",
      scheduleRequiresApproval: true,
      publishRequiresApproval: true,
    },
  };
  data.salesMasterVersion = policy.version;
  data.salesMasterSource = policy.source;
  return data;
}

fs.readFileSync = function patchedReadFileSync(file, ...args) {
  const result = originalReadFileSync(file, ...args);
  try {
    const resolved = path.resolve(String(file));
    if (resolved === path.join(__dirname, "data.json")) {
      const encoding = typeof args[0] === "string" ? args[0] : args[0]?.encoding;
      const text = Buffer.isBuffer(result) ? result.toString(encoding || "utf8") : String(result);
      return JSON.stringify(applyMaster(JSON.parse(text)), null, 2);
    }
  } catch (error) {
    console.error("仙加味售價主檔套用失敗：" + error.message);
    throw error;
  }
  return result;
};

module.exports = {
  applyMaster,
  getMaster,
  rootCombos,
  normalizeProductOffers,
  salesOverride,
  SALES_OVERRIDE_FIELDS,
};
