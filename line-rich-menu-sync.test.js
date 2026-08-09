"use strict";
const assert = require("node:assert/strict");
const rich = require("./line-rich-menu-sync");

assert.equal(rich.VERSION, "20260809-rich-menu-premium-v7-full-visual-zone");
assert.ok(rich.MENU_NAME.includes("高級六格"));
assert.ok(rich.BASE_MENU.includes("xianjiawei-rich-menu-2500x1686-v309.jpg"));
assert.equal(rich.OVERLAY_FIT, "contain");
assert.equal(rich.VISUAL_WIDTH, 740);
assert.equal(rich.VISUAL_HEIGHT, 430);
assert.equal(rich.BACKGROUND_WIDTH, 805);
assert.equal(rich.BACKGROUND_HEIGHT, 500);
assert.equal(rich.CELL_LAYOUTS.length, 6);
assert.ok(rich.CELL_LAYOUTS.slice(0,3).every(cell => cell.bgY + rich.BACKGROUND_HEIGHT <= 600), "第一排圖片背景不得壓到功能標題");
assert.ok(rich.CELL_LAYOUTS.slice(3).every(cell => cell.bgY + rich.BACKGROUND_HEIGHT <= 1435), "第二排圖片背景不得壓到功能標題");
assert.ok(rich.CELL_LAYOUTS.every(cell => cell.imgX >= cell.bgX && cell.imgY >= cell.bgY), "人物圖必須完整落在米白安全區內");
assert.equal(rich.BOSS_SOURCES.length, 6);
for (const url of rich.BOSS_SOURCES) {
  assert.ok(url.includes("ts15825868.github.io/xianjiawei/images/brand/line-oa/"));
  assert.ok(url.includes("v=20260809-03"));
  assert.ok(!url.includes("products-v3"));
  assert.ok(!url.includes("dm-final"));
}
assert.ok(rich.BOSS_SOURCES[0].includes("/products.jpg"));
assert.ok(rich.BOSS_SOURCES[1].includes("/products.jpg"));
assert.ok(rich.BOSS_SOURCES[2].includes("/recommend.jpg"));
assert.ok(rich.BOSS_SOURCES[3].includes("/combo.jpg"));
assert.ok(rich.BOSS_SOURCES[4].includes("/usage.jpg"));
assert.ok(rich.BOSS_SOURCES[5].includes("/service.jpg"));
const menu = rich.menuDefinition();
assert.deepEqual(menu.size, { width: 2500, height: 1686 });
assert.equal(menu.selected, true);
assert.equal(menu.areas.length, 6);
const labels = menu.areas.map((area) => area.action.label);
const texts = menu.areas.map((area) => area.action.text);
assert.deepEqual(labels, ["看產品", "購物車", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]);
assert.deepEqual(texts, ["看產品", "查看購買清單", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]);
assert.equal(menu.areas.reduce((sum, area) => sum + area.bounds.width * area.bounds.height, 0), 2500 * 1686);

console.log("PASS：Rich Menu六格圖片區接近滿寬、米白安全區消除黑底、人物完整contain且不覆蓋功能標題，六個功能意圖維持正確。");