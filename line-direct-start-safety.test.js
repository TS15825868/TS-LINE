"use strict";
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const safety = require("./line-image-safety");

assert.equal(safety.VERSION, "20260809-direct-start-products-v3-size-lock-v4");
assert.equal(safety.photoAuthority.version, "2026-08-09-products-v3-user-approved-size-lock-v1");
assert.ok(safety.recordingUiFix.VERSION.includes("recording-ui-v6"));
assert.equal(safety.schedulePolicy.VERSION, "20260808-tue1930-sat0930-v2-idempotent");
assert.equal(safety.richMenuSync.VERSION, "20260809-rich-menu-website-chibi-v4-full-cell-no-black-gap");
assert.equal(safety.richMenuSync.OVERLAY_FIT, "contain");
assert.ok(safety.richMenuSync.VISUAL_WIDTH >= 740);

const raw = fs.readFileSync(path.join(__dirname, "data.json"), "utf8");
const data = JSON.parse(raw);
assert.equal(data.products.length, 6);
for (const product of data.products) {
  for (const field of ["image", "imageUrl", "image_url", "dmImage", "officialOriginalImage"]) {
    assert.ok(String(product[field] || "").includes("/images/products-v3/"), `${product.id}.${field} direct-start仍非products-v3正式原圖`);
    assert.ok(!String(product[field] || "").includes("/images/products-v2/"), `${product.id}.${field} direct-start仍含舊products-v2`);
    assert.ok(!String(product[field] || "").includes("/images/dm-final/"), `${product.id}.${field} direct-start仍含舊DM`);
  }
  assert.equal(product.imagePolicy, "approved-original-product-photo-contain-no-crop");
  assert.equal(product.physicalScalePolicy, "uniform-only-preserve-realistic-product-scale");
}
assert.equal(data.productPhotoAuthorityVersion, "2026-08-09-products-v3-user-approved-size-lock-v1");
assert.equal(data.runtime.productMainImageSource, "products-v3-user-approved-originals");
assert.equal(data.runtime.productsV2Use, "legacy-reference-only");
assert.equal(data.runtime.productScalePolicy, "uniform-only-no-equal-height-equal-width");
assert.equal(data.runtime.schedulePolicyVersion, "20260808-tue1930-sat0930-v2-idempotent");
assert.equal(data.runtime.richMenuSyncVersion, "20260809-rich-menu-website-chibi-v4-full-cell-no-black-gap");

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
assert.ok(oldBubble.hero.url.includes("/images/products-v3/guilu-drink-30.jpg"));
assert.equal(oldBubble.hero.aspectMode, "fit");
assert.equal(oldBubble.xjwProductScalePolicy, "uniform-only-no-crop-no-stretch");
assert.equal(oldBubble.footer.contents[0].action.label, "看實際產品照片");
assert.equal(oldBubble.body.contents[1].text, "商品合計：$6,400");

const menu = safety.richMenuSync.menuDefinition();
assert.equal(menu.areas.at(-1).action.label, "直接下單");
assert.equal(menu.areas.at(-1).action.text, "直接下單");

console.log("PASS：Render直接啟動server.js會載入products-v3正式原圖、LINE UI v6尺寸鎖、Rich Menu v4全寬無黑洞版，以及完整不裁切且下單意圖一致的六格選單。");
