"use strict";

const fs = require("fs");
const path = require("path");
const { applyMaster, getPhotoAuthority } = require("../product-sales-master");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data.json");
const MASTER_PATH = path.join(ROOT, "line-sales-master.json");
const AUTHORITY_PATH = path.join(ROOT, "assets/data/official-products.json");
const stable = (value) => JSON.stringify(value, null, 2) + "\n";
const MASTER_VERSION = "2026-08-08-canonical-v7-official-originals";
const PHOTO_VERSION = "2026-08-09-products-v3-user-approved-size-lock-v1";

const CANONICAL_INGREDIENTS = Object.freeze({
  "guilu-gao": ["鹿角萃取物", "龜板萃取物", "枸杞", "紅棗", "黃耆", "粉光蔘"],
  "guilu-drink-30": ["水", "龜板萃取物", "鹿角萃取物", "粉光蔘", "枸杞", "紅棗", "黃耆"],
  "guilu-drink-180": ["水", "龜板萃取物", "鹿角萃取物", "粉光蔘", "枸杞", "紅棗", "黃耆"],
  "guilu-tangkuai": ["龜板萃取物", "鹿角萃取物"],
  "guilu-jiao": ["龜板萃取物", "鹿角萃取物"],
  "luerong-fen": ["鹿茸"],
});
const OFFICIAL_IMAGE_PATHS = Object.freeze({
  "guilu-gao": "/images/products-v3/guilu-gao.jpg",
  "guilu-drink-30": "/images/products-v3/guilu-drink-30.jpg",
  "guilu-drink-180": "/images/products-v3/guilu-drink-180.jpg",
  "guilu-tangkuai": "/images/products-v3/guilu-tangkuai.jpg",
  "guilu-jiao": "/images/products-v3/guilu-jiao.jpg",
  "luerong-fen": "/images/products-v3/luerong-fen.jpg",
});

function hasBuyTenGetOne(product, unitPrice) {
  return (product.offers || []).some((offer) =>
    Number(offer.qty) === 11
    && Number(offer.total) === Number(unitPrice) * 10
    && String(offer.label) === "買10送1"
  );
}
function sameArray(left, right) { return JSON.stringify(left || []) === JSON.stringify(right || []); }
function assertOfficialImageSlots(product, id) {
  const expected = OFFICIAL_IMAGE_PATHS[id];
  if (!expected) throw new Error(`${id}缺少正式產品原圖權威路徑`);
  for (const field of ["image", "imageUrl", "image_url", "dmImage", "officialOriginalImage"]) {
    if (!String(product?.[field] || "").includes(expected)) throw new Error(`${id}.${field} 未使用products-v3正式產品原圖`);
  }
  if (product.imagePolicy !== "approved-original-product-photo-contain-no-crop") throw new Error(`${id}圖片政策不同步`);
  if (!String(product.physicalScalePolicy || "").trim()) throw new Error(`${id}缺少個別產品實際尺寸／比例政策`);
}
function assertPhysicalScaleAuthority(products) {
  const byId = Object.fromEntries((products || []).map((product) => [product.id, product]));
  const p30 = String(byId["guilu-drink-30"]?.physicalScalePolicy || "");
  const p180 = String(byId["guilu-drink-180"]?.physicalScalePolicy || "");
  const pGao = String(byId["guilu-gao"]?.physicalScalePolicy || "");
  const pSoup = String(byId["guilu-tangkuai"]?.physicalScalePolicy || "");
  const pJiao = String(byId["guilu-jiao"]?.physicalScalePolicy || "");
  const pPowder = String(byId["luerong-fen"]?.physicalScalePolicy || "");
  if (!/Ø42.*H51|小玻璃裸罐/i.test(p30)) throw new Error("30cc個別尺寸政策必須保留Ø42×H51mm小玻璃裸罐規則");
  if (!/0\.60.*0\.68|狹長直立鋁袋/i.test(p180)) throw new Error("180cc個別比例政策必須保留狹長鋁袋0.60～0.68規則");
  if (!/51.*78|六角玻璃罐/i.test(pGao)) throw new Error("龜鹿膏100g尺寸政策必須保留51×78mm／六角罐規則");
  if (!/毫米尺寸未知|不得自行猜測|深藍正式盒/i.test(pSoup)) throw new Error("龜鹿湯塊尺寸未知時不得自行猜測");
  if (!/毫米尺寸未知|不得自行猜測|淡紫正式盒/i.test(pJiao)) throw new Error("龜鹿膠尺寸未知時不得自行猜測");
  if (!/毫米尺寸未知|不得自行猜測|白色塑膠罐/i.test(pPowder)) throw new Error("鹿茸粉尺寸未知時不得自行猜測");
}
function assertSoupAuthority(product) {
  if (!product) throw new Error("龜鹿湯塊不存在");
  const specification = String(product.specification || product.size || product.spec || "");
  if (specification !== "75g／盒｜8塊裝｜每塊約9.375g") throw new Error(`龜鹿湯塊正式規格不同步：${specification}`);
  if (Array.isArray(product.variants) && product.variants.length) throw new Error("龜鹿湯塊不得再保留其他容量 variants");
  if (product.variantSelectionMode) throw new Error("龜鹿湯塊不得再使用多規格選擇模式");
  const value = JSON.stringify(product);
  if (/龜鹿湯塊.{0,80}(300g|600g)|guilu-tangkuai-(300|600)|PROD-SOUP-(300|600)/i.test(value)) throw new Error("龜鹿湯塊仍含未核准容量");
}

function main() {
  const mode = process.argv.includes("--write") ? "write" : "check";
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const master = JSON.parse(fs.readFileSync(MASTER_PATH, "utf8"));
  const authority = JSON.parse(fs.readFileSync(AUTHORITY_PATH, "utf8"));
  const merged = applyMaster(data);
  const photoAuthority = getPhotoAuthority();

  if (master.version !== merged.salesMasterVersion) throw new Error("正式銷售主檔版本套用失敗");
  if (master.version !== MASTER_VERSION) throw new Error(`正式主檔版本不是目前v7：${master.version}`);
  if (photoAuthority.version !== PHOTO_VERSION) throw new Error(`正式產品照片權威版本不同步：${photoAuthority.version}`);
  if (Object.keys(photoAuthority.products || {}).length !== 6) throw new Error("正式產品照片權威必須剛好6項");
  if ((merged.offers?.comboOffers || []).length !== 3) throw new Error("正式組合必須是3組");
  if ((merged.combos || []).length !== 3) throw new Error("根層正式組合資料必須是3組");
  if ((merged.products || []).length !== 6) throw new Error(`正式產品必須剛好6項，目前${merged.products?.length || 0}項`);
  if ((authority.products || []).length !== 6) throw new Error("LINE正式產品權威必須剛好6項");

  const expected = {
    "guilu-gao": { price: 1800, originalPrice: 2100 },
    "guilu-drink-30": { price: 60, buyTenGetOne: true, total: 600 },
    "guilu-drink-180": { price: 200, buyTenGetOne: true, total: 2000 },
    "guilu-tangkuai": { price: 1600 },
    "luerong-fen": { price: 2000 },
    "guilu-jiao": { price: 9600, originalPrice: 12000, quoteOnly: false },
  };
  const authorityById = new Map(authority.products.map((item) => [item.id, item]));
  const drinkIds = new Set(authority.fulfillmentPolicy.drinkProductIds);
  const readyStockIds = new Set(authority.fulfillmentPolicy.readyStockProductIds);

  for (const [id, rule] of Object.entries(expected)) {
    const product = merged.products.find((item) => item.id === id);
    const official = authorityById.get(id);
    if (!product || !official) throw new Error(`${id}不存在`);
    if (product.name !== official.name) throw new Error(`${id}正式名稱不同步：${product.name}`);
    if ((product.specification || product.size || product.spec) !== official.specification) throw new Error(`${id}正式規格不同步`);
    if (!sameArray(product.ingredients, CANONICAL_INGREDIENTS[id])) throw new Error(`${id}正式成分或順序不同步`);
    if (Number(product.price) !== rule.price) throw new Error(`${id}正式售價不同步`);
    if (official.retailPrice !== undefined && Number(product.price) !== Number(official.retailPrice)) throw new Error(`${id}與唯一權威售價不同步`);
    if (rule.originalPrice !== undefined && Number(product.originalPrice) !== rule.originalPrice) throw new Error(`${id}正式原價不同步`);
    if (rule.quoteOnly !== undefined && Boolean(product.quoteOnly) !== rule.quoteOnly) throw new Error(`${id}洽詢模式設定不正確`);
    if (rule.buyTenGetOne && !hasBuyTenGetOne(product, rule.price)) throw new Error(`${id}買10送1沒有轉成可正確計價的11入方案`);
    if (rule.total !== undefined && Number((product.offers || []).find((offer) => offer.label === "買10送1")?.total) !== rule.total) throw new Error(`${id}11入活動總額不同步`);
    if ((product.offers || []).some((offer) => typeof offer !== "object" || !offer.label)) throw new Error(`${id}活動格式無法供購物車使用`);
    assertOfficialImageSlots(product, id);

    const notice = String(product.fulfillmentNotice || "");
    if (drinkIds.has(id)) {
      if (product.fulfillmentType !== "made-to-order-drink" || product.readyStock !== false || product.productionLeadTime !== "5～7個工作天") throw new Error(`${id}龜鹿飲製作欄位不同步`);
      if (!notice.includes("製作加工約需5～7個工作天") || !notice.includes("完成後才安排出貨")) throw new Error(`${id}龜鹿飲出貨說明不同步`);
    }
    if (readyStockIds.has(id)) {
      if (product.fulfillmentType !== "ready-stock" || product.readyStock !== true || product.productionLeadTime !== null) throw new Error(`${id}備貨商品欄位不同步`);
      if (!notice.includes("預先製作備貨商品") || /5\s*[～~〜－-]\s*7/.test(notice)) throw new Error(`${id}不得套用龜鹿飲交期`);
    }
  }

  assertPhysicalScaleAuthority(merged.products);

  const gao = merged.products.find((item) => item.id === "guilu-gao");
  if (gao?.usage?.[0] !== "每日早上及下午各一小匙") throw new Error("龜鹿膏正式使用方式不同步");
  if ((gao?.usage || []).some((line) => String(line).includes("每天一次，每次一小匙"))) throw new Error("龜鹿膏仍含舊的一日一次用法");
  assertSoupAuthority(merged.products.find((item) => item.id === "guilu-tangkuai"));

  const drink30 = merged.products.find((item) => item.id === "guilu-drink-30");
  if (drink30?.priceLabel !== "正式售價60元／罐，買10送1（共11罐600元）") throw new Error("30cc正式價格文案不同步");
  if (merged.trialCampaign?.contents !== "30cc小玻璃罐×3罐" || Number(merged.trialCampaign?.productFee) !== 0) throw new Error("試喝正式內容必須是30cc小玻璃罐×3罐且試喝品免費");
  const shipping = (merged.trialCampaign?.shippingOptions || []).map((item) => [item.id, Number(item.fee)]);
  if (JSON.stringify(shipping) !== JSON.stringify([["store",60],["home",100]])) throw new Error("試喝正式運費必須是7-11 60元、郵局宅配100元");
  if (merged.trialCampaign?.publicPrice !== "龜鹿飲30cc正式售價60元／罐；買10送1，共11罐600元；180cc鋁袋單包200元，買10送1，共11包2,000元") throw new Error("試喝方案公開價格不同步");
  if (merged.fulfillmentPolicy?.version !== "2026-08-08-v5") throw new Error("出貨政策版本不同步");
  if (merged.runtime?.imagePolicy?.dmFallback !== "approved-original-photo-until-current-dm-reviewed") throw new Error("DM正式產品原圖回退政策未啟用");
  if (merged.runtime?.imagePolicy?.productMainImageSource !== "products-v3-user-approved-originals") throw new Error("產品主圖沒有鎖到products-v3");
  if (merged.runtime?.imagePolicy?.productsV2Use !== "legacy-reference-only") throw new Error("舊products-v2沒有降級為歷史參考");
  if (merged.runtime?.imagePolicy?.productScalePolicy !== "uniform-only-no-equal-height-equal-width") throw new Error("產品實際比例政策沒有啟用");

  if (mode === "write") {
    fs.writeFileSync(DATA_PATH, stable(merged), "utf8");
    console.log(`SYNCED LINE OA sales master ${master.version}: six products, canonical facts, products-v3 originals and per-product physical scale rules`);
    return;
  }
  console.log(`PASS LINE OA sales master ${master.version}: canonical facts, pricing, trial, fulfillment, products-v3 and per-product physical scale rules aligned`);
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.message || error); process.exit(1); }
}

module.exports = { stable, hasBuyTenGetOne, assertSoupAuthority, assertOfficialImageSlots, assertPhysicalScaleAuthority, sameArray, CANONICAL_INGREDIENTS, OFFICIAL_IMAGE_PATHS, MASTER_VERSION, PHOTO_VERSION };
