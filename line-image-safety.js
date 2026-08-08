"use strict";

/*
 * LINE OA 穩定入口｜2026-08-08
 * server.js 第一行固定 require 本檔，因此即使 Render 繞過 npm start / prestart：
 * 1. data.json 讀入前就把六項產品圖片強制改成 products-v2 實際產品照片；
 * 2. Flex送出前仍套用錄影修正：舊DM按鈕→正式產品圖、推薦卡→網站Q版小老闆；
 * 3. 龜鹿飲製作5～7工作天／其他產品現貨與75g-only文字守門仍生效。
 */
const fs = require("fs");
const path = require("path");
const core = require("./line-image-safety-core");
const plainTextSafety = require("./line-plain-text-safety");
const fulfillmentSafety = require("./product-fulfillment-message-fix");
const recordingUiFix = require("./line-recording-ui-fix");
const photoAuthority = require("./line-product-photo-authority.json");

const VERSION = "20260808-direct-start-products-v2-v1";

function normalizeProductPhotos(data) {
  if (!data || !Array.isArray(data.products)) return data;
  data.products = data.products.map((product) => {
    const photo = photoAuthority.products?.[product.id];
    if (!photo) return product;
    return {
      ...product,
      image: photo,
      imageUrl: photo,
      image_url: photo,
      dmImage: photo,
      officialOriginalImage: photo,
      imagePolicy: "actual-product-photo-contain-no-crop",
    };
  });
  data.productPhotoAuthorityVersion = photoAuthority.version;
  data.runtime = {
    ...(data.runtime || {}),
    productMainImageSource: "products-v2-actual-photos",
    dmFallback: "actual-product-photo-until-new-dm-reviewed",
    productsV3Use: "marketing-layout-reference-only",
    directStartPhotoSafetyVersion: VERSION,
  };
  return data;
}

function installDataReadGuard() {
  if (fs.__xjwProductsV2DataGuardInstalled) return;
  const nativeReadFileSync = fs.readFileSync.bind(fs);
  fs.readFileSync = function xjwReadFileSync(file, options) {
    const value = nativeReadFileSync(file, options);
    const filename = typeof file === "string" ? file : String(file || "");
    if (path.basename(filename) !== "data.json" || typeof value !== "string") return value;
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(normalizeProductPhotos(parsed), null, 2);
    } catch (error) {
      console.warn("LINE data.json products-v2 安全層套用失敗", error.message);
      return value;
    }
  };
  Object.defineProperty(fs, "__xjwProductsV2DataGuardInstalled", { value: true, enumerable: false });
}

installDataReadGuard();
plainTextSafety.install(core);

global.__XJW_LINE_DIRECT_START_SAFETY__ = Object.freeze({
  version: VERSION,
  photoAuthorityVersion: photoAuthority.version,
  recordingUiVersion: recordingUiFix.VERSION,
});

module.exports = {
  ...core,
  ...plainTextSafety,
  fulfillmentSafety,
  recordingUiFix,
  photoAuthority,
  VERSION,
  normalizeProductPhotos,
  installDataReadGuard,
};
