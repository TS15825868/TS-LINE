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

const cases = [
  ["龜鹿膏｜100g／罐", "guilu-gao", "guilu-gao.jpeg"],
  ["龜鹿飲30cc玻璃罐｜30cc／罐（小玻璃罐）", "guilu-drink-30", "guilu-drink-30.jpeg"],
  ["龜鹿飲180cc鋁袋｜180cc／包（鋁袋）", "guilu-drink-180", "guilu-drink-180.jpeg"],
  ["龜鹿湯塊｜75g／盒｜8塊裝", "guilu-tangkuai", "guilu-tangkuai.jpeg"],
  ["龜鹿膠｜600g（1斤）／盒", "guilu-jiao", "guilu-jiao-open-new.jpg"],
  ["鹿茸粉｜75g／罐", "luerong-fen", "luerong-fen.jpeg"],
];
for (const [name, key, file] of cases) {
  const bubble = productBubble(name, "https://ts15825868.github.io/xianjiawei/images/dm-final/legacy.jpg");
  fix.applyVisualFix(bubble);
  assert.equal(bubble.xjwProductPhoto, key);
  assert.ok(bubble.hero.url.includes(`/images/products-v2/${file}`), `${name} 未切回 products-v2 實際產品照片`);
  assert.equal(bubble.hero.aspectMode, "fit");
  assert.equal(bubble.footer.contents[0].action.label, "看正式產品圖");
  assert.equal(bubble.footer.contents[0].action.uri, bubble.hero.url);
  assert.equal(bubble.hero.action.uri, "https://ts15825868.github.io/xianjiawei/products.html");
}

const recommend = {
  type: "bubble",
  body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "沖泡、燉湯與家庭使用" }] },
  footer: { type: "box", layout: "vertical", contents: [{ type: "button", action: { type: "message", label: "看搭配方案", text: "怎麼選" } }] },
};
fix.applyVisualFix(recommend);
assert.ok(recommend.hero, "怎麼選卡片不得再出現空白 hero");
assert.ok(recommend.hero.url.includes("ts15825868.github.io/xianjiawei/images/brand/line-oa/brand.jpg"), "怎麼選卡必須使用GitHub Pages網站Q版小老闆靜態圖");
assert.ok(!recommend.hero.url.includes("onrender.com"), "怎麼選hero不可再依賴Render即時產圖");
assert.equal(recommend.hero.aspectRatio, "4:3");
assert.equal(recommend.hero.aspectMode, "fit");

const multi = {
  type: "bubble",
  body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "龜鹿膏與龜鹿飲30cc怎麼選" }] },
};
fix.applyVisualFix(multi);
assert.ok(multi.hero.url.includes("/images/brand/line-oa/brand.jpg"), "多產品推薦卡應用網站Q版小老闆，不可誤塞其中一項產品主圖");

console.log("PASS：LINE OA 六產品只用 products-v2 實際照片；DM按鈕改正式產品圖；怎麼選卡改GitHub Pages小老闆靜態圖、不再依賴Render白框路由。");
