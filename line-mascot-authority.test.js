"use strict";

const assert = require("node:assert/strict");
const safety = require("./line-image-safety-core");

assert.ok(safety.SOURCE_BASE.includes("TS15825868/xianjiawei/main/images/brand/line-oa"));
assert.equal(safety.CLEAN_MASCOT_PATH_PREFIX, "/assets/mascot-clean");
assert.deepEqual(safety.APPROVED_MASCOT_NAMES, ["welcome", "products", "recommend", "combo", "usage", "faq", "service", "brand"]);
assert.equal(safety.MASCOT_SOURCE_MAP.welcome, "brand");
assert.equal(safety.MASCOT_SOURCE_MAP.products, "brand");
assert.equal(safety.MASCOT_SOURCE_MAP.combo, "recommend");
assert.equal(safety.MASCOT_SOURCE_MAP.service, "brand");
assert.ok(safety.mascotSourceUrl("brand").includes("/images/brand/line-oa/brand.jpg"));
assert.ok(safety.approvedUrl("brand").includes("/assets/mascot-clean/brand.jpg"));
assert.ok(!safety.approvedUrl("brand").includes("raw.githubusercontent.com"));

function bubble(title, oldName) {
  return {
    type: "bubble",
    hero: {
      type: "image",
      url: `https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot/${oldName}.jpg?v=old`,
      aspectRatio: "1:1",
      aspectMode: "fit",
    },
    body: { type: "box", layout: "vertical", contents: [{ type: "text", text: title }] },
  };
}

const cases = [
  ["歡迎來到仙加味", "welcome", "welcome"],
  ["品牌故事｜四代傳承", "brand", "brand"],
  ["人工客服｜請直接留言", "service", "service"],
  ["常見問題｜小老闆幫你整理", "faq", "faq"],
  ["依日常使用方式幫你選", "recommend", "recommend"],
  ["龜鹿膏｜使用方式", "usage", "usage"],
];

for (const [title, oldName, expected] of cases) {
  const node = bubble(title, oldName);
  safety.applyImageSafety(node);
  assert.ok(node.hero, `${title} 應保留正式小老闆 hero`);
  assert.ok(node.hero.url.includes(`/assets/mascot-clean/${expected}.jpg`), `${title} hero 未切到乾淨角色 JPEG route`);
  assert.ok(!node.hero.url.includes("/TS-LINE/main/public/mascot/"), `${title} 仍引用舊 TS-LINE mascot`);
  assert.ok(!node.hero.url.includes("/images/brand/line-oa/"), `${title} 不應直接送出含完整場景的來源圖`);
  assert.equal(node.hero.aspectRatio, "1:1");
  assert.equal(node.hero.aspectMode, "fit");
}

const rawApprovedScene = bubble("品牌故事｜從萬華開始", "brand");
rawApprovedScene.hero.url = "https://raw.githubusercontent.com/TS15825868/xianjiawei/main/images/brand/line-oa/brand.jpg";
safety.applyImageSafety(rawApprovedScene);
assert.ok(rawApprovedScene.hero.url.includes("/assets/mascot-clean/brand.jpg"), "完整 LINE OA 場景也必須改寫成乾淨角色圖");

const productBubble = {
  type: "bubble",
  hero: { type: "image", url: "https://ts15825868.github.io/xianjiawei/images/products-v3/guilu-gao.jpg", aspectMode: "fit" },
  body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "龜鹿膏 100g／罐" }] },
};
safety.applyImageSafety(productBubble);
assert.ok(productBubble.hero.url.includes("images/products-v3/guilu-gao.jpg"), "正式產品 hero 不應被角色安全層替換");

console.log("PASS：LINE OA 小老闆 hero 只走乾淨角色 JPEG route；正式產品原圖保持獨立、不被角色圖覆蓋。");
