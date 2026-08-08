"use strict";

/*
 * 穩定入口：保留原有圖片／Flex安全核心，再疊加純文字與產品出貨說明守門。
 * server.js 會直接 require 本檔，因此即使 Render 沒有使用 npm start 的 -r 預載參數，
 * 龜鹿飲 5～7 個工作天、其他產品依現貨出貨，以及龜鹿湯塊 75g-only 規則仍一定生效。
 */
const core = require("./line-image-safety-core");
const plainTextSafety = require("./line-plain-text-safety");
const fulfillmentSafety = require("./product-fulfillment-message-fix");

plainTextSafety.install(core);

module.exports = {
  ...core,
  ...plainTextSafety,
  fulfillmentSafety,
};