"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rich = require("./line-rich-menu-sync");

assert.equal(rich.VERSION, "20260809-rich-menu-native-single-artwork-v11");
assert.ok(rich.MENU_NAME.includes("原生完整設計稿"));
assert.equal(rich.SINGLE_IMAGE_ONLY, true);
assert.equal(rich.RUNTIME_COMPOSITE_FORBIDDEN, true);
assert.equal(rich.LEGACY_BASE_TEMPLATE_FORBIDDEN, true);
assert.equal(rich.STATIC_ARTWORK, "assets/rich-menu/xianjiawei-rich-menu-v11.svg");

const source = fs.readFileSync("line-rich-menu-sync.js", "utf8");
const artwork = fs.readFileSync(rich.STATIC_ARTWORK, "utf8");
assert.ok(!source.includes("BASE_TEMPLATE"), "Rich Menu正式程式不得再依賴舊JPG底圖");
assert.ok(!source.includes("BOSS_SOURCES"), "Rich Menu不得再維護六張後貼圖片來源");
assert.ok(!source.includes("CELL_LAYOUTS"), "Rich Menu不得再維護六格圖片拼貼座標");
assert.ok(!source.includes(".composite("), "Rich Menu不得再用sharp composite拼湊視覺");
assert.ok(!/<image\b/i.test(artwork), "Rich Menu完整母稿不得再內嵌照片或舊底圖");
assert.equal((artwork.match(/rx=\"38\"/g) || []).length, 6, "Rich Menu必須有六個一致完整功能面板");
for (const label of ["仙加味", "看產品", "購物車", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]) {
  assert.ok(artwork.includes(label), `Rich Menu完整母稿缺少：${label}`);
}
assert.ok(!/#000000|#000\b|fill=\"black\"/i.test(artwork), "Rich Menu不得出現黑色空白補位區");

const menu = rich.menuDefinition();
assert.deepEqual(menu.size, { width: 2500, height: 1686 });
assert.equal(menu.selected, true);
assert.equal(menu.areas.length, 6);
assert.deepEqual(menu.areas.map((area) => area.action.label), ["看產品", "購物車", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]);
assert.deepEqual(menu.areas.map((area) => area.action.text), ["看產品", "查看購買清單", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]);
assert.deepEqual(menu.areas.map((area) => area.bounds), [
  { x: 24, y: 176, width: 785, height: 635 },
  { x: 857, y: 176, width: 786, height: 635 },
  { x: 1691, y: 176, width: 785, height: 635 },
  { x: 24, y: 875, width: 785, height: 775 },
  { x: 857, y: 875, width: 786, height: 775 },
  { x: 1691, y: 875, width: 785, height: 775 },
]);
for (const area of menu.areas) {
  assert.ok(area.bounds.y >= 176, "品牌Header不得成為功能熱區");
  assert.ok(area.bounds.x >= 24, "畫布外框不得成為功能熱區");
  assert.ok(area.bounds.x + area.bounds.width <= 2476, "功能熱區不得超出實際面板");
  assert.ok(area.bounds.y + area.bounds.height <= 1650, "功能熱區不得超出實際面板");
}

console.log("PASS：Rich Menu使用一張原生完整母稿、不拼貼、不重畫產品；六個點擊熱區精準對齊六個實際功能面板，品牌Header與間距不誤觸。");
