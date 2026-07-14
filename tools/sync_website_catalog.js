"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data.json");
const DEFAULT_CATALOG_URL = "https://raw.githubusercontent.com/TS15825868/xianjiawei/main/catalog-public.json";
const WEBSITE_BASE = "https://ts15825868.github.io/xianjiawei/";
const LINE_DATA_VERSION = "401.6";
const EXPECTED_IDS = [
  "guilu-gao",
  "guilu-drink-30",
  "guilu-drink-180",
  "guilu-tangkuai",
  "guilu-jiao",
  "luerong-fen",
];
const SHARED_FIELDS = [
  "series",
  "name",
  "displayName",
  "size",
  "image",
  "dmImage",
  "description",
  "ingredients",
  "usage",
  "storage",
  "fit",
  "page",
  "purpose",
  "purposeDirection",
];
const SALES_FIELDS = [
  "aliases",
  "spec",
  "price",
  "originalPrice",
  "unit",
  "offers",
  "quantityOptions",
  "priceText",
  "priceLabel",
];

function stable(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

function validateCatalog(catalog) {
  if (!catalog || typeof catalog !== "object") throw new Error("共用目錄格式錯誤");
  if (catalog.lineId !== "@762jybnm") throw new Error(`共用目錄 LINE ID 不一致：${catalog.lineId}`);
  const ids = (catalog.products || []).map((product) => product.id);
  if (JSON.stringify(ids) !== JSON.stringify(EXPECTED_IDS)) {
    throw new Error(`共用目錄產品順序或品項不一致：${ids.join(", ")}`);
  }
  for (const product of catalog.products) {
    for (const field of ["id", "displayName", "size", "image", "dmImage", "description", "ingredients", "usage", "page"]) {
      if (!product[field] || (Array.isArray(product[field]) && !product[field].length)) {
        throw new Error(`${product.id} 共用目錄缺少 ${field}`);
      }
    }
  }
}

function normalizeWebsiteValue(field, value, catalogVersion) {
  if (typeof value !== "string") return value;
  let normalized = value;
  if (normalized.startsWith(WEBSITE_BASE)) normalized = normalized.slice(WEBSITE_BASE.length);
  if ((field === "image" || field === "dmImage") && normalized.startsWith("images/")) {
    normalized = normalized.replace(/\?v=[^&]+$/, "");
    normalized += `?v=${catalogVersion}`;
  }
  return normalized;
}

function normalizeComboItems(data) {
  const replacements = new Map([
    ["龜鹿飲 5 包", "龜鹿飲180cc 5 包"],
    ["龜鹿飲 10 包", "龜鹿飲180cc 10 包"],
  ]);
  for (const combo of data.offers?.comboOffers || []) {
    combo.items = (combo.items || []).map((item) => replacements.get(item) || item);
  }
}

function mergeCatalog(localData, catalog) {
  validateCatalog(catalog);
  const localById = new Map((localData.products || []).map((product) => [product.id, product]));
  const mergedProducts = catalog.products.map((publicProduct) => {
    const local = localById.get(publicProduct.id);
    if (!local) throw new Error(`LINE OA 缺少銷售產品：${publicProduct.id}`);

    const merged = { id: publicProduct.id };
    for (const field of SHARED_FIELDS) {
      if (publicProduct[field] !== undefined) {
        merged[field] = normalizeWebsiteValue(field, publicProduct[field], catalog.catalogVersion);
      }
    }
    for (const field of SALES_FIELDS) {
      if (local[field] !== undefined) merged[field] = local[field];
    }
    return merged;
  });

  const syncedDate = String(catalog.updatedAt || new Date().toISOString().slice(0, 10));
  const result = {
    ...localData,
    brand: catalog.brand || localData.brand,
    lineId: catalog.lineId || localData.lineId,
    siteUrl: catalog.siteUrl || localData.siteUrl,
    store: catalog.store || localData.store,
    payments: catalog.payments || localData.payments,
    shipping: catalog.shipping || localData.shipping,
    products: mergedProducts,
    version: LINE_DATA_VERSION,
    updatedAt: syncedDate,
    catalogVersion: catalog.catalogVersion,
    catalogSource: {
      ...(catalog.source || localData.catalogSource || {}),
      role: "官網與 LINE OA 共用公開產品資料來源",
    },
    catalogSyncedAt: syncedDate,
    mascotAssets: localData.mascotAssets
      ? {
          ...localData.mascotAssets,
          version: LINE_DATA_VERSION,
          verifiedAt: syncedDate,
        }
      : localData.mascotAssets,
  };
  normalizeComboItems(result);
  return result;
}

async function fetchCatalog() {
  const url = process.env.CATALOG_URL || DEFAULT_CATALOG_URL;
  const response = await fetch(url, { headers: { "user-agent": "xianjiawei-lineoa-catalog-sync" } });
  if (!response.ok) throw new Error(`無法下載共用目錄：HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const mode = process.argv.includes("--write") ? "write" : "check";
  const localData = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const catalog = await fetchCatalog();
  const merged = mergeCatalog(localData, catalog);

  if (mode === "write") {
    fs.writeFileSync(DATA_PATH, stable(merged), "utf8");
    console.log(`SYNCED LINE OA data.json ${LINE_DATA_VERSION} from website catalog ${catalog.catalogVersion}`);
    return;
  }

  if (stable(localData) !== stable(merged)) {
    throw new Error("LINE OA data.json 與官網共用目錄不同步，請執行 npm run sync:catalog");
  }
  console.log(`PASS shared catalog ${catalog.catalogVersion}: public product fields and LINE sales fields are consistent`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = {
  LINE_DATA_VERSION,
  mergeCatalog,
  validateCatalog,
  normalizeComboItems,
  normalizeWebsiteValue,
  EXPECTED_IDS,
  SHARED_FIELDS,
  SALES_FIELDS,
};
