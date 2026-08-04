"use strict";

const fs = require("fs");
const path = require("path");
const { applyMaster } = require("../product-sales-master");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data.json");
const MASTER_PATH = path.join(ROOT, "line-sales-master.json");
const stable = (value) => JSON.stringify(value, null, 2) + "\n";

function hasBuyTenGetOne(product, unitPrice) {
  return (product.offers || []).some((offer) =>
    Number(offer.qty) === 11
    && Number(offer.total) === Number(unitPrice) * 10
    && String(offer.label) === "買10送1"
  );
}

function main() {
  const mode = process.argv.includes("--write") ? "write" : "check";
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const master = JSON.parse(fs.readFileSync(MASTER_PATH, "utf8"));
  const merged = applyMaster(data);

  if (master.version !== merged.salesMasterVersion) throw new Error("正式售價主檔版本套用失敗");
  if ((merged.offers?.comboOffers || []).length !== 3) throw new Error("正式組合必須是3組");
  if ((merged.combos || []).length !== 3) throw new Error("根層正式組合資料必須是3組");

  const expected = {
    "guilu-gao": { price: 1800, originalPrice: 2100 },
    "guilu-drink-30": { price: 50, buyTenGetOne: true },
    "guilu-drink-180": { price: 200, buyTenGetOne: true },
    "guilu-tangkuai": { price: 1600 },
    "luerong-fen": { price: 2000 },
    "guilu-jiao": { price: 9600, originalPrice: 12000, quoteOnly: false },
  };

  for (const [id, rule] of Object.entries(expected)) {
    const product = merged.products.find((item) => item.id === id);
    if (!product) throw new Error(`${id} 不存在`);
    if (Number(product.price) !== rule.price) throw new Error(`${id} 正式售價不同步`);
    if (rule.originalPrice !== undefined && Number(product.originalPrice) !== rule.originalPrice) {
      throw new Error(`${id} 正式原價不同步`);
    }
    if (rule.quoteOnly !== undefined && Boolean(product.quoteOnly) !== rule.quoteOnly) {
      throw new Error(`${id} 洽詢模式設定不正確`);
    }
    if (rule.buyTenGetOne && !hasBuyTenGetOne(product, rule.price)) {
      throw new Error(`${id} 買10送1沒有轉成可正確計價的11入方案`);
    }
    if ((product.offers || []).some((offer) => typeof offer !== "object" || !offer.label)) {
      throw new Error(`${id} 活動格式無法供購物車使用`);
    }
  }

  if (mode === "write") {
    fs.writeFileSync(DATA_PATH, stable(merged), "utf8");
    console.log(`SYNCED LINE OA sales master ${master.version}`);
    return;
  }

  console.log(`PASS LINE OA sales master ${master.version} with cart-safe buy10get1 offers`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = { stable, hasBuyTenGetOne };
