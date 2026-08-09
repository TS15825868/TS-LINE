"use strict";
const assert = require("node:assert/strict");
const rich = require("./line-rich-menu-sync");

assert.equal(rich.VERSION, "20260809-rich-menu-classic-v6-user-preferred");
assert.ok(rich.MENU_NAME.includes("經典六格"));
assert.ok(rich.BASE_MENU.includes("xianjiawei-rich-menu-2500x1686-v309.jpg"));
assert.equal(rich.OVERLAY_FIT, "contain");
assert.equal(rich.VISUAL_WIDTH, 350);
assert.equal(rich.VISUAL_HEIGHT, 525);
assert.equal(rich.BACKGROUND_WIDTH, 370);
assert.equal(rich.BACKGROUND_HEIGHT, 545);
assert.equal(rich.BOSS_SOURCES.length, 6);
for (const url of rich.BOSS_SOURCES) {
  assert.ok(url.includes("ts15825868.github.io/xianjiawei/images/brand/line-oa/"));
  assert.ok(url.includes("v=20260809-02"));
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

console.log("PASS：Rich Menu恢復使用者偏好的經典六格比例，人物contain不裁切，六個功能意圖維持新版正確設定。");
