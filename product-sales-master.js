"use strict";

const fs = require("fs");
const path = require("path");

const originalReadFileSync = fs.readFileSync.bind(fs);
const masterPath = path.join(__dirname, "line-sales-master.json");
let master = null;

function getMaster() {
  if (master) return master;
  master = JSON.parse(originalReadFileSync(masterPath, "utf8"));
  return master;
}

function rootCombos(comboOffers = []) {
  return comboOffers.map((combo) => ({
    id: combo.id,
    name: combo.name,
    aliases: combo.aliases || [],
    items: combo.items || [],
    gift: combo.gift || "",
    desc: combo.desc || "",
    unit: combo.unit || "組",
    products: combo.products || [],
    quantityOptions: combo.quantityOptions || [1, 2, 3, 5],
    priceNote: "實際組合金額由正式產品建議售價計算；活動與通路條件請洽客服確認。",
  }));
}

function applyMaster(data) {
  const policy = getMaster();
  const productOverrides = policy.products || {};
  const comboOffers = Array.isArray(policy.comboOffers) ? policy.comboOffers : [];

  data.products = (data.products || []).map((product) => ({
    ...product,
    ...(productOverrides[product.id] || {}),
  }));

  data.offers = {
    ...(data.offers || {}),
    comboOffers,
  };
  data.combos = rootCombos(comboOffers);
  data.retentionOffers = {
    ...(data.retentionOffers || {}),
    combos: Object.fromEntries(comboOffers.map((combo) => [
      combo.name,
      "可依組合內容、數量與需求協助整理較適合的方案。",
    ])),
  };

  data.runtime = {
    ...(data.runtime || {}),
    imagePolicy: {
      ...((data.runtime || {}).imagePolicy || {}),
      ...(policy.imagePolicy || {}),
    },
    contentApproval: {
      mode: "review-only",
      defaultStatus: "pending_review",
      scheduleRequiresApproval: true,
      publishRequiresApproval: true,
    },
  };
  data.salesMasterVersion = policy.version;
  data.salesMasterSource = policy.source;
  return data;
}

fs.readFileSync = function patchedReadFileSync(file, ...args) {
  const result = originalReadFileSync(file, ...args);
  try {
    const resolved = path.resolve(String(file));
    if (resolved === path.join(__dirname, "data.json")) {
      const encoding = typeof args[0] === "string" ? args[0] : args[0]?.encoding;
      const text = Buffer.isBuffer(result) ? result.toString(encoding || "utf8") : String(result);
      return JSON.stringify(applyMaster(JSON.parse(text)), null, 2);
    }
  } catch (error) {
    console.error("仙加味售價主檔套用失敗：" + error.message);
    throw error;
  }
  return result;
};

module.exports = { applyMaster, getMaster, rootCombos };
