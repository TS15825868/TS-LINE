"use strict";

/*
 * 穩定入口：保留原有圖片／Flex安全核心，再疊加純文字出貨說明守門。
 * server.js 與既有啟動參數仍只需要載入本檔。
 */
const core = require("./line-image-safety-core");
const plainTextSafety = require("./line-plain-text-safety");

plainTextSafety.install(core);

module.exports = {
  ...core,
  ...plainTextSafety,
};
