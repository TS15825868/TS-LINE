"use strict";

const fs = require("fs");
const path = require("path");

const originalReadFileSync = fs.readFileSync.bind(fs);
const masterPath = path.join(__dirname, "line-sales-master.json");
const currentAuthorityPath = path.join(__dirname, "assets/data/official-products.json");
const photoAuthorityPath = path.join(__dirname, "line-product-photo-authority.json");
let master = null;
let currentAuthority = null;
let photoAuthority = null;

const SALES_OVERRIDE_FIELDS = Object.freeze([
  "name", "displayName", "specification", "size", "spec", "unit",
  "description", "ingredients", "usage", "storage", "fit", "purposeDirection", "aliases",
  "price", "originalPrice", "offers", "priceText", "originalPriceText",
  "priceLabel", "quoteOnly",
  "fulfillmentType", "fulfillmentNotice", "productionLeadTime", "readyStock",
  "image", "imageUrl", "image_url", "dmImage", "officialOriginalImage", "imagePolicy", "physicalScalePolicy",
]);

const FORMAL_PRODUCT_COPY = Object.freeze({});
const RETIRED_COPY_REPLACEMENTS = Object.freeze([
  [/每日早上及下午各一小匙/g, "一天一次一小匙"],
  [/早晚各一小匙/g, "一天一次一小匙"],
  [/75g／盒｜8塊裝｜每塊約9\.375g/g, "75g／盒｜8塊裝"],
  [/75g深藍盒、8塊裝、每塊約9\.375g/g, "75g深藍盒、8塊裝"],
  [/600g（1斤）／盒｜32塊裝｜每塊約18\.75g/g, "600g／盒｜32塊裝"],
  [/600g一斤淡紫盒/g, "600g淡紫盒"],
  [/一斤大規格/g, "600g大規格"],
]);

function sanitizeCurrentCopy(value) {
  if (Array.isArray(value)) return value.map(sanitizeCurrentCopy);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key,item]) => [key, sanitizeCurrentCopy(item)]));
  if (typeof value !== "string") return value;
  return RETIRED_COPY_REPLACEMENTS.reduce((text,[pattern,replacement]) => text.replace(pattern,replacement), value);
}

function getMaster() {
  if (master) return master;
  master = JSON.parse(originalReadFileSync(masterPath, "utf8"));
  return master;
}
function getCurrentAuthority() {
  if (currentAuthority) return currentAuthority;
  currentAuthority = JSON.parse(originalReadFileSync(currentAuthorityPath, "utf8"));
  return currentAuthority;
}
function getPhotoAuthority() {
  if (photoAuthority) return photoAuthority;
  photoAuthority = JSON.parse(originalReadFileSync(photoAuthorityPath, "utf8"));
  return photoAuthority;
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
    priceNote: "實際組合金額由正式產品售價計算；活動與通路條件請洽客服確認。",
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
      const label = String(entry.label || "").trim().replace(/買\s*10\s*送\s*2/g, "買10送1");
      if (qty > 0 && total >= 0 && label) offers.push({ qty: label === "買10送1" ? 11 : qty, total, label });
      continue;
    }
    const originalLabel = String(entry || "").trim();
    if (!originalLabel) continue;
    const label = originalLabel.replace(/買\s*10\s*送\s*2/g, "買10送1");
    promotionTexts.push(label);
    if (/買\s*10\s*送\s*1/.test(label) && price > 0) offers.push({ qty: 11, total: price * 10, label: "買10送1" });
  }
  return { offers, promotionTexts };
}

function salesOverride(override = {}) {
  return Object.fromEntries(SALES_OVERRIDE_FIELDS.filter((field) => override[field] !== undefined).map((field) => [field, sanitizeCurrentCopy(override[field])]));
}
function formalCopy(id, value = {}) {
  return { ...value, ...(FORMAL_PRODUCT_COPY[id] || {}) };
}
function authorityProduct(id) {
  return (getCurrentAuthority().products || []).find((item) => item.id === id) || null;
}
function currentAuthorityOverride(id, merged = {}) {
  const official = authorityProduct(id);
  if (!official) throw new Error(`${id} 缺少目前正式產品權威`);
  const spec = String(official.specification || "").trim();
  const usage = (Array.isArray(merged.usage) ? [...merged.usage] : []).map(sanitizeCurrentCopy);
  if (official.usagePrimary) {
    if (usage.length) usage[0] = official.usagePrimary;
    else usage.push(official.usagePrimary);
  }
  const aliases = (Array.isArray(merged.aliases) ? merged.aliases : [])
    .map((value) => sanitizeCurrentCopy(String(value || "").trim()))
    .filter(Boolean)
    .filter((value) => id !== "guilu-drink-30" || !/瓶/.test(value))
    .filter((value) => id !== "guilu-jiao" || !/^一斤$/.test(value));
  const cleaned = sanitizeCurrentCopy({
    description: merged.description,
    storage: merged.storage,
    fit: merged.fit,
    purposeDirection: merged.purposeDirection,
    physicalScalePolicy: merged.physicalScalePolicy,
  });
  return {
    name: official.name,
    displayName: official.name,
    specification: spec,
    size: spec,
    spec,
    ingredients: official.ingredients || merged.ingredients,
    ...(official.usagePrimary ? { usage } : {}),
    aliases,
    ...Object.fromEntries(Object.entries(cleaned).filter(([,value]) => value !== undefined)),
  };
}
function photoOverride(id) {
  const authority = getPhotoAuthority();
  const url = String(authority?.products?.[id] || "").trim();
  if (!url) throw new Error(`${id} 缺少 products-v3 正式產品原圖權威`);
  return {
    image: url,
    imageUrl: url,
    image_url: url,
    dmImage: url,
    officialOriginalImage: url,
    imagePolicy: "approved-original-product-photo-contain-no-crop",
  };
}

function applyMaster(data) {
  const policy = getMaster();
  const authority = getCurrentAuthority();
  const productOverrides = policy.products || {};
  const comboOffers = Array.isArray(policy.comboOffers) ? sanitizeCurrentCopy(policy.comboOffers) : [];

  data.products = (data.products || []).filter((product) => productOverrides[product.id]).map((product) => {
    const rawOverride = formalCopy(product.id, productOverrides[product.id] || {});
    const override = salesOverride(rawOverride);
    const normalized = normalizeProductOffers(product, override);
    const quantityOptions = [...new Set([
      ...(Array.isArray(product.quantityOptions) ? product.quantityOptions : [1, 2, 3, 5]),
      ...normalized.offers.map((offer) => offer.qty),
    ].map(Number).filter((value) => Number.isFinite(value) && value > 0))];
    let merged = {
      ...sanitizeCurrentCopy(product),
      ...override,
      ...photoOverride(product.id),
      offers: normalized.offers,
      promotionTexts: normalized.promotionTexts,
      quantityOptions,
    };
    merged = { ...merged, ...currentAuthorityOverride(product.id, merged) };
    if (!merged.physicalScalePolicy) merged.physicalScalePolicy = "uniform-only-preserve-realistic-product-scale";
    delete merged.variants;
    delete merged.variantSelectionMode;
    return merged;
  });

  data.offers = { comboOffers };
  data.combos = rootCombos(comboOffers);
  data.retentionOffers = {
    combos: Object.fromEntries(comboOffers.map((combo) => [combo.name, "可依組合內容、數量與需求協助整理較適合的方案。"])),
  };
  data.fulfillmentPolicy = { ...(authority.fulfillmentPolicy || policy.fulfillmentPolicy || {}) };
  data.payments = Array.isArray(policy.payments) ? policy.payments : (data.payments || []);
  data.shipping = Array.isArray(policy.shipping) ? policy.shipping : (data.shipping || []);
  data.store = policy.store ? { ...policy.store } : (data.store || {});
  data.trialCampaign = sanitizeCurrentCopy({ ...(authority.trialCampaign || policy.trialCampaign || data.trialCampaign || {}) });
  data.trialPosterAuthority = sanitizeCurrentCopy({ ...(authority.trialPosterAuthority || {}) });
  data.runtime = {
    ...(data.runtime || {}),
    imagePolicy: {
      ...((data.runtime || {}).imagePolicy || {}),
      ...(policy.imagePolicy || {}),
      actualProductPhotoAuthority: getPhotoAuthority().version,
      productMainImageSource: "products-v3-user-approved-originals",
      productsV2Use: "legacy-reference-only",
      productScalePolicy: "uniform-only-no-equal-height-equal-width",
      dmFallback: "current-formal-dm-if-approved-otherwise-products-v3",
    },
    productMainImageSource: "products-v3-user-approved-originals",
    productsV2Use: "legacy-reference-only",
    productScalePolicy: "uniform-only-no-equal-height-equal-width",
    formalCopyVersion: authority.version,
    formalCopyAuthority: authority.authority,
    trialAuthority: "assets/data/official-products.json",
    contentApproval: {
      mode: "review-only",
      defaultStatus: "pending_review",
      scheduleRequiresApproval: true,
      publishRequiresApproval: true,
      lineVoomManualOnly: true,
    },
  };
  data.salesMasterVersion = `${policy.version}-authority-driven-current`;
  data.salesMasterSource = `${policy.source}; retired copy normalized by current official authority before runtime`;
  data.currentProductAuthorityVersion = authority.version;
  data.productPhotoAuthorityVersion = getPhotoAuthority().version;
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
    console.error("仙加味正式銷售主檔套用失敗：" + error.message);
    throw error;
  }
  return result;
};

module.exports = { applyMaster, getMaster, getCurrentAuthority, getPhotoAuthority, rootCombos, normalizeProductOffers, salesOverride, formalCopy, authorityProduct, currentAuthorityOverride, photoOverride, sanitizeCurrentCopy, FORMAL_PRODUCT_COPY, SALES_OVERRIDE_FIELDS };
