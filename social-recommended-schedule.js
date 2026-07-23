"use strict";

const VERSION = "2.0.0";
const RECOMMENDED = Object.freeze({
  fixed: "每週三、週五 10:00（Asia/Taipei）",
  weatherException: "氣候與補水依萬華實際氣候，於非週三、週五的上午10:00例外加發；每週最多1篇",
  firstPublish: "2026/7/24 10:00 使用1254×1254正式清晰圖開始發布",
});

function transformPosts(source) {
  return String(source);
}

function transformBatch(source) {
  return String(source);
}

function install() {
  return true;
}

module.exports = { VERSION, RECOMMENDED, transformPosts, transformBatch, install };
