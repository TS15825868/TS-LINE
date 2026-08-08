"use strict";
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const safety = require("./line-image-safety");

assert.equal(safety.VERSION, "20260808-direct-start-products-v2-v3-schedule-rich-menu");
assert.equal(safety.photoAuthority.version, "2026-08-08-products-v2-actual-photo-v1");
assert.ok(safety.recordingUiFix.VERSION.includes("recording-ui-v5"));
assert.equal(safety.schedulePolicy.VERSION, "20260808-tue1930-sat0930-v2-idempotent");
assert.equal(safety.richMenuSync.VERSION, "20260809-rich-menu-website-chibi-v3-no-crop-intent");
assert.equal(safety.richMenuSync.OVERLAY_FIT, "contain");

const raw = fs.readFileSync(path.join(__dirname, "data.json"), "utf8");
const data = JSON.parse(raw);
assert.equal(data.products.length, 6);
for (const product of data.products) {
  for (const field of ["image", "imageUrl", "image_url", "dmImage", "officialOriginalImage"]) {
    assert.ok(String(product[field] || "").includes("/images/products-v2/"), `${product.id}.${field} direct-start仍非products-v2`);
    assert.ok(!String(product[field] || "").includes("/images/products-v3/"), `${product.id}.${field} direct-start仍含products-v3`);
    assert.ok(!String(product[field] || "").includes("/images/dm-final/"), `${product.id}.${field} direct-start仍含舊DM`);
  }
  assert.equal(product.imagePolicy, "actual-product-photo-contain-no-crop");
}
assert.equal(data.productPhotoAuthorityVersion, "2026-08-08-products-v2-actual-photo-v1");
assert.equal(data.runtime.productMainImageSource, "products-v2-actual-photos");
assert.equal(data.runtime.productsV3Use, "marketing-layout-reference-only");
assert.equal(data.runtime.schedulePolicyVersion, "20260808-tue1930-sat0930-v2-idempotent");
assert.equal(data.runtime.richMenuSyncVersion, "20260809-rich-menu-website-chibi-v3-no-crop-intent");

const oldBubble = {
  type: "bubble",
  hero: { type: "image", url: "https://example.com/old.jpg" },
  body: { type: "box", layout: "vertical", contents: [
    { type: "text", text: "龜鹿飲30cc玻璃罐｜30cc／罐（小玻璃罐）" },
    { type: "text", text: "每組售價：$6,400" },
  ] },
  footer: { type: "box", layout: "vertical", contents: [{ type: "button", action: { type: "uri", label: "看產品DM", uri: "https://example.com/old-dm.jpg" } }] },
};
safety.recordingUiFix.applyVisualFix(oldBubble);
assert.ok(oldBubble.hero.url.includes("/images/products-v2/guilu-drink-30.jpeg"));
assert.equal(oldBubble.footer.contents[0].action.label, "看實際產品照片");
assert.equal(oldBubble.body.contents[1].text, "商品合計：$6,400");

const menu = safety.richMenuSync.menuDefinition();
assert.equal(menu.areas.at(-1).action.label, "直接下單");
assert.equal(menu.areas.at(-1).action.text, "直接下單");

console.log("PASS：Render直接啟動server.js會載入products-v2、LINE UI v5、週二／週六排程，以及完整不裁切且下單意圖一致的網站Q版Rich Menu。");