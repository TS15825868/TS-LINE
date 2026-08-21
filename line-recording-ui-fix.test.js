"use strict";
const assert = require("node:assert/strict");
const fix = require("./line-recording-ui-fix");

function productBubble(name, oldImage) {
  return {
    type: "bubble",
    hero: { type: "image", url: oldImage, aspectMode: "cover", aspectRatio: "4:3", action: { type: "uri", uri: "https://ts15825868.github.io/xianjiawei/products.html" } },
    body: { type: "box", layout: "vertical", contents: [{ type: "text", text: name }] },
    footer: { type: "box", layout: "vertical", contents: [
      { type: "button", action: { type: "uri", label: "看實際產品照片", uri: oldImage } },
      { type: "button", action: { type: "uri", label: "看詳細DM", uri: oldImage } },
    ] },
  };
}

assert.match(fix.VERSION, /recording-ui/i);
assert.equal(fix.HERO_ASPECT_RATIO, "16:9");
assert.ok(String(fix.PRODUCT_IMAGE_VERSION || "").trim(), "產品媒體版本識別不得為空");
assert.ok(!/products-v2|legacy|retired/i.test(String(fix.PRODUCT_IMAGE_VERSION || "")), "產品媒體版本不得回退舊權威");

const cases = [
  ["龜鹿膏｜100g／罐", "guilu-gao"],
  ["龜鹿飲30cc玻璃罐｜30cc／罐（小玻璃罐）", "guilu-drink-30"],
  ["龜鹿飲180cc鋁袋｜180cc／包（鋁袋）", "guilu-drink-180"],
  ["龜鹿湯塊｜75g （2兩）／盒｜8塊裝", "guilu-tangkuai"],
  ["龜鹿膠｜600g （1斤）／盒｜32塊裝", "guilu-jiao"],
  ["鹿茸粉｜75g／罐", "luerong-fen"],
];
for (const [name, key] of cases) {
  const bubble = productBubble(name, "https://example.com/legacy.jpg");
  fix.applyVisualFix(bubble);
  assert.equal(bubble.xjwProductPhoto, key);
  assert.match(bubble.hero.url, new RegExp(`/assets/formal-product/${key}\\.jpg\\?v=`), `${name} hero未使用目前正式產品JPEG route`);
  assert.equal(bubble.hero.aspectMode, "fit");
  assert.equal(bubble.hero.aspectRatio, "16:9");
  assert.equal(bubble.xjwProductPhotoAuthority, "current-approved-product-image-line-jpeg");
  assert.equal(bubble.xjwProductIdentityAuthority, "products-v3-user-approved-originals");
  assert.equal(bubble.xjwProductScalePolicy, "landscape-fit-no-crop-no-stretch");
  assert.equal(bubble.footer.contents[0].action.label, "看實際產品照片");
  assert.ok(bubble.footer.contents[0].action.uri.includes("/images/products-v3/"), `${name}實際產品照片按鈕必須是products-v3身份原圖`);
  assert.equal(bubble.footer.contents[1].action.label, "看詳細DM");
  assert.match(bubble.footer.contents[1].action.uri, new RegExp(`/assets/formal-dm/${key}\\.jpg\\?v=`), `${name}詳細DM按鈕未使用獨立DM route`);
  assert.equal(bubble.hero.action.uri, "https://ts15825868.github.io/xianjiawei/products.html");
}

// 切換按鈕提到其他產品時，不得污染本卡產品辨識。
const contaminatedUsageCard = {
  type: "bubble",
  body: { type: "box", layout: "vertical", contents: [
    { type: "text", text: "龜鹿膏｜使用方式" },
    { type: "text", text: "食用時間可依個人使用習慣與作息時間安排" },
  ] },
  footer: { type: "box", layout: "vertical", contents: [
    { type: "button", action: { type: "message", label: "看30cc", text: "龜鹿飲30cc玻璃罐" } },
    { type: "button", action: { type: "message", label: "看180cc", text: "龜鹿飲180cc鋁袋" } },
  ] },
};
fix.applyVisualFix(contaminatedUsageCard);
assert.equal(contaminatedUsageCard.xjwProductPhoto, "guilu-gao");
assert.match(contaminatedUsageCard.hero.url, /\/assets\/formal-product\/guilu-gao\.jpg\?v=/);
assert.equal(contaminatedUsageCard.hero.aspectMode, "fit");
assert.equal(contaminatedUsageCard.hero.aspectRatio, "16:9");

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

const recommend = { type: "bubble", hero: { type: "image", url: "https://example.com/old-portrait.jpg", aspectMode: "cover", aspectRatio: "4:3" }, body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "依日常使用方式幫你選" }] } };
fix.applyVisualFix(recommend);
assert.ok(recommend.hero.url.includes("/images/brand/line-oa/recommend.jpg"));
assert.equal(recommend.hero.aspectMode, "fit");
assert.equal(recommend.hero.aspectRatio, "16:9");

const usage = { type: "bubble", hero: { type: "image", url: "https://example.com/old-usage-poster.jpg", aspectMode: "cover", aspectRatio: "4:3" }, body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "產品使用方式導覽" }] } };
fix.applyVisualFix(usage);
assert.ok(usage.hero.url.includes("/images/brand/line-oa/usage.jpg"));
assert.equal(usage.hero.aspectMode, "fit");
assert.equal(usage.hero.aspectRatio, "16:9");

const faq = { type: "bubble", body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "常見問題 FAQ" }] } };
fix.applyVisualFix(faq);
assert.ok(faq.hero.url.includes("/images/brand/line-oa/faq.jpg"));
assert.equal(faq.hero.aspectRatio, "16:9");

const combo = { type: "bubble", body: { type: "box", layout: "vertical", contents: [
  { type: "text", text: "搭配組合｜完整體驗組" },
  { type: "text", text: "每組售價：$6,400" },
  { type: "text", text: "產品DM請看完整資訊" },
] } };
fix.applyVisualFix(combo);
assert.ok(combo.body.contents[1].text.includes("商品合計：$6,400"));
assert.equal(combo.body.contents[2].text, "詳細DM請看完整資訊");
assert.ok(combo.hero.url.includes("/images/brand/line-oa/combo.jpg"));
assert.equal(combo.hero.aspectMode, "fit");
assert.equal(combo.hero.aspectRatio, "16:9");

const multi = { type: "bubble", body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "龜鹿膏與龜鹿飲30cc怎麼選" }] } };
fix.applyVisualFix(multi);
assert.ok(multi.hero.url.includes("/images/brand/line-oa/recommend.jpg"), "多產品推薦卡不得誤塞單一產品主圖");

const carousel = { type: "carousel", contents: [
  { type: "bubble", body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "依日常使用方式幫你選" }] } },
  { type: "bubble", body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "固定日常安排怎麼選" }] } },
  productBubble("龜鹿膏｜100g／罐", "https://example.com/old.jpg"),
] };
fix.applyVisualFix(carousel);
assert.ok(carousel.contents[0].hero, "推薦 carousel 第一張必須有完整hero");
assert.ok(carousel.contents[1].hero, "推薦 carousel 後續卡不得刪hero造成大片空白");
assert.equal(carousel.contents[0].hero.aspectRatio, "16:9");
assert.equal(carousel.contents[1].hero.aspectRatio, "16:9");
assert.equal(carousel.contents[0].hero.aspectMode, "fit");
assert.equal(carousel.contents[1].hero.aspectMode, "fit");
assert.match(carousel.contents[2].hero.url, /\/assets\/formal-product\/guilu-gao\.jpg\?v=/);

const outbound = JSON.parse(JSON.stringify(carousel));
fix.stripInternalMetadata(outbound);
assert.ok(!JSON.stringify(outbound).match(/xjw/i), "送入LINE API前不得殘留xjw內部欄位");

console.log("PASS：LINE 幫我推薦／搭配組合／怎麼使用三組 hero 統一16:9 fit完整顯示；推薦卡不再刪除後續hero；產品卡正文辨識不受切換按鈕污染；產品／DM／試喝媒體角色保持分離。");
