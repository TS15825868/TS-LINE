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

function applyMaster(data) {
  const policy = getMaster();
  const productOverrides = policy.products || {};
  data.products = (data.products || []).map((product) => ({
    ...product,
    ...(productOverrides[product.id] || {}),
  }));
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

module.exports = { applyMaster, getMaster };
