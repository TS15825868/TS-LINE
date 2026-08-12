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
    const approvedDm = String(rule.approvedDm || "").trim();
    const customerDisplay = approvedDm || photo;
    for (const field of ["image", "imageUrl", "image_url", "dmImage"]) {
      if (String(product[field] || "") !== customerDisplay) throw new Error(`${id}.${field} 必須使用目前正式DM／正式顧客視覺`);
    }
    if (String(product.officialOriginalImage || "") !== photo) throw new Error(`${id}.officialOriginalImage 必須保留products-v3實物身份權威`);
    if (product.imagePolicy !== "current-formal-dm-customer-display-preserve-products-v3-identity") throw new Error(`${id}圖片政策不同步`);
  }

  const drink30 = (merged.products || []).find((item) => item.id === "guilu-drink-30");
  if (/玻璃瓶|30cc／瓶|瓶裝/.test(JSON.stringify(drink30))) throw new Error("30cc不得出現瓶型舊稱");
  if (!String(drink30?.image || "").includes("/images/customer-display-v20260812/guilu-drink-30cc.webp")) throw new Error("30cc未使用目前正式試喝主視覺來源");
  const drink180 = (merged.products || []).find((item) => item.id === "guilu-drink-180");
  if (!String(drink180?.image || "").includes("/images/customer-display-v20260812/guilu-drink-180cc.webp")) throw new Error("180cc未使用目前正式鋁袋視覺來源");
  if (/每塊約\s*9\.375g/.test(JSON.stringify((merged.products || []).find((item) => item.id === "guilu-tangkuai")))) throw new Error("龜鹿湯塊不得帶退役每塊重量");
  if (/1斤|每塊約\s*18\.75g/.test(JSON.stringify((merged.products || []).find((item) => item.id === "guilu-jiao")))) throw new Error("龜鹿膠不得帶退役1斤／每塊重量");

  const trial = authority.trialPosterAuthority || {};
  if (!String(trial.currentDisplay || "").includes("/images/customer-display-v20260812/trial.webp")) throw new Error("試喝圖未使用20260812正式試喝主圖");
  if (String(merged.trialPosterAuthority?.currentDisplay || "") !== String(trial.currentDisplay || "")) throw new Error("試喝圖權威未同步至LINE執行資料");
  if (!String(authority.displayPolicy || "").includes("products-v3只保留")) throw new Error("LINE顧客圖政策必須把products-v3限定為實物校正權威");
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
  console.log(`PASS: LINE current catalog ${mode}; formal customer DM first + products-v3 identity reference + 20260812 trial master.`);
}

main();
