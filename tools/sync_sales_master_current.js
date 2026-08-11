"use strict";

const fs = require("fs");
const path = require("path");
const { applyMaster, getCurrentAuthority, getPhotoAuthority } = require("../product-sales-master");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data.json");
const AUTHORITY_PATH = path.join(ROOT, "assets/data/official-products.json");
const stable = (value) => JSON.stringify(value, null, 2) + "\n";

const PRODUCT_IDS = [
  "guilu-gao",
  "guilu-drink-30",
  "guilu-drink-180",
  "guilu-tangkuai",
  "guilu-jiao",
  "luerong-fen",
];

function assertCurrent(merged, authority, photoAuthority) {
  if (authority?.authority !== "user-confirmed-current") throw new Error("LINE目前產品權威不是user-confirmed-current");
  const official = new Map((authority.products || []).map((item) => [item.id, item]));
  if (official.size !== 6 || (merged.products || []).length !== 6) throw new Error("LINE正式產品必須剛好6項");

  for (const id of PRODUCT_IDS) {
    const product = (merged.products || []).find((item) => item.id === id);
    const rule = official.get(id);
    const photo = String(photoAuthority?.products?.[id] || "").trim();
    if (!product || !rule || !photo) throw new Error(`${id}缺少目前正式產品權威`);
    if (product.name !== rule.name) throw new Error(`${id}正式名稱不同步`);
    if (product.specification !== rule.specification || product.size !== rule.specification || product.spec !== rule.specification) throw new Error(`${id}正式規格不同步`);
    for (const field of ["image", "imageUrl", "image_url", "officialOriginalImage"]) {
      if (String(product[field] || "") !== photo) throw new Error(`${id}.${field} 必須使用products-v3正式產品原圖`);
    }
    const approvedDm = String(rule.approvedDm || "").trim();
    if (approvedDm) {
      if (String(product.dmImage || "") !== approvedDm) throw new Error(`${id}.dmImage 必須使用目前核准上傳DM`);
    } else if (String(product.dmImage || "") !== photo) {
      throw new Error(`${id}.dmImage 缺少核准DM且未回退products-v3`);
    }
    if (product.imagePolicy !== "approved-original-product-photo-contain-no-crop") throw new Error(`${id}圖片政策不同步`);
  }

  const drink30 = (merged.products || []).find((item) => item.id === "guilu-drink-30");
  if (/玻璃瓶|30cc／瓶|瓶裝/.test(JSON.stringify(drink30))) throw new Error("30cc不得出現瓶型舊稱");
  if (/每塊約\s*9\.375g/.test(JSON.stringify((merged.products || []).find((item) => item.id === "guilu-tangkuai")))) throw new Error("龜鹿湯塊不得帶退役每塊重量");
  if (/1斤|每塊約\s*18\.75g/.test(JSON.stringify((merged.products || []).find((item) => item.id === "guilu-jiao")))) throw new Error("龜鹿膠不得帶退役1斤／每塊重量");

  const trial = authority.trialPosterAuthority || {};
  if (!String(trial.currentDisplay || "").includes("/images/dm-approved-v20260810/guilu-drink-trial.webp")) throw new Error("試喝圖未使用目前核准上傳版本");
  if (String(merged.trialPosterAuthority?.currentDisplay || "") !== String(trial.currentDisplay || "")) throw new Error("試喝圖權威未同步至LINE執行資料");
}

function main() {
  const mode = process.argv.includes("--write") ? "write" : "check";
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const authority = JSON.parse(fs.readFileSync(AUTHORITY_PATH, "utf8"));
  const merged = applyMaster(raw);
  const photoAuthority = getPhotoAuthority();
  assertCurrent(merged, authority, photoAuthority);

  if (mode === "write") {
    const next = stable(merged);
    const previous = fs.readFileSync(DATA_PATH, "utf8");
    if (previous !== next) fs.writeFileSync(DATA_PATH, next, "utf8");
  }
  console.log(`PASS: LINE current catalog ${mode}; products-v3 identity + approved uploaded DM/trial media.`);
}

main();
