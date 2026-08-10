"use strict";

const fs = require("fs");
const path = require("path");

const originalReadFileSync = fs.readFileSync.bind(fs);
const masterPath = path.join(__dirname, "line-sales-master.json");
const photoAuthorityPath = path.join(__dirname, "line-product-photo-authority.json");
let master = null;
let photoAuthority = null;

const SALES_OVERRIDE_FIELDS = Object.freeze([
  "name", "displayName", "specification", "size", "spec", "unit",
  "description", "ingredients", "usage", "storage", "fit", "purposeDirection", "aliases",
  "price", "originalPrice", "offers", "priceText", "originalPriceText",
  "priceLabel", "quoteOnly",
  "fulfillmentType", "fulfillmentNotice", "productionLeadTime", "readyStock",
  "image", "imageUrl", "image_url", "dmImage", "officialOriginalImage", "imagePolicy", "physicalScalePolicy",
]);

const FORMAL_PRODUCT_COPY = Object.freeze({
  "guilu-gao": {
    specification: "100g／罐",
    size: "100g／罐",
    spec: "100g／罐",
    usage: [
      "一天一次一小匙",
      "初次可先從半匙開始",
      "可直接食用或加入約100～300mL溫熱水化開",
      "避免接近睡前食用",
    ],
  },
  "guilu-drink-30": {
    name: "龜鹿飲30cc玻璃罐",
    displayName: "龜鹿飲30cc玻璃罐",
    specification: "30cc／罐（小玻璃罐）",
    size: "30cc／罐（小玻璃罐）",
    spec: "30cc／罐（小玻璃罐）",
    usage: ["每日一份", "開罐即可飲用", "可隔水加熱或溫熱後飲用", "避免冰飲", "開罐後請儘速飲用完畢"],
  },
  "guilu-drink-180": {
    name: "龜鹿飲180cc鋁袋",
    displayName: "龜鹿飲180cc鋁袋",
    specification: "180cc／包（鋁袋）",
    size: "180cc／包（鋁袋）",
    spec: "180cc／包（鋁袋）",
    usage: ["每日一份", "撕開包裝即可飲用", "可隔水加熱或溫熱後飲用", "避免冰飲", "開封後請儘速飲用完畢"],
  },
  "guilu-tangkuai": {
    specification: "75g／盒｜8塊裝",
    size: "75g／盒｜8塊裝",
    spec: "75g／盒｜8塊裝",
  },
  "guilu-jiao": {
    specification: "600g／盒｜32塊裝",
    size: "600g／盒｜32塊裝",
    spec: "600g／盒｜32塊裝",
    description: "600g淡紫盒、32塊裝，適合家庭大規格、熱水化開或燉湯。",
    fit: "熟悉龜鹿產品、偏好家庭大規格或家庭安排的人",
    aliases: ["龜鹿膠", "膠", "600g"],
  },
  "luerong-fen": {
    specification: "75g／罐",
    size: "75g／罐",
    spec: "75g／罐",
  },
});

function getMaster() {
  if (master) return master;
  master = JSON.parse(originalReadFileSync(masterPath, "utf8"));
  return master;
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
  return Object.fromEntries(SALES_OVERRIDE_FIELDS.filter((field) => override[field] !== undefined).map((field) => [field, override[field]]));
}

function formalCopy(id, value = {}) {
  return { ...value, ...(FORMAL_PRODUCT_COPY[id] || {}) };
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
  const productOverrides = policy.products || {};
  const comboOffers = Array.isArray(policy.comboOffers) ? policy.comboOffers : [];

  data.products = (data.products || []).filter((product) => productOverrides[product.id]).map((product) => {
    const rawOverride = formalCopy(product.id, productOverrides[product.id] || {});
    const override = salesOverride(rawOverride);
    const normalized = normalizeProductOffers(product, override);
    const quantityOptions = [...new Set([
      ...(Array.isArray(product.quantityOptions) ? product.quantityOptions : [1, 2, 3, 5]),
      ...normalized.offers.map((offer) => offer.qty),
    ].map(Number).filter((value) => Number.isFinite(value) && value > 0))];
    const merged = {
      ...product,
      ...override,
      ...photoOverride(product.id),
      offers: normalized.offers,
      promotionTexts: normalized.promotionTexts,
      quantityOptions,
    };
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
  data.fulfillmentPolicy = { ...(policy.fulfillmentPolicy || {}) };
  data.payments = Array.isArray(policy.payments) ? policy.payments : (data.payments || []);
  data.shipping = Array.isArray(policy.shipping) ? policy.shipping : (data.shipping || []);
  data.store = policy.store ? { ...policy.store } : (data.store || {});
  data.trialCampaign = policy.trialCampaign ? { ...policy.trialCampaign } : data.trialCampaign;
  data.runtime = {
    ...(data.runtime || {}),
    imagePolicy: {
      ...((data.runtime || {}).imagePolicy || {}),
      ...(policy.imagePolicy || {}),
      actualProductPhotoAuthority: getPhotoAuthority().version,
      productMainImageSource: "products-v3-user-approved-originals",
      productsV2Use: "legacy-reference-only",
      productScalePolicy: "uniform-only-no-equal-height-equal-width",
      dmFallback: "approved-original-photo-until-current-dm-reviewed",
    },
    productMainImageSource: "products-v3-user-approved-originals",
    productsV2Use: "legacy-reference-only",
    productScalePolicy: "uniform-only-no-equal-height-equal-width",
    formalCopyVersion: "20260810-formal-copy-v1",
    contentApproval: {
      mode: "review-only",
      defaultStatus: "pending_review",
      scheduleRequiresApproval: true,
      publishRequiresApproval: true,
      lineVoomManualOnly: true,
    },
  };
  data.salesMasterVersion = `${policy.version}-formal-copy-v1`;
  data.salesMasterSource = policy.source;
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

module.exports = { applyMaster, getMaster, getPhotoAuthority, rootCombos, normalizeProductOffers, salesOverride, formalCopy, photoOverride, FORMAL_PRODUCT_COPY, SALES_OVERRIDE_FIELDS };
