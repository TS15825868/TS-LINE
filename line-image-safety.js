"use strict";

/*
 * LINE OA 穩定入口｜2026-08-09
 * server.js 第一行固定 require 本檔，因此即使 Render 繞過 npm start / prestart：
 * 1. data.json 讀入前就把六項產品圖片強制改成 products-v3 使用者確認的正式產品原圖；
 * 2. Flex送出前仍套用錄影修正：舊DM按鈕→正式產品照片、推薦卡→網站Q版小老闆；
 * 3. 所有產品 hero 一律 fit／contain，只能等比例顯示，不拉寬、不拉高、不裁切；
 * 4. 保留每項產品自己的實際尺寸／比例規則，30cc小罐與180cc狹長鋁袋不得被通用規則覆蓋；
 * 5. 龜鹿飲製作5～7工作天／其他產品現貨與75g-only文字守門仍生效；
 * 6. 固定社群排程先鎖週二19:30／週六09:30；
 * 7. 啟動後自動同步原生完整單一 Rich Menu。
 */
const fs = require("fs");
const path = require("path");
const schedulePolicy = require("./social-schedule-policy-fix");
const core = require("./line-image-safety-core");
const plainTextSafety = require("./line-plain-text-safety");
const fulfillmentSafety = require("./product-fulfillment-message-fix");
const recordingUiFix = require("./line-recording-ui-fix");
const richMenuSync = require("./line-rich-menu-sync");
const photoAuthority = require("./line-product-photo-authority.json");

const VERSION = "20260809-direct-start-products-v3-size-lock-v4";

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
      imagePolicy: "approved-original-product-photo-contain-no-crop",
      // 只補缺省值；不得把 data.json／正式母檔裡的個別產品尺寸規則洗掉。
      physicalScalePolicy: product.physicalScalePolicy || "uniform-only-preserve-realistic-product-scale",
    };
  });
  data.productPhotoAuthorityVersion = photoAuthority.version;
  data.runtime = {
    ...(data.runtime || {}),
    productMainImageSource: "products-v3-user-approved-originals",
    dmFallback: "approved-original-photo-until-current-dm-reviewed",
    productsV2Use: "legacy-reference-only",
    productScalePolicy: "uniform-only-no-equal-height-equal-width",
    directStartPhotoSafetyVersion: VERSION,
    schedulePolicyVersion: schedulePolicy.VERSION,
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
      const parsed = JSON.parse(value);
      return JSON.stringify(normalizeProductPhotos(parsed), null, 2);
    } catch (error) {
      console.warn("LINE data.json products-v3 正式產品圖安全層套用失敗", error.message);
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
  photoAuthorityVersion: photoAuthority.version,
  recordingUiVersion: recordingUiFix.VERSION,
  schedulePolicyVersion: schedulePolicy.VERSION,
  richMenuSyncVersion: richMenuSync.VERSION,
});

module.exports = {
  ...core,
  ...plainTextSafety,
  fulfillmentSafety,
  recordingUiFix,
  richMenuSync,
  schedulePolicy,
  photoAuthority,
  VERSION,
  normalizeProductPhotos,
  installDataReadGuard,
};
