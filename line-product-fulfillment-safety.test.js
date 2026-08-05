"use strict";

const assert = require("node:assert/strict");
const {
  DRINK_FULFILLMENT_NOTICE,
  STOCK_FULFILLMENT_NOTICE,
  MIXED_FULFILLMENT_NOTICE,
  GENERAL_FULFILLMENT_NOTICE,
  CLEAN_DRINK_IMAGE_URL,
  applyImageSafety,
} = require("./line-image-safety");

const legacy = "訂單資料與付款方式確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計。";

function bubble(title, image = "https://ts15825868.github.io/xianjiawei/images/products-v3/guilu-drink-30.jpg") {
  return {
    type: "bubble",
    hero: { type: "image", url: image, aspectMode: "fit" },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: title },
        { type: "text", text: legacy },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "看產品DM",
            uri: "https://ts15825868.github.io/xianjiawei/images/dm-final/02_guilu-drink-30cc-dm.jpg",
          },
        },
      ],
    },
  };
}

function texts(value, output = []) {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    value.forEach((item) => texts(item, output));
    return output;
  }
  if (value.type === "text") output.push(String(value.text || ""));
  Object.values(value).forEach((entry) => texts(entry, output));
  return output;
}

const drink30 = bubble("龜鹿飲30cc玻璃罐");
applyImageSafety(drink30);
assert(texts(drink30).includes(DRINK_FULFILLMENT_NOTICE));
assert.equal(drink30.hero.url, CLEAN_DRINK_IMAGE_URL);
assert.equal(drink30.footer.contents[0].action.uri, CLEAN_DRINK_IMAGE_URL);
assert.equal(drink30.footer.contents[0].action.label, "看正確產品圖");

for (const title of ["龜鹿膏", "龜鹿湯塊", "龜鹿膠", "鹿茸粉"]) {
  const item = bubble(title, "https://example.com/product.jpg");
  applyImageSafety(item);
  assert(texts(item).includes(STOCK_FULFILLMENT_NOTICE), `${title} 必須使用備貨商品出貨說明`);
  assert(!texts(item).some((text) => text.includes("製作加工約需5～7個工作天")), `${title} 不得顯示龜鹿飲交期`);
}

const mixed = bubble("購物車：龜鹿飲30cc玻璃罐＋龜鹿膏", "https://example.com/cart.jpg");
applyImageSafety(mixed);
assert(texts(mixed).includes(MIXED_FULFILLMENT_NOTICE));

const general = bubble("歡迎來到仙加味", "https://example.com/welcome.jpg");
applyImageSafety(general);
assert(texts(general).includes(GENERAL_FULFILLMENT_NOTICE));

console.log("LINE product fulfillment and 30cc artwork safety verified.");
