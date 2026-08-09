"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rich = require("./line-rich-menu-sync");

assert.equal(rich.VERSION, "20260809-rich-menu-single-final-v9-no-composite");
assert.ok(rich.MENU_NAME.includes("完整成品圖"));
assert.equal(rich.SINGLE_IMAGE_ONLY, true);
assert.ok(rich.FINAL_MENU_IMAGE.includes("xianjiawei-rich-menu-2500x1686-v309.jpg"));
const source = fs.readFileSync("line-rich-menu-sync.js", "utf8");
assert.ok(!source.includes("BOSS_SOURCES"), "Rich Menu不得再維護六張後貼圖片來源");
assert.ok(!source.includes("CELL_LAYOUTS"), "Rich Menu不得再維護六格圖片拼貼座標");
assert.ok(!source.includes(".composite("), "Rich Menu不得再用sharp composite拼湊視覺");
assert.ok(!source.includes("bossOverlay"), "Rich Menu不得再產生每格後貼圖片");
const menu = rich.menuDefinition();
assert.deepEqual(menu.size, { width: 2500, height: 1686 });
assert.equal(menu.selected, true);
assert.equal(menu.areas.length, 6);
assert.deepEqual(menu.areas.map((area) => area.action.label), ["看產品", "購物車", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]);
assert.deepEqual(menu.areas.map((area) => area.action.text), ["看產品", "查看購買清單", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]);
assert.equal(menu.areas.reduce((sum, area) => sum + area.bounds.width * area.bounds.height, 0), 2500 * 1686);

console.log("PASS：Rich Menu只接受一張完整2500×1686成品圖，不再使用六格拼貼／composite；六個功能熱區維持正確。");
