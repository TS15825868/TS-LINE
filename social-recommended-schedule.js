"use strict";

const VERSION = "3.0.0";
const RECOMMENDED = Object.freeze({
  fixed: "每週1篇，週三 20:00（Asia/Taipei）",
  weatherException: "氣候與補水依萬華實際氣候，於其他平日晚上20:00例外加發；每週最多1篇；週六、週日不發布",
  firstPublish: "修正版圖文建議自2026/7/29週三20:00開始；仍須先通過人工審核",
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
