"use strict";

const assert = require("node:assert/strict");
const safety = require("./line-image-safety-core");

assert.ok(safety.BASE.includes("TS15825868/xianjiawei/main/images/brand/line-oa"));
assert.deepEqual(safety.APPROVED_MASCOT_NAMES, ["welcome", "products", "recommend", "combo", "usage", "faq", "service", "brand"]);

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
  assert.ok(node.hero.url.includes(`/xianjiawei/main/images/brand/line-oa/${expected}.jpg`), `${title} hero 未切到正式 LINE OA 圖`);
  assert.ok(!node.hero.url.includes("/TS-LINE/main/public/mascot/"), `${title} 仍引用舊 TS-LINE mascot`);
  assert.equal(node.hero.aspectRatio, "4:3");
  assert.equal(node.hero.aspectMode, "fit");
}

const productBubble = {
  type: "bubble",
  hero: { type: "image", url: "https://ts15825868.github.io/xianjiawei/images/products-v3/guilu-gao.jpg", aspectMode: "fit" },
  body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "龜鹿膏 100g／罐" }] },
};
safety.applyImageSafety(productBubble);
assert.ok(productBubble.hero.url.includes("images/products-v3/guilu-gao.jpg"), "正式產品 hero 不應被角色安全層替換");

console.log("PASS：LINE OA 小老闆 hero 全部改寫到 dedicated line-oa 正式資產，產品正式原圖不受影響。");
