"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rich = require("./line-rich-menu-sync");

assert.match(String(rich.VERSION || ""), /rich-menu/i, "Rich Menu 必須有能力版本識別，但不得要求歷史日期格式");
assert.ok(String(rich.MENU_NAME || "").includes("仙加味正式選單"), "Rich Menu 名稱必須是仙加味正式選單");
assert.equal(rich.SINGLE_IMAGE_ONLY, true);
assert.equal(rich.RUNTIME_COMPOSITE_FORBIDDEN, true);
assert.equal(rich.LEGACY_BASE_TEMPLATE_FORBIDDEN, true);
assert.match(String(rich.STATIC_ARTWORK || ""), /^assets\/rich-menu\/[^/]+\.svg(?:\.gz\.b64)?$/, "Rich Menu 母稿必須是 assets/rich-menu 下的單一 SVG 資產");
assert.ok(Array.isArray(rich.RICH_MENU_RETRY_DELAYS_MS)&&rich.RICH_MENU_RETRY_DELAYS_MS.length>=1&&rich.RICH_MENU_RETRY_DELAYS_MS.length<=5, "Rich Menu 必須保留有限次安全重試，不綁死特定秒數");
assert.ok(rich.RICH_MENU_RETRY_DELAYS_MS.every(ms=>Number.isFinite(ms)&&ms>=0), "Rich Menu 重試延遲必須有效");

const source = fs.readFileSync("line-rich-menu-sync.js", "utf8");
const artwork = rich.readArtwork();
assert.ok(!/\b(?:const|let|var)\s+BASE_TEMPLATE\b/.test(source), "Rich Menu正式程式不得再宣告舊JPG底圖");
assert.ok(!/\b(?:const|let|var)\s+BOSS_SOURCES\b/.test(source), "Rich Menu不得再維護六張後貼圖片來源");
assert.ok(!/\b(?:const|let|var)\s+CELL_LAYOUTS\b/.test(source), "Rich Menu不得再維護六格圖片拼貼座標");
assert.ok(!/sharp\([^)]*\)\s*\.composite\s*\(/.test(source)&&!/\.composite\s*\(\s*\[/.test(source), "Rich Menu不得再用sharp composite拼湊視覺");
assert.ok(source.includes("RICH_MENU_RETRY_DELAYS_MS"), "Rich Menu必須保留啟動同步安全重試設定");
assert.ok(source.includes("maxAttempts"), "Rich Menu重試必須有限次數而非無限輪詢");
assert.ok(source.includes("result?.ok || result?.skipped"), "Rich Menu同步成功或缺少憑證時必須停止重試");
assert.ok(!/<image\b/i.test(artwork), "Rich Menu完整母稿不得再內嵌照片或舊底圖");
assert.ok(!/<text\b/i.test(artwork), "Rich Menu顧客可見繁中必須使用字型無關的向量路徑");
assert.ok(/xjw-text-outlined-/i.test(artwork), "Rich Menu必須使用繁中向量字正式母稿");
for (const label of ["仙加味", "看產品", "購物車", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]) assert.ok(artwork.includes(label), `Rich Menu完整母稿缺少：${label}`);
assert.ok(!/#000000|#000\b|fill=\"black\"/i.test(artwork), "Rich Menu不得出現黑色空白補位區");

const menu = rich.menuDefinition();
assert.deepEqual(menu.size, { width: 2500, height: 1686 });
assert.equal(menu.selected, true);
assert.equal(menu.areas.length, 6);
assert.deepEqual(menu.areas.map((area) => area.action.label), ["看產品", "購物車", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]);
assert.deepEqual(menu.areas.map((area) => area.action.text), ["看產品", "查看購買清單", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]);
for (const area of menu.areas) {
  assert.ok(Number(area.bounds?.width) > 0 && Number(area.bounds?.height) > 0, "Rich Menu功能熱區必須有有效尺寸");
  assert.ok(Number(area.bounds?.x) >= 0 && Number(area.bounds?.y) >= 0, "Rich Menu功能熱區不得超出畫布左上界");
  assert.ok(area.bounds.x + area.bounds.width <= menu.size.width, "Rich Menu功能熱區不得超出畫布寬度");
  assert.ok(area.bounds.y + area.bounds.height <= menu.size.height, "Rich Menu功能熱區不得超出畫布高度");
}

console.log(`PASS：Rich Menu以功能與顧客結果驗收；目前 ${rich.VERSION}，單一完整向量母稿、六格可點擊、繁中正常、不拼貼、有限安全重試；安全碼可提及退役標記但不會被誤判為仍在使用。`);
