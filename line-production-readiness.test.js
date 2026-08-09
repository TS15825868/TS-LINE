"use strict";
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { applyMaster } = require("./product-sales-master");
const rich = require("./line-rich-menu-sync");
const visual = require("./line-recording-ui-fix");
const fulfillment = require("./product-fulfillment-message-fix");

const read = (file) => fs.readFileSync(path.join(__dirname, file), "utf8");
const rawData = JSON.parse(read("data.json"));
const data = applyMaster(rawData);
const serverSource = read("server.js");
const internalEntrySource = read("internal-entry.js");
const syncSource = read("tools/sync_sales_master.js");
const richSource = read("line-rich-menu-sync.js");
const packageJson = JSON.parse(read("package.json"));

assert.equal(data.products.length, 6, "正式產品必須剛好六項");
const byId = Object.fromEntries(data.products.map((p) => [p.id, p]));
const expected = {
  "guilu-gao": { spec: "100g／罐", price: 1800, ready: true },
  "guilu-drink-30": { spec: "30cc／罐（小玻璃罐）", price: 60, offerQty: 11, offerTotal: 600, ready: false },
  "guilu-drink-180": { spec: "180cc／包（鋁袋）", price: 200, offerQty: 11, offerTotal: 2000, ready: false },
  "guilu-tangkuai": { spec: "75g／盒｜8塊裝｜每塊約9.375g", price: 1600, ready: true },
  "guilu-jiao": { spec: "600g（1斤）／盒｜32塊裝｜每塊約18.75g", price: 9600, ready: true },
  "luerong-fen": { spec: "75g／罐", price: 2000, ready: true },
};
for (const [id, rule] of Object.entries(expected)) {
  const p = byId[id];
  assert.ok(p, `${id} 不存在`);
  assert.equal(p.specification || p.size || p.spec, rule.spec, `${id} 正式規格不同步`);
  assert.equal(Number(p.price), rule.price, `${id} 正式售價不同步`);
  assert.equal(Boolean(p.readyStock), rule.ready, `${id} 備貨狀態不同步`);
  for (const field of ["image", "imageUrl", "image_url", "dmImage", "officialOriginalImage"]) {
    assert.ok(String(p[field] || "").includes("/images/products-v3/"), `${id}.${field} 套用正式母本後仍非 products-v3`);
    assert.ok(!String(p[field] || "").includes("/images/products-v2/"), `${id}.${field} 套用正式母本後仍含 products-v2`);
  }
  assert.equal(p.imagePolicy, "approved-original-product-photo-contain-no-crop", `${id} 圖片政策錯誤`);
  assert.equal(p.physicalScalePolicy, "uniform-only-preserve-realistic-product-scale", `${id} 尺寸比例政策錯誤`);
  if (rule.offerQty) {
    const offer = (p.offers || []).find((o) => Number(o.qty) === rule.offerQty);
    assert.ok(offer, `${id} 缺少買10送1方案`);
    assert.equal(Number(offer.total), rule.offerTotal, `${id} 買10送1總額錯誤`);
  }
}
assert.equal(byId["guilu-drink-30"].name, "龜鹿飲30cc玻璃罐");
assert.ok(!/玻璃瓶|30cc／瓶|瓶裝/.test(JSON.stringify(byId["guilu-drink-30"])), "30cc 正式資料不得出現玻璃瓶／瓶裝");
assert.equal(byId["guilu-drink-30"].productionLeadTime, "5～7個工作天");
assert.equal(byId["guilu-drink-180"].productionLeadTime, "5～7個工作天");
for (const id of ["guilu-gao", "guilu-tangkuai", "guilu-jiao", "luerong-fen"]) assert.equal(byId[id].productionLeadTime, null, `${id} 不得套用龜鹿飲5～7工作天`);
assert.ok(!/(300g|600g).*龜鹿湯塊|龜鹿湯塊.{0,80}(300g|600g)/.test(JSON.stringify(byId["guilu-tangkuai"])), "龜鹿湯塊不得含舊300g/600g規格");

assert.equal(rich.VERSION, "20260809-rich-menu-single-canvas-v10-cohesive");
assert.equal(rich.SINGLE_IMAGE_ONLY, true);
assert.equal(rich.RUNTIME_COMPOSITE_FORBIDDEN, true);
assert.ok(rich.BASE_TEMPLATE.includes("xianjiawei-rich-menu-2500x1686-v309.jpg"));
assert.ok(!richSource.includes("BOSS_SOURCES"), "Rich Menu正式程式不得保留六張後貼圖來源");
assert.ok(!richSource.includes("CELL_LAYOUTS"), "Rich Menu正式程式不得保留六格圖片拼貼座標");
assert.ok(!richSource.includes(".composite("), "Rich Menu正式程式不得使用sharp composite拼湊視覺");
assert.ok(richSource.includes("fullCanvasSvg"), "Rich Menu必須在單一畫布完成視覺");
const richSvg=rich.fullCanvasSvg(Buffer.from("fake"));
assert.equal((richSvg.match(/<image /g)||[]).length,1,"Rich Menu完整畫布只允許一張品牌母版image，不得塞六張照片");
assert.ok((richSvg.match(/<rect /g)||[]).length>=12,"Rich Menu六個視覺區未使用一致向量面板重繪");
const menu = rich.menuDefinition();
assert.deepEqual(menu.areas.map(a => a.action.label), ["看產品","購物車","幫我推薦","搭配組合","怎麼使用","直接下單"]);
assert.deepEqual(menu.areas.map(a => a.action.text), ["看產品","查看購買清單","幫我推薦","搭配組合","怎麼使用","直接下單"]);

assert.equal(visual.VERSION, "20260809-recording-ui-v6-products-v3-size-lock");
for (const p of Object.values(visual.PRODUCTS)) assert.ok(p.image.includes("/images/products-v3/"));
assert.equal(visual.productHero("guilu-drink-30").aspectMode, "fit");
for (const token of [
  '/^(看產品|查看產品|看商品|產品|直接下單|直接購買|我要下單|立即下單|開始下單|我要買)$/',
  '/購物車|購買清單|查看購買清單/',
  '/搭配組合|食補搭配|產品搭配|組合怎麼搭|搭配方式/',
  '/^(怎麼使用|使用方式|食用方式|產品怎麼用)$/',
  '/^(幫我推薦|怎麼選|不知道怎麼選)$/',
]) assert.ok(serverSource.includes(token), `LINE 意圖路由缺失：${token}`);
assert.ok(serverSource.includes('res.json({ ok: true });'), "LINE webhook 必須先快速回 200");
assert.ok(serverSource.indexOf('res.json({ ok: true });') < serverSource.indexOf('Promise.allSettled((req.body.events || []).map(handleEvent))'), "LINE webhook 200 必須早於事件處理");
for (const field of ["lastWebhookAt", "lastReplySuccessAt", "lastReplyError"]) assert.ok(serverSource.includes(field), `LINE health 缺少 ${field}`);
assert.ok(internalEntrySource.indexOf("app.listen(port") < internalEntrySource.indexOf("await bridge.restoreAll()"), "LINE 必須先 listen 再做 Supabase/ERP restore");
assert.ok(syncSource.includes('PHOTO_VERSION = "2026-08-09-products-v3-user-approved-size-lock-v1"'), "prestart 必須驗 products-v3 權威");
assert.equal(packageJson.scripts.prestart, "node tools/sync_sales_master.js --write && node line-production-readiness.test.js", "Render prestart 必須先同步正式母本，再執行完整正式驗收");
assert.ok(packageJson.scripts.start.includes("product-fulfillment-message-fix.js"), "正式啟動必須載入出貨訊息邊界修正");
assert.ok(fulfillment.DRINK_NOTICE.includes("5～7個工作天"));
assert.ok(!fulfillment.READY_STOCK_NOTICE.includes("5～7"));
assert.ok(fulfillment.SOUP_VARIANTS.includes("75g／盒｜8塊裝｜每塊約9.375g"));
console.log("PASS：LINE OA 正式上線條件完整：六產品/價格/出貨/products-v3/尺寸、單一畫布非拼湊Rich Menu、六大意圖、快速Webhook、冷啟動與Render prestart均符合正式規則。");
