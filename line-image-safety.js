"use strict";

/**
 * LINE OA 正式媒體入口｜目前權威版
 * - 產品介紹主圖、詳細DM、試喝海報分成三條 LINE 相容 JPEG 路由。
 * - 產品來源使用 official-products.json.approvedProductImage。
 * - 詳細DM來源使用 official-products.json.approvedDm。
 * - 試喝來源固定使用 2026-08-14 使用者核准小老闆海報。
 * - products-v3 只作實際產品外觀、包裝與比例身份參考／實際產品照片。
 * - 所有轉檔只等比例縮小、白底補齊，不裁切、不拉伸、不AI重畫。
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const core = require("./line-image-safety-core");
const plainTextSafety = require("./line-plain-text-safety");
const recordingUiFix = require("./line-recording-ui-fix");
const richMenuSync = require("./line-rich-menu-sync");
const photoAuthority = require("./line-product-photo-authority.json");
const currentAuthority = require("./assets/data/official-products.json");
const formalMedia = require("./formal-media-authority-v20260810.json");

const VERSION = "current-line-media-role-separation-v20260814";
const FORMAL_MEDIA_VERSION = String(currentAuthority.version || "current-formal-media");
const PRODUCT_IDS = Object.freeze([
  "guilu-gao",
  "guilu-drink-30",
  "guilu-drink-180",
  "guilu-tangkuai",
  "guilu-jiao",
  "luerong-fen",
]);
const CURRENT_BY_ID = Object.freeze(Object.fromEntries((currentAuthority.products || []).map((item) => [item.id, item])));
const FORMAL_ROUTE_IDS = new Set(PRODUCT_IDS);
const jpegCache = new Map();

function promotionFirstQuantityOptions(product) {
  const source = Array.isArray(product?.quantityOptions) && product.quantityOptions.length ? product.quantityOptions : [1, 2, 3, 5];
  const options = [...new Set(source.map(Number).filter((value) => Number.isInteger(value) && value > 0))];
  const promotionQuantities = [...new Set((product?.offers || []).map((offer) => Number(offer?.qty)).filter((value) => Number.isInteger(value) && value > 0))];
  if (!promotionQuantities.length) return options;
  const preferred = [];
  for (const value of [1, 2, 5, ...promotionQuantities, ...options]) {
    if ((options.includes(value) || promotionQuantities.includes(value)) && !preferred.includes(value)) preferred.push(value);
  }
  return preferred;
}

function formalLineProductImageUrl(id) {
  return `${core.PUBLIC_BASE_URL}/assets/formal-product/${encodeURIComponent(id)}.jpg?v=${encodeURIComponent(FORMAL_MEDIA_VERSION)}`;
}
function formalLineDmImageUrl(id) {
  return `${core.PUBLIC_BASE_URL}/assets/formal-dm/${encodeURIComponent(id)}.jpg?v=${encodeURIComponent(FORMAL_MEDIA_VERSION)}`;
}
function formalLineTrialImageUrl() {
  return `${core.PUBLIC_BASE_URL}/assets/formal-trial/trial.jpg?v=${encodeURIComponent(FORMAL_MEDIA_VERSION)}`;
}

function formalSourceUrl(role, id = "") {
  if (role === "trial") return String(currentAuthority.trialPosterAuthority?.currentDisplay || "").trim();
  const item = CURRENT_BY_ID[id];
  if (!item) return "";
  if (role === "product") return String(item.approvedProductImage || "").trim();
  if (role === "dm") return String(item.approvedDm || "").trim();
  return "";
}

async function buildFormalJpeg(role, id = "") {
  const cacheKey = `${role}:${id || "trial"}`;
  if (jpegCache.has(cacheKey)) return jpegCache.get(cacheKey);
  const source = formalSourceUrl(role, id);
  if (!source) throw new Error(`missing current formal ${role} source: ${id || "trial"}`);
  const task = (async () => {
    const response = await fetch(source, {
      headers: { "user-agent": "xianjiawei-line-current-media/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`formal ${role} fetch failed ${response.status}: ${source}`);
    const input = Buffer.from(await response.arrayBuffer());
    return sharp(input)
      .rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#FFFFFF" })
      .jpeg({ quality: 91, progressive: true, mozjpeg: true, chromaSubsampling: "4:4:4" })
      .toBuffer();
  })().catch((error) => {
    jpegCache.delete(cacheKey);
    throw error;
  });
  jpegCache.set(cacheKey, task);
  return task;
}

function sendJpeg(res, body, role) {
  res.set({
    "Content-Type": "image/jpeg",
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "X-Content-Type-Options": "nosniff",
    "X-XJW-Formal-Media": FORMAL_MEDIA_VERSION,
    "X-XJW-Media-Role": role,
  });
  return res.status(200).send(body);
}

function installImageRoutes(app) {
  core.installImageRoutes(app);
  if (!app || typeof app.get !== "function" || app.locals?.__xjwCurrentFormalMediaRoutes) return;

  app.get("/assets/formal-product/:id.jpg", async (req, res) => {
    const id = String(req.params?.id || "").trim();
    if (!FORMAL_ROUTE_IDS.has(id)) return res.status(404).end();
    try { return sendJpeg(res, await buildFormalJpeg("product", id), "product"); }
    catch (error) { console.error("LINE 正式產品圖 JPEG 轉換失敗", id, error?.message || error); return res.status(502).end(); }
  });

  app.get("/assets/formal-dm/:id.jpg", async (req, res) => {
    const id = String(req.params?.id || "").trim();
    if (!FORMAL_ROUTE_IDS.has(id)) return res.status(404).end();
    try { return sendJpeg(res, await buildFormalJpeg("dm", id), "dm"); }
    catch (error) { console.error("LINE 正式詳細DM JPEG 轉換失敗", id, error?.message || error); return res.status(502).end(); }
  });

  app.get("/assets/formal-trial/trial.jpg", async (_req, res) => {
    try { return sendJpeg(res, await buildFormalJpeg("trial"), "trial"); }
    catch (error) { console.error("LINE 正式試喝海報 JPEG 轉換失敗", error?.message || error); return res.status(502).end(); }
  });

  // 舊相容網址只做轉址，不再讓 trial 混進 DM 角色。
  app.get("/assets/formal-dm/trial.jpg", (_req, res) => res.redirect(302, formalLineTrialImageUrl()));
  app.locals.__xjwCurrentFormalMediaRoutes = true;
}

function normalizeProductPhotos(data) {
  if (!data || !Array.isArray(data.products)) return data;
  data.products = data.products.map((product) => {
    const official = CURRENT_BY_ID[product.id];
    const identity = String(photoAuthority.products?.[product.id] || "").trim();
    if (!official || !identity) return { ...product, quantityOptions: promotionFirstQuantityOptions(product) };
    const productDisplay = formalLineProductImageUrl(product.id);
    const dmDisplay = formalLineDmImageUrl(product.id);
    return {
      ...product,
      quantityOptions: promotionFirstQuantityOptions(product),
      image: productDisplay,
      imageUrl: productDisplay,
      image_url: productDisplay,
      dmImage: dmDisplay,
      officialOriginalImage: identity,
      productIdentityImage: identity,
      formalProductSource: official.approvedProductImage,
      formalDmSource: official.approvedDm,
      imagePolicy: "current-approved-product-image-line-jpeg; separate-current-dm-jpeg; products-v3-identity-only; contain-no-crop-no-stretch",
      physicalScalePolicy: product.physicalScalePolicy || "uniform-only-preserve-realistic-product-scale",
    };
  });

  data.productPhotoAuthorityVersion = photoAuthority.version;
  data.trialPosterAuthority = { ...(data.trialPosterAuthority || {}), ...(currentAuthority.trialPosterAuthority || {}) };
  data.formalMediaAuthority = {
    version: FORMAL_MEDIA_VERSION,
    approvalBatch: currentAuthority.version,
    productRoute: `${core.PUBLIC_BASE_URL}/assets/formal-product/:id.jpg`,
    dmRoute: `${core.PUBLIC_BASE_URL}/assets/formal-dm/:id.jpg`,
    trialImage: formalLineTrialImageUrl(),
    trialSource: formalSourceUrl("trial"),
    source: "assets/data/official-products.json",
    principle: "product-dm-trial-identity-four-roles-separated",
  };
  data.runtime = {
    ...(data.runtime || {}),
    serviceMode: "standalone-line-oa",
    productMainImageSource: "current-approved-product-image-line-compatible-jpeg",
    detailedDmImageSource: "current-approved-dm-line-compatible-jpeg",
    trialImageSource: "20260814-user-approved-trial-line-compatible-jpeg",
    productIdentitySource: "products-v3-user-approved-originals",
    productsV2Use: "legacy-reference-only",
    productScalePolicy: "uniform-only-no-equal-height-equal-width",
    directStartPhotoSafetyVersion: VERSION,
    formalMediaVersion: FORMAL_MEDIA_VERSION,
    formalMediaApprovalBatch: currentAuthority.version,
    promotionQuantityPolicy: "promotion-qty-must-appear-within-first-four-options",
    richMenuSyncVersion: richMenuSync.VERSION,
  };
  return data;
}

function installDataReadGuard() {
  if (fs.__xjwCurrentFormalMediaDataGuardInstalled) return;
  const nativeReadFileSync = fs.readFileSync.bind(fs);
  fs.readFileSync = function xjwReadFileSync(file, options) {
    const value = nativeReadFileSync(file, options);
    const filename = typeof file === "string" ? file : String(file || "");
    if (path.basename(filename) !== "data.json" || typeof value !== "string") return value;
    try { return JSON.stringify(normalizeProductPhotos(JSON.parse(value)), null, 2); }
    catch (error) { console.warn("LINE data.json 目前正式媒體安全層套用失敗", error.message); return value; }
  };
  Object.defineProperty(fs, "__xjwCurrentFormalMediaDataGuardInstalled", { value: true, enumerable: false });
}

installDataReadGuard();
plainTextSafety.install(core);
richMenuSync.scheduleRichMenuSync();

global.__XJW_LINE_DIRECT_START_SAFETY__ = Object.freeze({
  version: VERSION,
  serviceMode: "standalone-line-oa",
  photoAuthorityVersion: photoAuthority.version,
  formalMediaVersion: FORMAL_MEDIA_VERSION,
  mediaRolesSeparated: true,
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
  currentAuthority,
  formalMedia,
  VERSION,
  FORMAL_MEDIA_VERSION,
  PRODUCT_IDS,
  CURRENT_BY_ID,
  formalSourceUrl,
  formalLineProductImageUrl,
  formalLineDmImageUrl,
  formalLineTrialImageUrl,
  buildFormalJpeg,
  promotionFirstQuantityOptions,
  normalizeProductPhotos,
  installDataReadGuard,
};
