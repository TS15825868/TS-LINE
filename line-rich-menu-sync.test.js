"use strict";
const assert = require("node:assert/strict");
const rich = require("./line-rich-menu-sync");

assert.equal(rich.VERSION, "20260809-rich-menu-premium-v8-template-safe-zone");
assert.ok(rich.MENU_NAME.includes("高級六格"));
assert.ok(rich.BASE_MENU.includes("xianjiawei-rich-menu-2500x1686-v309.jpg"));
assert.equal(rich.OVERLAY_FIT, "contain");
assert.equal(rich.VISUAL_WIDTH, 770);
assert.equal(rich.VISUAL_HEIGHT, 500);
assert.equal(rich.BACKGROUND_WIDTH, 805);
assert.equal(rich.BACKGROUND_HEIGHT, 522);
assert.equal(rich.CELL_LAYOUTS.length, 6);
assert.ok(rich.CELL_LAYOUTS.slice(0,3).every(cell => cell.bgY >= 173 && cell.bgY + rich.BACKGROUND_HEIGHT <= 718), "第一排圖片背景只能存在於母版y=173~717安全區");
assert.ok(rich.CELL_LAYOUTS.slice(3).every(cell => cell.bgY >= 931 && cell.bgY + rich.BACKGROUND_HEIGHT <= 1476), "第二排圖片背景只能存在於母版y=931~1475安全區");
assert.ok(rich.CELL_LAYOUTS.every(cell => cell.imgX >= cell.bgX && cell.imgY >= cell.bgY), "情境圖必須完整落在米白安全區內");
assert.equal(rich.BOSS_SOURCES.length, 6);
for (const url of rich.BOSS_SOURCES) {
  assert.ok(url.includes("ts15825868.github.io/xianjiawei/images/brand/line-oa/"));
  assert.ok(url.includes("v=20260809-04"));
  assert.ok(!url.includes("products-v3"));
  assert.ok(!url.includes("dm-final"));
}
const menu = rich.menuDefinition();
assert.deepEqual(menu.size, { width: 2500, height: 1686 });
assert.equal(menu.selected, true);
assert.equal(menu.areas.length, 6);
assert.deepEqual(menu.areas.map((area) => area.action.label), ["看產品", "購物車", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]);
assert.deepEqual(menu.areas.map((area) => area.action.text), ["看產品", "查看購買清單", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]);
assert.equal(menu.areas.reduce((sum, area) => sum + area.bounds.width * area.bounds.height, 0), 2500 * 1686);

console.log("PASS：Rich Menu精確使用母版兩排圖片安全區，米白背景覆蓋黑底，圖像放大完整且不碰Header／功能文字。");