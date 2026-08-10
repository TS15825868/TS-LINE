"use strict";

/*
 * LINE OA 正式媒體入口｜2026-08-10
 * - products-v3 仍是產品本體／包裝識別唯一權威。
 * - 顧客產品介紹圖使用使用者最新核准 DM。
 * - 核准 DM 原檔為官網 WebP；LINE 顯示時只做 JPEG 格式轉換與等比例縮小，不裁切、不拉伸、不重畫。
 * - 30cc 必須維持小玻璃裸罐、無貼紙；180cc 必須維持鋁袋。
 * - 守門驗最新能力、規格與媒體行為，不綁舊版號或舊固定文案。
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const core = require("./line-image-safety-core");
const plainTextSafety = require("./line-plain-text-safety");
const recordingUiFix = require("./line-recording-ui-fix");
const richMenuSync = require("./line-rich-menu-sync");
const photoAuthority = require("./line-product-photo-authority.json");
const formalMedia = require("./formal-media-authority-v20260810.json");

const VERSION = "20260810-direct-start-latest-user-dm-v8";
const FORMAL_MEDIA_VERSION = "20260810-latest-user-batch";
const FORMAL_KEYS = Object.freeze({
  "guilu-gao": "龜鹿膏",
  "guilu-drink-30": "龜鹿飲30cc玻璃罐",
  "guilu-drink-180": "龜鹿飲180cc鋁袋",
  "guilu-tangkuai": "龜鹿湯塊",
  "guilu-jiao": "龜鹿膠",
  "luerong-fen": "鹿茸粉",
});
const FORMAL_ROUTE_IDS = new Set([...Object.keys(FORMAL_KEYS), "trial"]);
const formalJpegCache = new Map();

function promotionFirstQuantityOptions(product) {
  const source = Array.isArray(product?.quantityOptions) && product.quantityOptions.length
    ? product.quantityOptions
    : [1, 2, 3, 5];
  const options = [...new Set(source.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
  const promotionQuantities = [...new Set((product?.offers || [])
    .map((offer) => Number(offer?.qty))
    .filter((value) => Number.isInteger(value) && value > 0))];
  if (!promotionQuantities.length) return options;
  const preferred = [];
  for (const value of [1, 2, 5, ...promotionQuantities]) {
    if ((options.includes(value) || promotionQuantities.includes(value)) && !preferred.includes(value)) preferred.push(value);
  }
  for (const value of options) if (!preferred.includes(value)) preferred.push(value);
  return preferred;
}

function formalLineImageUrl(id) {
  return `${core.PUBLIC_BASE_URL}/assets/formal-dm/${id}.jpg?v=${FORMAL_MEDIA_VERSION}`;
}

function formalSourceUrl(id) {
  if (id === "trial") return String(formalMedia.source_trial || "");
  const key = FORMAL_KEYS[id];
  return key ? String(formalMedia.source_product_dm?.[key] || "") : "";
}

async function buildFormalJpeg(id) {
  if (formalJpegCache.has(id)) return formalJpegCache.get(id);
  const source = formalSourceUrl(id);
  if (!source) throw new Error(`missing formal media source: ${id}`);
  const task = (async () => {
    const response = await fetch(source, { headers: { "user-agent": "xianjiawei-line-formal-media/1.0" } });
    if (!response.ok) throw new Error(`formal media fetch failed ${response.status}: ${source}`);
    const input = Buffer.from(await response.arrayBuffer());
    return sharp(input)
      .rotate()
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#FFFFFF" })
      .jpeg({ quality: 88, progressive: true, mozjpeg: true })
      .toBuffer();
  })().catch((error) => {
    formalJpegCache.delete(id);
    throw error;
  });
  formalJpegCache.set(id, task);
  return task;
}

function installImageRoutes(app) {
  core.installImageRoutes(app);
  if (!app || typeof app.get !== "function") return;
  app.get("/assets/formal-dm/:id.jpg", async (req, res) => {
    const id = String(req.params?.id || "").trim();
    if (!FORMAL_ROUTE_IDS.has(id)) return res.status(404).end();
    try {
      const body = await buildFormalJpeg(id);
      res.set("Content-Type", "image/jpeg");
      res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      res.set("X-XJW-Formal-Media", FORMAL_MEDIA_VERSION);
      return res.status(200).send(body);
    } catch (error) {
      console.error("LINE 核准DM JPEG轉換失敗", id, error?.message || error);
      return res.status(502).end();
    }
  });
}

function normalizeProductPhotos(data) {
  if (!data || !Array.isArray(data.products)) return data;
  data.products = data.products.map((product) => {
    const original = photoAuthority.products?.[product.id];
    const formalKey = FORMAL_KEYS[product.id];
    const formalSource = formalKey ? formalMedia.source_product_dm?.[formalKey] : "";
    const normalized = { ...product, quantityOptions: promotionFirstQuantityOptions(product) };
    if (!original || !formalSource) return normalized;
    const display = formalLineImageUrl(product.id);
    return {
      ...normalized,
      image: display,
      imageUrl: display,
      image_url: display,
      dmImage: display,
      officialOriginalImage: original,
      productIdentityImage: original,
      formalDmSource: formalSource,
      imagePolicy: "user-approved-dm-jpeg-contain-no-crop; products-v3-remains-identity-authority",
      physicalScalePolicy: product.physicalScalePolicy || "uniform-only-preserve-realistic-product-scale",
    };
  });
  data.productPhotoAuthorityVersion = photoAuthority.version;
  data.formalMediaAuthority = {
    version: formalMedia.runtime,
    approvalBatch: formalMedia.approval_batch,
    trialImage: formalLineImageUrl("trial"),
    trialSource: formalMedia.source_trial,
    source: formalMedia.source,
    principle: formalMedia.guard_principle,
  };
  data.runtime = {
    ...(data.runtime || {}),
    serviceMode: "standalone-line-oa",
    productMainImageSource: "user-approved-dm-rendered-as-line-compatible-jpeg",
    productIdentitySource: "products-v3-user-approved-originals",
    productsV2Use: "legacy-reference-only",
    productScalePolicy: "uniform-only-no-equal-height-equal-width",
    directStartPhotoSafetyVersion: VERSION,
    formalMediaVersion: FORMAL_MEDIA_VERSION,
    formalMediaApprovalBatch: formalMedia.approval_batch,
    promotionQuantityPolicy: "promotion-qty-must-appear-within-first-four-options",
    richMenuSyncVersion: richMenuSync.VERSION,
  };
  return data;
}

function installDataReadGuard() {
  if (fs.__xjwProductsV3DataGuardInstalled) return;
  const nativeReadFileSync = fs.readFileSync.bind(fs);
  fs.readFileSync = function xjwReadFileSync(file, options) {
    const value = nativeReadFileSync(file, options);
    const filename = typeof file === "string" ? file : String(file || "");
    if (path.basename(filename) !== "data.json" || typeof value !== "string") return value;
    try {
      return JSON.stringify(normalizeProductPhotos(JSON.parse(value)), null, 2);
    } catch (error) {
      console.warn("LINE data.json 正式媒體安全層套用失敗", error.message);
      return value;
    }
  };
  Object.defineProperty(fs, "__xjwProductsV3DataGuardInstalled", { value: true, enumerable: false });
}

installDataReadGuard();
plainTextSafety.install(core);
richMenuSync.scheduleRichMenuSync();

global.__XJW_LINE_DIRECT_START_SAFETY__ = Object.freeze({
  version: VERSION,
  serviceMode: "standalone-line-oa",
  photoAuthorityVersion: photoAuthority.version,
  formalMediaVersion: FORMAL_MEDIA_VERSION,
  formalMediaApprovalBatch: formalMedia.approval_batch,
  recordingUiVersion: recordingUiFix.VERSION,
  richMenuSyncVersion: richMenuSync.VERSION,
});

module.exports = {
  ...core,
  ...plainTextSafety,
  installImageRoutes,
  recordingUiFix,
  richMenuSync,
  photoAuthority,
  formalMedia,
  VERSION,
  FORMAL_MEDIA_VERSION,
  formalLineImageUrl,
  promotionFirstQuantityOptions,
  normalizeProductPhotos,
  installDataReadGuard,
};
