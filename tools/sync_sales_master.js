"use strict";

const fs = require("fs");
const path = require("path");
const { applyMaster } = require("../product-sales-master");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data.json");
const MASTER_PATH = path.join(ROOT, "line-sales-master.json");
const AUTHORITY_PATH = path.join(ROOT, "assets/data/official-products.json");
const stable = (value) => JSON.stringify(value, null, 2) + "\n";

function hasBuyTenGetOne(product, unitPrice) {
  return (product.offers || []).some((offer) =>
    Number(offer.qty) === 11
    && Number(offer.total) === Number(unitPrice) * 10
    && String(offer.label) === "買10送1"
  );
}

function assertSoupVariants(product) {
  const expected = new Map([
    ["guilu-tangkuai-75", "75g／盒｜8塊裝｜每塊約9.375g"],
    ["guilu-tangkuai-300", "300g／盒｜16塊裝｜每塊約18.75g"],
    ["guilu-tangkuai-600", "600g／盒｜32塊裝｜每塊約18.75g"],
  ]);
  const variants = new Map((product.variants || []).map((item) => [String(item.id), String(item.specification)]));
  for (const [id, specification] of expected) {
    if (variants.get(id) !== specification) throw new Error(`龜鹿湯塊正式規格不同步：${id}`);
  }
  if (product.variantSelectionMode !== "75g可依現行售價加入購物車；300g與600g由人工確認價格、數量與出貨") {
    throw new Error("龜鹿湯塊規格選擇安全規則不同步");
  }
}

function main() {
  const mode = process.argv.includes("--write") ? "write" : "check";
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const master = JSON.parse(fs.readFileSync(MASTER_PATH, "utf8"));
  const authority = JSON.parse(fs.readFileSync(AUTHORITY_PATH, "utf8"));
  const merged = applyMaster(data);

  if (master.version !== merged.salesMasterVersion) throw new Error("正式售價主檔版本套用失敗");
  if ((merged.offers?.comboOffers || []).length !== 3) throw new Error("正式組合必須是3組");
  if ((merged.combos || []).length !== 3) throw new Error("根層正式組合資料必須是3組");
  if ((merged.products || []).length !== 6) throw new Error(`正式產品必須剛好6個分類，目前${merged.products?.length || 0}項`);

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
    if (Number(product.price) !== rule.price) throw new Error(`${id}正式售價不同步`);
    if (official.retailPrice !== undefined && Number(product.price) !== Number(official.retailPrice)) throw new Error(`${id}與唯一權威售價不同步`);
    if (rule.originalPrice !== undefined && Number(product.originalPrice) !== rule.originalPrice) throw new Error(`${id}正式原價不同步`);
    if (rule.quoteOnly !== undefined && Boolean(product.quoteOnly) !== rule.quoteOnly) throw new Error(`${id}洽詢模式設定不正確`);
    if (rule.buyTenGetOne && !hasBuyTenGetOne(product, rule.price)) throw new Error(`${id}買10送1沒有轉成可正確計價的11入方案`);
    if (rule.total !== undefined && Number((product.offers || []).find((offer) => offer.label === "買10送1")?.total) !== rule.total) throw new Error(`${id}11入活動總額不同步`);
    if ((product.offers || []).some((offer) => typeof offer !== "object" || !offer.label)) throw new Error(`${id}活動格式無法供購物車使用`);

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

  const soup = merged.products.find((item) => item.id === "guilu-tangkuai");
  assertSoupVariants(soup || {});

  const drink30 = merged.products.find((item) => item.id === "guilu-drink-30");
  const expectedImagePath = "/images/products-v3/guilu-drink-30.jpg";
  if (!String(drink30?.image || "").includes(expectedImagePath)) throw new Error("30cc商品圖未使用官網正式產品原圖");
  if (!String(drink30?.officialOriginalImage || "").includes(expectedImagePath)) throw new Error("30cc缺少官網正式產品原圖來源");
  if (drink30?.imagePolicy !== "official-original-contain-no-crop") throw new Error("30cc圖片政策不同步");
  if (drink30?.priceLabel !== "正式售價60元／罐，買10送1（共11罐600元）") throw new Error("30cc正式價格文案不同步");
  if (merged.trialCampaign?.publicPrice !== "龜鹿飲30cc正式售價60元／罐；買10送1，共11罐600元；180cc鋁袋單包200元，買10送1，共11包2,000元") throw new Error("試喝方案公開價格不同步");
  if (merged.fulfillmentPolicy?.version !== "2026-08-07-v4") throw new Error("出貨政策版本不同步");

  if (mode === "write") {
    fs.writeFileSync(DATA_PATH, stable(merged), "utf8");
    console.log(`SYNCED LINE OA sales master ${master.version} with soup variants and fulfillment v4`);
    return;
  }

  console.log(`PASS LINE OA sales master ${master.version}: six product families, soup 75/300/600g, 30cc price 60, 11 jars 600 and fulfillment v4`);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = { stable, hasBuyTenGetOne, assertSoupVariants };
