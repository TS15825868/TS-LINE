"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const VERSION = "1.1.0";
const RECOMMENDED = Object.freeze({
  regularCare: "每週三 19:30（Asia/Taipei）",
  product: "每週五 20:00（Asia/Taipei）",
  weatherException: "符合萬華實際氣候時，當日上午 10:00 額外發布",
});
let installed = false;

function transformPosts(source) {
  return String(source)
    .replace('scheduledAt: "2026-07-22T02:00:00.000Z"', 'scheduledAt: "2026-07-22T11:30:00.000Z"')
    .replace('scheduledAt: "2026-07-29T02:00:00.000Z"', 'scheduledAt: "2026-07-29T11:30:00.000Z"');
}

function transformBatch(source) {
  return String(source)
    .replace('const VERSION = "4.0.0";', 'const VERSION = "4.2.0";')
    .replace('const CONTENT_VERSION = "approved-complete-graphics-v4";', 'const CONTENT_VERSION = "approved-complete-graphics-v6-drink-split";')
    .replace('const CAMPAIGN_ID = "xjw-social-final-10-v4";', 'const CAMPAIGN_ID = "xjw-social-final-11-v6";')
    .replace(
      /\n\s*const replaceableCare = weekPosts\.find\([\s\S]*?\n\s*}\s*else if \(weekPosts\.length >= 2\) \{[\s\S]*?\n\s*}\n\n\s*const target =/,
      '\n\n  // 氣候貼文是例外加發，不取消固定貼文，也不占每週固定兩篇。\n  const target ='
    );
}

function install() {
  if (installed) return;
  installed = true;
  const previousLoader = Module._extensions[".js"];
  const wrapped = function loadRecommendedSocialSchedule(module, filename) {
    const base = path.basename(filename);
    if (base === "social-final-posts.js") {
      return module._compile(transformPosts(fs.readFileSync(filename, "utf8")), filename);
    }
    if (base === "social-final-approved-batch.js") {
      return module._compile(transformBatch(fs.readFileSync(filename, "utf8")), filename);
    }
    return previousLoader(module, filename);
  };
  Object.defineProperty(wrapped, "__xjwRecommendedSocialSchedule", { value: true });
  Module._extensions[".js"] = wrapped;
}

install();

module.exports = {
  VERSION,
  RECOMMENDED,
  transformPosts,
  transformBatch,
  install,
};
