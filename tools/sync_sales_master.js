"use strict";

const fs = require("fs");
const path = require("path");
const { applyMaster, getCurrentAuthority, getPhotoAuthority } = require("../product-sales-master");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data.json");
const MASTER_PATH = path.join(ROOT, "line-sales-master.json");
const AUTHORITY_PATH = path.join(ROOT, "assets/data/official-products.json");
const stable = (value) => JSON.stringify(value, null, 2) + "\n";

const PHOTO_AUTHORITY_AT_LOAD = getPhotoAuthority();
const PHOTO_VERSION = String(PHOTO_AUTHORITY_AT_LOAD?.version || "").trim();
const PHOTO_CACHE_VERSION = String(Object.values(PHOTO_AUTHORITY_AT_LOAD?.products || {})[0] || "").match(/[?&]v=([^&#]+)/)?.[1] || "";

const OFFICIAL_IMAGE_PATHS = Object.freeze({
  "guilu-gao": "/images/products-v3/guilu-gao.jpg",
  "guilu-drink-30": "/images/products-v3/guilu-drink-30.jpg",
  "guilu-drink-180": "/images/products-v3/guilu-drink-180.jpg",
  "guilu-tangkuai": "/images/products-v3/guilu-tangkuai.jpg",
  "guilu-jiao": "/images/products-v3/guilu-jiao.jpg",
  "luerong-fen": "/images/products-v3/luerong-fen.jpg",
});

function hasBuyTenGetOne(product, unitPrice) {
  return (product.offers || []).some((offer) => Number(offer.qty) === 11 && Number(offer.total) === Number(unitPrice) * 10 && String(offer.label) === "買10送1");
}
function sameArray(left, right) { return JSON.stringify(left || []) === JSON.stringify(right || []); }
function authorityMaps(authority) {
  const products = authority?.products || [];
  return {
    byId: new Map(products.map((item) => [item.id, item])),
    specs: Object.fromEntries(products.map((item) => [item.id, item.specification])),
    ingredients: Object.fromEntries(products.map((item) => [item.id, item.ingredients || []])),
  };
}
function assertOfficialImageSlots(product, id) {
  const expected = OFFICIAL_IMAGE_PATHS[id];
  if (!expected) throw new Error(`${id}缺少正式產品原圖權威路徑`);
  for (const field of ["image", "imageUrl", "image_url", "dmImage", "officialOriginalImage"]) {
    if (!String(product?.[field] || "").includes(expected)) throw new Error(`${id}.${field} 未使用products-v3正式產品原圖`);
  }
  if (product.imagePolicy !== "approved-original-product-photo-contain-no-crop") throw new Error(`${id}圖片政策不同步`);
  if (!String(product.physicalScalePolicy || "").trim()) throw new Error(`${id}缺少個別產品實際尺寸／比例政策`);
}
function assertPhotoAuthority(photoAuthority) {
  const version = String(photoAuthority?.version || "").trim();
  if (!version) throw new Error("正式產品照片權威缺少版本識別");
  const entries = Object.entries(photoAuthority?.products || {});
  if (entries.length !== 6) throw new Error("正式產品照片權威必須剛好6項");
  const cacheVersions = new Set();
  for (const [id, url] of entries) {
    const value = String(url || "");
    if (!value.includes("/images/products-v3/")) throw new Error(`${id}照片權威不得離開products-v3正式原圖目錄`);
    if (value.includes("/images/products-v2/")) throw new Error(`${id}照片權威不得回退products-v2`);
    const cacheVersion = value.match(/[?&]v=([^&#]+)/)?.[1] || "";
    if (!cacheVersion) throw new Error(`${id}照片網址缺少快取版本`);
    cacheVersions.add(cacheVersion);
  }
  if (cacheVersions.size !== 1) throw new Error("六項正式產品照片網址快取版本必須一致");
  return { version, cacheVersion: [...cacheVersions][0] };
}
function assertPhysicalScaleAuthority(products) {
  const byId = Object.fromEntries((products || []).map((product) => [product.id, product]));
  if (!/Ø42.*H51|小玻璃裸罐/i.test(String(byId["guilu-drink-30"]?.physicalScalePolicy || ""))) throw new Error("30cc個別尺寸政策必須保留小玻璃裸罐規則");
  if (!/0\.60.*0\.68|狹長直立鋁袋/i.test(String(byId["guilu-drink-180"]?.physicalScalePolicy || ""))) throw new Error("180cc個別比例政策必須保留狹長鋁袋規則");
  if (!/51.*78|六角玻璃罐/i.test(String(byId["guilu-gao"]?.physicalScalePolicy || ""))) throw new Error("龜鹿膏100g尺寸政策必須保留六角罐規則");
  for (const id of ["guilu-tangkuai", "guilu-jiao", "luerong-fen"]) if (!String(byId[id]?.physicalScalePolicy || "").trim()) throw new Error(`${id}缺少個別產品比例政策`);
}
function assertSoupAuthority(product, formalSpec) {
  if (!product) throw new Error("龜鹿湯塊不存在");
  const specification = String(product.specification || product.size || product.spec || "");
  if (specification !== formalSpec) throw new Error(`龜鹿湯塊正式規格不同步：${specification}`);
  if (Array.isArray(product.variants) && product.variants.length) throw new Error("龜鹿湯塊不得再保留其他容量 variants");
  if (product.variantSelectionMode) throw new Error("龜鹿湯塊不得再使用多規格選擇模式");
  if (/龜鹿湯塊.{0,80}(300g|600g)|guilu-tangkuai-(300|600)|PROD-SOUP-(300|600)/i.test(JSON.stringify(product))) throw new Error("龜鹿湯塊仍含未核准容量");
}
function assertMasterVersion(master, merged) {
  const masterVersion = String(master?.version || "").trim();
  const mergedVersion = String(merged?.salesMasterVersion || "").trim();
  if (!masterVersion) throw new Error("正式銷售主檔缺少版本識別");
  if (!mergedVersion.startsWith(masterVersion)) throw new Error(`正式銷售主檔未成功套用：${mergedVersion}`);
}

function main() {
  const mode = process.argv.includes("--write") ? "write" : "check";
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const master = JSON.parse(fs.readFileSync(MASTER_PATH, "utf8"));
  const authority = getCurrentAuthority();
  const merged = applyMaster(data);
  const photoAuthority = getPhotoAuthority();
  const { byId: authorityById, specs, ingredients } = authorityMaps(authority);

  if (authority.authority !== "user-confirmed-current" || authorityById.size !== 6) throw new Error("LINE目前產品權威不是最新六項user-confirmed-current");
  assertMasterVersion(master, merged);
  const { version: currentPhotoVersion, cacheVersion: currentPhotoCacheVersion } = assertPhotoAuthority(photoAuthority);
  if (currentPhotoVersion !== PHOTO_VERSION || currentPhotoCacheVersion !== PHOTO_CACHE_VERSION) throw new Error("正式產品照片權威在啟動檢查期間發生版本漂移");
  if ((merged.offers?.comboOffers || []).length !== 3 || (merged.combos || []).length !== 3) throw new Error("正式組合必須是3組");
  if ((merged.products || []).length !== 6) throw new Error(`正式產品必須剛好6項，目前${merged.products?.length || 0}項`);

  const expectedPrices = {
    "guilu-gao": { price: 1800, originalPrice: 2100 },
    "guilu-drink-30": { price: 60, buyTenGetOne: true, total: 600 },
    "guilu-drink-180": { price: 200, buyTenGetOne: true, total: 2000 },
    "guilu-tangkuai": { price: 1600 },
    "luerong-fen": { price: 2000 },
    "guilu-jiao": { price: 9600, originalPrice: 12000, quoteOnly: false },
  };
  const drinkIds = new Set(authority.fulfillmentPolicy?.drinkProductIds || []);
  const readyStockIds = new Set(authority.fulfillmentPolicy?.readyStockProductIds || []);
  if (JSON.stringify([...drinkIds].sort()) !== JSON.stringify(["guilu-drink-180", "guilu-drink-30"])) throw new Error("龜鹿飲交期適用產品必須是30cc與180cc");
  if (JSON.stringify([...readyStockIds].sort()) !== JSON.stringify(["guilu-gao", "guilu-jiao", "guilu-tangkuai", "luerong-fen"])) throw new Error("備貨商品分組不同步");

  for (const [id, rule] of Object.entries(expectedPrices)) {
    const product = merged.products.find((item) => item.id === id);
    const official = authorityById.get(id);
    if (!product || !official) throw new Error(`${id}不存在`);
    if (product.name !== official.name) throw new Error(`${id}正式名稱不同步：${product.name}`);
    const spec = product.specification || product.size || product.spec;
    if (spec !== specs[id] || product.size !== specs[id] || product.spec !== specs[id]) throw new Error(`${id}正式規格未跟目前權威同步：${spec}`);
    if (!sameArray(product.ingredients, ingredients[id])) throw new Error(`${id}正式成分或順序未跟目前權威同步`);
    if (Number(product.price) !== rule.price) throw new Error(`${id}正式售價不同步`);
    if (official.retailPrice !== undefined && Number(product.price) !== Number(official.retailPrice)) throw new Error(`${id}與目前權威售價不同步`);
    if (rule.originalPrice !== undefined && Number(product.originalPrice) !== rule.originalPrice) throw new Error(`${id}正式原價不同步`);
    if (rule.quoteOnly !== undefined && Boolean(product.quoteOnly) !== rule.quoteOnly) throw new Error(`${id}洽詢模式設定不正確`);
    if (rule.buyTenGetOne && !hasBuyTenGetOne(product, rule.price)) throw new Error(`${id}買10送1沒有轉成可正確計價的11入方案`);
    if (rule.total !== undefined && Number((product.offers || []).find((offer) => offer.label === "買10送1")?.total) !== rule.total) throw new Error(`${id}11入活動總額不同步`);
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
  if (gao?.usage?.[0] !== authorityById.get("guilu-gao")?.usagePrimary) throw new Error("龜鹿膏主要使用方式未跟目前權威同步");
  if ((gao?.usage || []).some((line) => /可依個人使用習慣與作息時間安排|早晚各一小匙/.test(String(line)))) throw new Error("龜鹿膏不得回退早晚各一次舊用法");
  const tang = merged.products.find((item) => item.id === "guilu-tangkuai");
  const jiao = merged.products.find((item) => item.id === "guilu-jiao");
  assertSoupAuthority(tang, specs["guilu-tangkuai"]);
  if (/每塊約\s*9\.375g/.test(JSON.stringify(tang))) throw new Error("龜鹿湯塊不得硬帶退役每塊重量延伸");
  if (/1斤|每塊約\s*18\.75g/.test(JSON.stringify(jiao))) throw new Error("龜鹿膠不得硬帶退役1斤／每塊重量延伸");

  const drink30 = merged.products.find((item) => item.id === "guilu-drink-30");
  if (drink30?.priceLabel !== "正式售價60元／罐，買10送1（共11罐600元）") throw new Error("30cc正式價格文案不同步");
  if (/玻璃瓶|30cc／瓶|瓶裝/.test(JSON.stringify(drink30))) throw new Error("30cc不得出現瓶型舊稱");
  if (merged.trialCampaign?.contents !== "30cc小玻璃罐×3罐" || Number(merged.trialCampaign?.productFee) !== 0) throw new Error("試喝正式內容必須是30cc小玻璃罐×3罐且試喝品免費");
  const shipping = (merged.trialCampaign?.shippingOptions || []).map((item) => [item.id, Number(item.fee)]);
  if (JSON.stringify(shipping) !== JSON.stringify([["store",60],["home",100]])) throw new Error("試喝正式運費必須是7-11 60元、郵局宅配100元");
  if (merged.trialCampaign?.publicPrice !== "龜鹿飲30cc正式售價60元／罐；買10送1，共11罐600元；180cc鋁袋單包200元，買10送1，共11包2,000元") throw new Error("試喝方案公開價格不同步");
  if (merged.runtime?.imagePolicy?.productMainImageSource !== "products-v3-user-approved-originals") throw new Error("產品主圖沒有鎖到products-v3");
  if (merged.runtime?.imagePolicy?.productsV2Use !== "legacy-reference-only") throw new Error("舊products-v2沒有降級為歷史參考");

  if (mode === "write") {
    fs.writeFileSync(DATA_PATH, stable(merged), "utf8");
    console.log(`SYNCED LINE OA ${authority.version}: current six specs, usage, pricing, trial, fulfillment, products-v3 ${currentPhotoVersion}/${currentPhotoCacheVersion}`);
    return;
  }
  console.log(`PASS LINE OA ${authority.version}: current authority, pricing, trial, fulfillment, products-v3 ${currentPhotoVersion}/${currentPhotoCacheVersion}`);
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.message || error); process.exit(1); }
}

module.exports = { stable, hasBuyTenGetOne, authorityMaps, assertSoupAuthority, assertOfficialImageSlots, assertPhotoAuthority, assertPhysicalScaleAuthority, assertMasterVersion, sameArray, OFFICIAL_IMAGE_PATHS, PHOTO_VERSION, PHOTO_CACHE_VERSION };
