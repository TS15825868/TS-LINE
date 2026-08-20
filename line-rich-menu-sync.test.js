"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rich = require("./line-rich-menu-sync");

assert.match(String(rich.VERSION || ""), /rich-menu/i, "Rich Menu 必須有能力版本識別");
assert.equal(rich.DEFAULT_AUTHORITY, "oa-manager", "正式 Rich Menu 顯示權威必須預設交由 LINE OA Manager");
assert.equal(rich.resolveAuthorityMode({}), "oa-manager", "未明確 opt-in 時不得讓 Render/Messaging API 覆蓋 OA Manager");
assert.equal(rich.resolveAuthorityMode({ LINE_RICH_MENU_AUTHORITY: "oa-manager" }), "oa-manager");
assert.equal(rich.resolveAuthorityMode({ LINE_RICH_MENU_AUTHORITY: "messaging-api" }), "messaging-api");
assert.equal(rich.resolveAuthorityMode({ LINE_RICH_MENU_AUTHORITY: "api" }), "messaging-api");
assert.ok(String(rich.MENU_NAME || "").includes("仙加味正式選單"), "手動備援 Rich Menu 名稱必須保留仙加味識別");
assert.equal(rich.SINGLE_IMAGE_ONLY, true);
assert.equal(rich.RUNTIME_COMPOSITE_FORBIDDEN, true);
assert.equal(rich.LEGACY_BASE_TEMPLATE_FORBIDDEN, true);
assert.match(String(rich.STATIC_ARTWORK || ""), /^assets\/rich-menu\/[^/]+\.svg(?:\.gz\.b64)?$/, "備援 Rich Menu 母稿必須在 assets/rich-menu 下");
assert.ok(Array.isArray(rich.RICH_MENU_RETRY_DELAYS_MS) && rich.RICH_MENU_RETRY_DELAYS_MS.length >= 1 && rich.RICH_MENU_RETRY_DELAYS_MS.length <= 5, "authority reconciliation 必須有限次安全重試");
assert.ok(rich.RICH_MENU_RETRY_DELAYS_MS.every((ms) => Number.isFinite(ms) && ms >= 0), "重試延遲必須有效");
assert.equal(typeof rich.clearMessagingApiDefault, "function", "必須可清除 Messaging API default，把顯示權交回 OA Manager");
assert.equal(typeof rich.reconcileRichMenuAuthority, "function", "必須有 Rich Menu authority reconciliation");

const source = fs.readFileSync("line-rich-menu-sync.js", "utf8");
const artwork = rich.readArtwork();
assert.ok(source.includes("DELETE"), "必須以 LINE 官方 DELETE default endpoint 清除 Messaging API 預設 Rich Menu");
assert.ok(source.includes("/v2/bot/user/all/richmenu"), "必須操作官方 default Rich Menu endpoint");
assert.ok(source.includes("LINE_RICH_MENU_AUTHORITY"), "Messaging API 管理模式必須是明確 opt-in");
assert.ok(source.includes("oa-manager"), "正式預設 authority 必須是 OA Manager");
assert.ok(!/\b(?:const|let|var)\s+BASE_TEMPLATE\b/.test(source), "備援 Rich Menu 不得恢復舊 JPG 底圖");
assert.ok(!/\b(?:const|let|var)\s+BOSS_SOURCES\b/.test(source), "備援 Rich Menu 不得維護六張後貼圖片來源");
assert.ok(!/\b(?:const|let|var)\s+CELL_LAYOUTS\b/.test(source), "備援 Rich Menu 不得維護六格圖片拼貼座標");
assert.ok(!/sharp\([^)]*\)\s*\.composite\s*\(/.test(source) && !/\.composite\s*\(\s*\[/.test(source), "備援 Rich Menu 不得 runtime 拼貼");
assert.ok(source.includes("RICH_MENU_RETRY_DELAYS_MS") && source.includes("maxAttempts"), "reconciliation 必須有限次而非無限輪詢");
assert.ok(source.includes("result?.ok || result?.skipped"), "成功或缺憑證時必須停止重試");
assert.ok(!/<image\b/i.test(artwork), "備援完整母稿不得內嵌照片或舊底圖");
assert.ok(!/<text\b/i.test(artwork), "備援母稿顧客可見繁中必須使用字型無關向量路徑");
assert.ok(/xjw-text-outlined-/i.test(artwork), "備援母稿必須保留繁中向量字");
for (const label of ["仙加味", "看產品", "購物車", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]) assert.ok(artwork.includes(label), `備援母稿缺少：${label}`);
assert.ok(!/#000000|#000\b|fill=\"black\"/i.test(artwork), "備援母稿不得出現黑色空白補位區");

const menu = rich.menuDefinition();
assert.deepEqual(menu.size, { width: 2500, height: 1686 });
assert.equal(menu.selected, true);
assert.equal(menu.areas.length, 6);
assert.deepEqual(menu.areas.map((area) => area.action.label), ["看產品", "購物車", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]);
assert.deepEqual(menu.areas.map((area) => area.action.text), ["看產品", "查看購買清單", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]);
for (const area of menu.areas) {
  assert.ok(Number(area.bounds?.width) > 0 && Number(area.bounds?.height) > 0, "備援 Rich Menu 功能熱區必須有效");
  assert.ok(Number(area.bounds?.x) >= 0 && Number(area.bounds?.y) >= 0, "熱區不得超出畫布左上界");
  assert.ok(area.bounds.x + area.bounds.width <= menu.size.width, "熱區不得超出畫布寬度");
  assert.ok(area.bounds.y + area.bounds.height <= menu.size.height, "熱區不得超出畫布高度");
}

console.log("PASS：正式 Rich Menu 預設由 LINE OA Manager 管理；Render 啟動只清除 Messaging API default，不再覆蓋漂亮快速選單。Messaging API 向量版僅保留為明確 opt-in 備援。");
