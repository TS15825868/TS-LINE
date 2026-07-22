"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const VERSION = "1.2.1";
const RECOMMENDED = Object.freeze({
  regularCare: "每週三 19:30（Asia/Taipei）",
  product: "每週五 20:00（Asia/Taipei）",
  weatherException: "符合萬華實際氣候時，當日上午 10:00 額外發布",
  clearRepublish: "2026/7/23 19:30 使用先前完成的1254×1254正式清晰原圖重新發布一次",
});
let installed = false;

function transformPosts(source) {
  return String(source)
    .replace('scheduledAt: "2026-07-22T02:00:00.000Z"', 'scheduledAt: "2026-07-22T11:30:00.000Z"')
    .replace('scheduledAt: "2026-07-29T02:00:00.000Z"', 'scheduledAt: "2026-07-29T11:30:00.000Z"');
}

function transformBatch(source) {
  let output = String(source)
    .replace('const VERSION = "4.0.0";', 'const VERSION = "4.2.0";')
    .replace('const VERSION = "5.0.0";', 'const VERSION = "5.1.0";')
    .replace('const CONTENT_VERSION = "approved-complete-graphics-v4";', 'const CONTENT_VERSION = "approved-exact-original-1254-v6";')
    .replace('const CONTENT_VERSION = "approved-highres-1080-v5";', 'const CONTENT_VERSION = "approved-exact-original-1254-v6";')
    .replace('const CAMPAIGN_ID = "xjw-social-final-10-v4";', 'const CAMPAIGN_ID = "xjw-social-final-11-v6";')
    .replace('const CAMPAIGN_ID = "xjw-social-final-11-v5";', 'const CAMPAIGN_ID = "xjw-social-final-11-v6";')
    .replace(
      'const HIGHRES_DIR = path.join(ASSET_DIR, "care-highres");\nconst CARE_CHUNK_DIR = path.join(ASSET_DIR, "care-chunks");',
      'const HIGHRES_DIR = path.join(ASSET_DIR, "care-highres");\nconst ORIGINAL_CLEAR_DIR = path.join(ASSET_DIR, "original-clear");\nconst CARE_CHUNK_DIR = path.join(ASSET_DIR, "care-chunks");\nconst EXACT_ORIGINAL_SOURCE_FILE = "634CBEF9-5A29-44EE-BFFC-AA5DDB8C049B.PNG";'
    );

  output = output.replace(
    'function highresAvifBuffer(name) {',
    `function exactOriginalAvifBuffer(name) {
  if (String(name || "") !== "care-work-rest-clear.jpg") return null;
  if (!fs.existsSync(ORIGINAL_CLEAR_DIR)) return null;
  const chunkPattern = /^care-work-rest-original\\.avif\\.\\d{3}\\.b64$/;
  const chunks = fs.readdirSync(ORIGINAL_CLEAR_DIR)
    .filter((file) => chunkPattern.test(file))
    .sort();
  if (chunks.length < 5) return null;
  const encoded = chunks.slice(0, 5)
    .map((file) => fs.readFileSync(path.join(ORIGINAL_CLEAR_DIR, file), "utf8").replace(/\\s+/g, ""))
    .join("");
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  const buffer = Buffer.from(encoded, "base64");
  return buffer.length > 40000 ? buffer : null;
}

function highresAvifBuffer(name) {`
  );

  output = output
    .replace(
      'return highresAvifBuffer(name) || legacyAvifBuffer(name);',
      'return exactOriginalAvifBuffer(name) || highresAvifBuffer(name) || legacyAvifBuffer(name);'
    )
    .replace(
      'highresSource: Boolean(highresAvifBuffer(name)),',
      'highresSource: Boolean(exactOriginalAvifBuffer(name) || highresAvifBuffer(name)),\n    exactOriginalSource: Boolean(exactOriginalAvifBuffer(name)),\n    originalSourceFile: exactOriginalAvifBuffer(name) ? EXACT_ORIGINAL_SOURCE_FILE : "",\n    originalSourceDimensions: exactOriginalAvifBuffer(name) ? "1254x1254" : "",'
    )
    .replace(
      'highresSourceCount: assets.filter((item) => item.highresSource).length,',
      'highresSourceCount: assets.filter((item) => item.highresSource).length,\n      exactOriginalSourceCount: assets.filter((item) => item.exactOriginalSource).length,\n      exactOriginalRequired: true,'
    )
    .replace(
      'if (!previous.id) history.push(historyEntry("建立正式社群貼文", "使用1080×1080以上已核准完整成品圖", updatedAt));',
      'if (!previous.id) history.push(historyEntry("建立正式社群貼文", template.clearOriginalRequired === true ? "使用先前完成的1254×1254正式清晰原圖，版面與Q版小老闆及夥伴維持不變" : "使用1080×1080以上已核准完整成品圖", updatedAt));'
    )
    .replace(
      '  highresAvifBuffer,\n  legacyAvifBuffer,',
      '  exactOriginalAvifBuffer,\n  highresAvifBuffer,\n  legacyAvifBuffer,'
    )
    .replace(
      /\n\s*const replaceableCare = weekPosts\.find\([\s\S]*?\n\s*}\s*else if \(weekPosts\.length >= 2\) \{[\s\S]*?\n\s*}\n\n\s*const target =/,
      '\n\n  // 氣候貼文是例外加發，不取消固定貼文，也不占每週固定兩篇。\n  const target ='
    );

  return output;
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
