"use strict";

const VERSION = "3.1.0";
const ASSET_VERSION = "approved-existing-production-20260722-v1";
const MASCOT_BASE = "https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot";
const DM_BASE = "https://ts15825868.github.io/xianjiawei/images/dm-final";

// 正式上線先使用儲存庫內既有且已核准的清晰素材。
// 關心貼文使用已核准小老闆原圖；產品貼文使用官網正式 DM 真實產品圖。
const ASSETS = Object.freeze({
  "care-work-rest": { file: "faq.jpg", sourceFile: "faq.jpg", base: MASCOT_BASE },
  "care-family": { file: "brand.jpg", sourceFile: "brand.jpg", base: MASCOT_BASE },
  "care-storage": { file: "service.jpg", sourceFile: "service.jpg", base: MASCOT_BASE },
  "care-warm-drink": { file: "usage.jpg", sourceFile: "usage.jpg", base: MASCOT_BASE },
  "care-hydration": { file: "welcome.jpg", sourceFile: "welcome.jpg", base: MASCOT_BASE },
  "weather-temperature-gap": { file: "service.jpg", sourceFile: "service.jpg", base: MASCOT_BASE },
  "weather-hot": { file: "usage.jpg", sourceFile: "usage.jpg", base: MASCOT_BASE },
  "weather-rain": { file: "welcome.jpg", sourceFile: "welcome.jpg", base: MASCOT_BASE },
  "product-guilu-gao": { file: "01_guilu-gao-100g-dm.jpg", sourceFile: "01_guilu-gao-100g-dm.jpg", base: DM_BASE },
  "product-guilu-drink": { file: "02_guilu-drink-30cc-dm.jpg", sourceFile: "02_guilu-drink-30cc-dm.jpg", base: DM_BASE },
  "product-lurongfen": { file: "04_luerong-fen-75g-dm.jpg", sourceFile: "04_luerong-fen-75g-dm.jpg", base: DM_BASE },
  "product-tangkuai": { file: "05_guilu-tangkuai-75g-dm.jpg", sourceFile: "05_guilu-tangkuai-75g-dm.jpg", base: DM_BASE },
  "product-guilu-jiao": { file: "06_guilu-jiao-600g-dm.jpg", sourceFile: "06_guilu-jiao-600g-dm.jpg", base: DM_BASE },
});

function assetUrl(key) {
  const asset = ASSETS[key];
  return asset ? `${asset.base}/${encodeURIComponent(asset.file)}?v=${ASSET_VERSION}` : "";
}

function addApprovedHosts() {
  const hosts = new Set(
    String(process.env.SOCIAL_APPROVED_IMAGE_HOSTS || "raw.githubusercontent.com,ts15825868.github.io")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
  hosts.add("raw.githubusercontent.com");
  hosts.add("ts15825868.github.io");
  process.env.SOCIAL_APPROVED_IMAGE_HOSTS = [...hosts].join(",");
  return [...hosts];
}

addApprovedHosts();

module.exports = {
  VERSION,
  ASSET_VERSION,
  MASCOT_BASE,
  DM_BASE,
  ASSETS,
  assetUrl,
  addApprovedHosts,
};
