"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const snapshot = require("./line-partner-public-carousel.json");
const source = fs.readFileSync("line-public-catalog-runtime.js", "utf8");
const moduleShim = { exports: {} };
let partners = snapshot.products.map(p => ({...p, size:p.specification, public:true}));
let ids = partners.map(p=>p.id);
let available = true;
const sandbox = {
  module: moduleShim,
  require: request => {
    assert.equal(request, "./line-partner-public-carousel.json");
    return snapshot;
  },
  console: { warn: () => {} },
  AbortSignal,
  fetch: async url => {
    if (!available) throw new Error("network unavailable");
    if (url.endsWith("partner-catalog.json")) return {ok:true,json:async()=>({products:partners})};
    if (url.endsWith("products.html")) return {ok:true,text:async()=>ids.map(id=>`<article data-fallback-product="${id}"></article>`).join("")};
    throw new Error("unexpected URL");
  },
};
vm.runInNewContext(source, sandbox, {timeout:1000});
const runtime = moduleShim.exports;
(async () => {
  assert.equal(runtime.current().length, snapshot.products.length, "初始保留正式商品快照");
  partners.push({id:"future-approved",name:"正式核准新品",size:"50g／盒",
    page:"product-future-approved.html",image:"images/catalog/new-approved.webp",public:true});
  partners.push({id:"future-private",name:"未公開新品",size:"50g／盒",
    page:"product-future-private.html",image:"images/catalog/private.webp",public:false});
  ids = partners.map(p=>p.id);
  await runtime.refresh({force:true});
  assert.ok(runtime.current().some(x=>x.id==="future-approved"), "核准新品應自動同步");
  assert.ok(!runtime.current().some(x=>x.id==="future-private"), "未公開新品不可被同步");
  partners = partners.map(p=>({...p,public:false}));
  await runtime.refresh({force:true});
  assert.equal(runtime.current().length,0,"官網全部撤銷公開時應同步清除舊卡，不能保留快照");
  available = false;
  await runtime.refresh({force:true});
  assert.equal(runtime.current().length,0,"官網連線失敗應保留已核准最近狀態，不得重建舊卡");
  console.log("PASS: LINE 商品卡依官網公開狀態新增、下架及斷線保護。");
})().catch(error=>{console.error(error);process.exitCode=1;});
