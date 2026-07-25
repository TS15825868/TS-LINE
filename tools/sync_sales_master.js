"use strict";

const fs = require("fs");
const path = require("path");
const { applyMaster } = require("../product-sales-master");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data.json");
const MASTER_PATH = path.join(ROOT, "line-sales-master.json");
const stable = (value) => JSON.stringify(value, null, 2) + "\n";

function main() {
  const mode = process.argv.includes("--write") ? "write" : "check";
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const master = JSON.parse(fs.readFileSync(MASTER_PATH, "utf8"));
  const merged = applyMaster(data);

  if (master.version !== merged.salesMasterVersion) throw new Error("正式售價主檔版本套用失敗");
  if ((merged.offers?.comboOffers || []).length !== 3) throw new Error("正式組合必須是3組");
  if ((merged.combos || []).length !== 3) throw new Error("舊根層組合資料尚未清除");
  if (JSON.stringify(merged).includes("買10送2")) throw new Error("正式資料仍含舊買10送2活動");

  const jiao = merged.products.find((product) => product.id === "guilu-jiao");
  if (!jiao?.quoteOnly || Number(jiao.price) !== 0) throw new Error("龜鹿膠未切換為洽詢模式");

  const expectedPrices = {
    "guilu-gao": 2000,
    "guilu-drink-30": 100,
    "guilu-drink-180": 200,
    "guilu-tangkuai": 2000,
    "luerong-fen": 2000,
  };
  for (const [id, price] of Object.entries(expectedPrices)) {
    const product = merged.products.find((item) => item.id === id);
    if (Number(product?.price) !== price) throw new Error(`${id} 正式建議售價不同步`);
  }

  if (mode === "write") {
    fs.writeFileSync(DATA_PATH, stable(merged), "utf8");
    console.log(`SYNCED LINE OA sales master ${master.version}`);
    return;
  }
  if (stable(data) !== stable(merged)) throw new Error("LINE OA data.json 尚未套用正式售價、組合與洽詢主檔");
  console.log(`PASS LINE OA sales master ${master.version}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = { stable };
