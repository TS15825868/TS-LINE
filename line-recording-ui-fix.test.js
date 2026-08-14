"use strict";
const assert = require("node:assert/strict");
const fix = require("./line-recording-ui-fix");

function productBubble(name, oldImage) {
  return {
    type: "bubble",
    hero: { type: "image", url: oldImage, aspectMode: "fit", action: { type: "uri", uri: "https://ts15825868.github.io/xianjiawei/products.html" } },
    body: { type: "box", layout: "vertical", contents: [{ type: "text", text: name }] },
    footer: { type: "box", layout: "vertical", contents: [
      { type: "button", action: { type: "uri", label: "看實際產品照片", uri: oldImage } },
      { type: "button", action: { type: "uri", label: "看詳細DM", uri: oldImage } },
    ] },
  };
}

assert.match(fix.VERSION, /recording-ui/i);
assert.match(fix.PRODUCT_IMAGE_VERSION, /20260814|product-modal-media-v3|current/i);
const cases = [
  ["龜鹿膏｜100g／罐", "guilu-gao"],
  ["龜鹿飲30cc玻璃罐｜30cc／罐（小玻璃罐）", "guilu-drink-30"],
  ["龜鹿飲180cc鋁袋｜180cc／包（鋁袋）", "guilu-drink-180"],
  ["龜鹿湯塊｜75g／盒｜8塊裝", "guilu-tangkuai"],
  ["龜鹿膠｜600g（1斤）／盒｜32塊裝", "guilu-jiao"],
  ["鹿茸粉｜75g／罐", "luerong-fen"],
];
for (const [name, key] of cases) {
  const bubble = productBubble(name, "https://example.com/legacy.jpg");
  fix.applyVisualFix(bubble);
  assert.equal(bubble.xjwProductPhoto, key);
  assert.match(bubble.hero.url, new RegExp(`/assets/formal-product/${key}\\.jpg\\?v=`), `${name} hero未使用目前正式產品JPEG route`);
  assert.equal(bubble.hero.aspectMode, "fit");
  assert.equal(bubble.xjwProductPhotoAuthority, "current-approved-product-image-line-jpeg");
  assert.equal(bubble.xjwProductIdentityAuthority, "products-v3-user-approved-originals");
  assert.equal(bubble.xjwProductScalePolicy, "uniform-only-no-crop-no-stretch");
  assert.equal(bubble.footer.contents[0].action.label, "看實際產品照片");
  assert.ok(bubble.footer.contents[0].action.uri.includes("/images/products-v3/"), `${name}實際產品照片按鈕必須是products-v3身份原圖`);
  assert.equal(bubble.footer.contents[1].action.label, "看詳細DM");
  assert.match(bubble.footer.contents[1].action.uri, new RegExp(`/assets/formal-dm/${key}\\.jpg\\?v=`), `${name}詳細DM按鈕未使用獨立DM route`);
  assert.equal(bubble.hero.action.uri, "https://ts15825868.github.io/xianjiawei/products.html");
}

const trial = {
  type: "bubble",
  body: { type: "box", layout: "vertical", contents: [
    { type: "text", text: "龜鹿飲試喝組｜先試喝，再決定" },
    { type: "text", text: "30cc小玻璃罐×3罐，試喝品免費" },
  ] },
};
fix.applyVisualFix(trial);
assert.equal(trial.xjwTrialMedia, true);
assert.match(trial.hero.url, /\/assets\/formal-trial\/trial\.jpg\?v=/);
assert.equal(trial.hero.aspectMode, "fit");
assert.ok(trial.hero.action.uri.endsWith("/trial.html"));
assert.ok(!trial.hero.url.includes("formal-product/guilu-drink-30"), "試喝卡不得被30cc產品hero覆蓋");

const recommend = { type: "bubble", body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "依日常使用方式幫你選" }] } };
fix.applyVisualFix(recommend);
assert.ok(recommend.hero.url.includes("/images/brand/line-oa/recommend.jpg"));
assert.equal(recommend.hero.aspectMode, "fit");

const usage = { type: "bubble", body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "產品使用方式導覽" }] } };
fix.applyVisualFix(usage);
assert.ok(usage.hero.url.includes("/images/brand/line-oa/usage.jpg"));

const faq = { type: "bubble", body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "常見問題 FAQ" }] } };
fix.applyVisualFix(faq);
assert.ok(faq.hero.url.includes("/images/brand/line-oa/faq.jpg"));

const combo = { type: "bubble", body: { type: "box", layout: "vertical", contents: [
  { type: "text", text: "搭配組合｜完整體驗組" },
  { type: "text", text: "每組售價：$6,400" },
  { type: "text", text: "產品DM請看完整資訊" },
] } };
fix.applyVisualFix(combo);
assert.ok(combo.body.contents[1].text.includes("商品合計：$6,400"));
assert.equal(combo.body.contents[2].text, "詳細DM請看完整資訊");
assert.ok(combo.hero.url.includes("/images/brand/line-oa/combo.jpg"));

const multi = { type: "bubble", body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "龜鹿膏與龜鹿飲30cc怎麼選" }] } };
fix.applyVisualFix(multi);
assert.ok(multi.hero.url.includes("/images/brand/line-oa/recommend.jpg"), "多產品推薦卡不得誤塞單一產品主圖");

const carousel = { type: "carousel", contents: [
  { type: "bubble", body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "依日常使用方式幫你選" }] } },
  { type: "bubble", body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "固定日常安排怎麼選" }] } },
  productBubble("龜鹿膏｜100g／罐", "https://example.com/old.jpg"),
] };
fix.applyVisualFix(carousel);
assert.ok(carousel.contents[0].hero);
assert.equal(carousel.contents[1].hero, undefined);
assert.match(carousel.contents[2].hero.url, /\/assets\/formal-product\/guilu-gao\.jpg\?v=/);

console.log("PASS：LINE Flex產品hero、詳細DM、試喝海報與products-v3實際產品照片四種角色分離；全部fit不裁切，小老闆依語意配圖。");
