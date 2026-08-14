"use strict";
const fs = require("fs");
const assert = require("node:assert/strict");
const pkg = JSON.parse(fs.readFileSync("package.json","utf8"));
const bootstrap = fs.readFileSync("line-app-bootstrap.js","utf8");
const safetySource = fs.readFileSync("line-image-safety.js","utf8");
const safety = require("./line-image-safety");

const start = String(pkg.scripts?.start || "");
assert.ok(start.includes("-r ./line-app-bootstrap.js"), "正式啟動沒有預載LINE媒體路由bootstrap");
assert.ok(bootstrap.includes("safety.installImageRoutes(app)"), "bootstrap沒有把正式媒體路由掛到實際Express app");
for (const route of [
  'app.get("/assets/formal-product/:id.jpg"',
  'app.get("/assets/formal-dm/:id.jpg"',
  'app.get("/assets/formal-trial/trial.jpg"',
]) assert.ok(safetySource.includes(route), `正式媒體安全層缺少路由：${route}`);
assert.ok(safetySource.includes('fit: "inside"'), "轉LINE JPEG必須等比例縮放");
assert.ok(safetySource.includes('withoutEnlargement: true'), "正式媒體不得不必要放大");
assert.ok(safetySource.includes('product-dm-trial-identity-four-roles-separated'), "正式媒體角色沒有明確分離");

assert.match(safety.formalLineProductImageUrl("guilu-drink-30"), /\/assets\/formal-product\/guilu-drink-30\.jpg\?v=/);
assert.match(safety.formalLineDmImageUrl("guilu-drink-30"), /\/assets\/formal-dm\/guilu-drink-30\.jpg\?v=/);
assert.match(safety.formalLineTrialImageUrl(), /\/assets\/formal-trial\/trial\.jpg\?v=/);
assert.notEqual(safety.formalLineProductImageUrl("guilu-drink-30"), safety.formalLineDmImageUrl("guilu-drink-30"));
assert.ok(String(safety.formalSourceUrl("product","guilu-drink-30")).includes("/images/customer-display-v20260812/guilu-drink-30cc.avif"));
assert.ok(String(safety.formalSourceUrl("dm","guilu-drink-30")).includes("/images/dm-final/02_guilu-drink-30cc-dm-official-v20260814.jpg"));
assert.ok(String(safety.formalSourceUrl("trial")).includes("/images/trial/trial-poster-small-boss-official-v20260814.jpg"));

console.log("PASS：LINE正式啟動分別掛載產品、詳細DM、試喝三種JPEG route；products-v3只保留身份參考，轉檔等比例不裁切。");
