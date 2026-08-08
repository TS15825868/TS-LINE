"use strict";
const assert = require("node:assert/strict");
const fix = require("./line-recording-ui-fix");

function productBubble(name, oldImage) {
  return {
    type: "bubble",
    hero: { type: "image", url: oldImage, aspectMode: "fit", action: { type: "uri", uri: "https://ts15825868.github.io/xianjiawei/products.html" } },
    body: { type: "box", layout: "vertical", contents: [{ type: "text", text: name }] },
    footer: { type: "box", layout: "vertical", contents: [{ type: "button", action: { type: "uri", label: "看產品DM", uri: oldImage } }] },
  };
}

assert.ok(fix.VERSION.includes("recording-ui-v6"));
const cases = [
  ["龜鹿膏｜100g／罐", "guilu-gao", "guilu-gao.jpg"],
  ["龜鹿飲30cc玻璃罐｜30cc／罐（小玻璃罐）", "guilu-drink-30", "guilu-drink-30.jpg"],
  ["龜鹿飲180cc鋁袋｜180cc／包（鋁袋）", "guilu-drink-180", "guilu-drink-180.jpg"],
  ["龜鹿湯塊｜75g／盒｜8塊裝", "guilu-tangkuai", "guilu-tangkuai.jpg"],
  ["龜鹿膠｜600g（1斤）／盒", "guilu-jiao", "guilu-jiao.jpg"],
  ["鹿茸粉｜75g／罐", "luerong-fen", "luerong-fen.jpg"],
];
for (const [name, key, file] of cases) {
  const bubble = productBubble(name, "https://ts15825868.github.io/xianjiawei/images/dm-final/legacy.jpg");
  fix.applyVisualFix(bubble);
  assert.equal(bubble.xjwProductPhoto, key);
  assert.ok(bubble.hero.url.includes(`/images/products-v3/${file}`), `${name} 未切到 products-v3 使用者確認正式產品原圖`);
  assert.equal(bubble.hero.aspectMode, "fit");
  assert.equal(bubble.xjwProductPhotoAuthority, "products-v3-user-approved-originals");
  assert.equal(bubble.xjwProductScalePolicy, "uniform-only-no-crop-no-stretch");
  assert.equal(bubble.footer.contents[0].action.label, "看實際產品照片");
  assert.equal(bubble.footer.contents[0].action.uri, bubble.hero.url);
  assert.equal(bubble.hero.action.uri, "https://ts15825868.github.io/xianjiawei/products.html");
}

const recommend = {
  type: "bubble",
  body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "依日常使用方式幫你選" }] },
  footer: { type: "box", layout: "vertical", contents: [{ type: "button", action: { type: "message", label: "看搭配方案", text: "怎麼選" } }] },
};
fix.applyVisualFix(recommend);
assert.ok(recommend.hero, "怎麼選卡片不得出現空白 hero");
assert.ok(recommend.hero.url.includes("/images/brand/line-oa/recommend.jpg"), "怎麼選卡必須使用推薦情境小老闆");
assert.ok(!recommend.hero.url.includes("onrender.com"), "怎麼選hero不可依賴Render即時產圖");
assert.equal(recommend.hero.aspectRatio, "4:3");
assert.equal(recommend.hero.aspectMode, "fit");

const usage = {
  type: "bubble",
  body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "產品使用方式導覽" }] },
};
fix.applyVisualFix(usage);
assert.ok(usage.hero.url.includes("/images/brand/line-oa/usage.jpg"), "使用方式卡必須用使用情境小老闆");

const faq = {
  type: "bubble",
  body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "常見問題 FAQ" }] },
};
fix.applyVisualFix(faq);
assert.ok(faq.hero.url.includes("/images/brand/line-oa/faq.jpg"), "FAQ卡必須用FAQ情境小老闆");

const combo = {
  type: "bubble",
  body: { type: "box", layout: "vertical", contents: [
    { type: "text", text: "搭配組合｜完整體驗組" },
    { type: "text", text: "每組售價：$6,400\n可選組數：1、2、3、5組" },
    { type: "text", text: "產品DM請看完整資訊" },
  ] },
};
fix.applyVisualFix(combo);
assert.ok(combo.body.contents[1].text.includes("商品合計：$6,400"));
assert.ok(!combo.body.contents[1].text.includes("每組售價"));
assert.equal(combo.body.contents[2].text, "實際產品照片請看完整資訊");
assert.ok(combo.hero.url.includes("/images/brand/line-oa/combo.jpg"), "組合導覽卡使用搭配情境小老闆");

const multi = {
  type: "bubble",
  body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "龜鹿膏與龜鹿飲30cc怎麼選" }] },
};
fix.applyVisualFix(multi);
assert.ok(multi.hero.url.includes("/images/brand/line-oa/recommend.jpg"), "多產品推薦卡應用推薦情境小老闆，不可誤塞其中一項產品主圖");

const carousel = {
  type: "carousel",
  contents: [
    { type: "bubble", body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "依日常使用方式幫你選" }] } },
    { type: "bubble", body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "固定日常安排怎麼選" }] } },
    productBubble("龜鹿膏｜100g／罐", "https://example.com/old.jpg"),
  ],
};
fix.applyVisualFix(carousel);
assert.ok(carousel.contents[0].hero, "carousel 第一張導覽卡保留完整小老闆圖");
assert.equal(carousel.contents[1].hero, undefined, "carousel 後續非產品說明卡移除重複小老闆 hero");
assert.ok(carousel.contents[2].hero.url.includes("/images/products-v3/guilu-gao.jpg"), "產品卡仍保留使用者確認的正式產品原圖");

console.log("PASS：LINE OA 產品使用 products-v3 正式原圖；產品只等比例fit不裁切；小老闆依文案情境配圖；carousel 不重複載入同一小老闆。");
