"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const write = (name, value) => fs.writeFileSync(path.join(root, name), value, "utf8");
function replaceOnce(text, search, replacement, label) {
  const next = text.replace(search, replacement);
  if (next === text) throw new Error(`找不到更新區塊：${label}`);
  return next;
}
let server = read("server.js");
server = server.replace(/仙加味 LINE OA Bot v300\.7/g, "仙加味 LINE OA Bot v300.8");
server = server.replace('const VERSION = "v300.7";', 'const VERSION = "v300.8";');
const mascotFunctions = [
  'const MASCOT_PATH = "images/brand/xianjiawei-mascot.jpg?v=300.5";', '',
  'function mascotBubble(title, description, buttons) {',
  '  const bubble = flexCard(title, description, buttons).contents;',
  '  bubble.hero = {', '    type: "image",', '    url: absoluteUrl(MASCOT_PATH),',
  '    size: "full",', '    aspectRatio: "4:5",', '    aspectMode: "contain",',
  '    backgroundColor: "#F7F4ED",',
  '    action: { type: "uri", uri: absoluteUrl("brand.html") },',
  '  };', '  return bubble;', '}', '',
  'function mascotWelcomeReply() {', '  return {', '    type: "flex",',
  '    altText: "仙加味小老闆歡迎您",', '    contents: mascotBubble(',
  '      "仙加味小老闆｜歡迎您",',
  '      `您好，歡迎來到仙加味。\\n\\n我可以帶您查看產品、比較怎麼選、了解搭配組合與使用方式。\\n\\n${ORDER_NOTICE}`,',
  '      [', '        { label: "看產品", text: "看產品" },',
  '        { label: "幫我推薦", text: "幫我推薦" },',
  '        { label: "人工客服", text: "我要人工客服" },',
  '      ]', '    ),', '  };', '}', '',
].join("\n");
server = replaceOnce(server, "function recommendReply() {", mascotFunctions + "function recommendReply() {", "小老闆函式");
server = replaceOnce(server, /function recommendReply\(\) \{\n  const cards = \[\n    flexCard\(/,
`function recommendReply() {\n  const cards = [\n    mascotBubble(\n      "仙加味小老闆幫你選",\n      "先依固定安排、方便即飲、沖泡燉湯、家庭規格或自行搭配飲品來比較。產品規格與價格仍以正式產品卡為準。",\n      [\n        { label: "看產品", text: "看產品" },\n        { label: "搭配組合", text: "搭配組合" },\n        { label: "人工客服", text: "我要人工客服" },\n      ]\n    ),\n    flexCard(`, "推薦卡");
const comboStart = server.indexOf("function comboMenuReply()");
const comboEnd = server.indexOf("function comboDetailReply", comboStart);
if (comboStart < 0 || comboEnd < 0) throw new Error("找不到搭配組合函式");
let combo = server.slice(comboStart, comboEnd);
combo = replaceOnce(combo, "      contents: combos.slice(0, 10).map((combo, index) => {",
`      contents: [\n        mascotBubble(\n          "小老闆搭配導覽",\n          "依日常節奏查看搭配組合。每組價格、可選組數、活動與加入購物車功能都保留在各方案卡中。",\n          [\n            { label: "看產品", text: "看產品" },\n            { label: "怎麼使用", text: "怎麼使用" },\n            { label: "人工客服", text: "我要人工客服" },\n          ]\n        ),\n        ...combos.slice(0, 9).map((combo, index) => {`, "搭配卡開頭");
combo = replaceOnce(combo, "      }),\n    },\n  };\n}\n\n", "      }),\n      ],\n    },\n  };\n}\n\n", "搭配卡結尾");
server = server.slice(0, comboStart) + combo + server.slice(comboEnd);
server = replaceOnce(server, "      contents: DATA.products.map((product) => usageReply(product).contents),",
`      contents: [\n        mascotBubble(\n          "小老闆使用方式導覽",\n          "先選擇想了解的產品，再查看正式使用方式、成分、完整介紹與產品DM。",\n          [\n            { label: "看產品", text: "看產品" },\n            { label: "幫我推薦", text: "幫我推薦" },\n            { label: "人工客服", text: "我要人工客服" },\n          ]\n        ),\n        ...DATA.products.map((product) => usageReply(product).contents),\n      ],`, "使用方式卡");
server = replaceOnce(server,
'      textMsg(`您好，歡迎來到仙加味。\\n\\n${ORDER_NOTICE}\\n\\n可以先查看產品、品牌故事，或告訴我們偏好的使用方式。`, mainQuick())',
"      mascotWelcomeReply()", "歡迎訊息");
server = replaceOnce(server, "  recommendReply,\n  comboReply,", "  recommendReply,\n  mascotWelcomeReply,\n  mascotBubble,\n  comboReply,", "函式匯出");
write("server.js", server);
for (const name of ["test.js", "security.test.js", "function.test.js"]) write(name, read(name).replace(/v300\.7/g, "v300.8"));
write("catalog.test.js", read("catalog.test.js").replace('"300.4"', '"300.5"'));
let functionTest = read("function.test.js");
functionTest = replaceOnce(functionTest, "productMenuReply, priceCarousel, recommendReply,", "productMenuReply, priceCarousel, recommendReply, mascotWelcomeReply,", "測試匯入");
functionTest = replaceOnce(functionTest, "productMenuReply(), priceCarousel(), recommendReply(),", "productMenuReply(), priceCarousel(), mascotWelcomeReply(), recommendReply(),", "測試訊息");
functionTest += `\nfor (const message of [mascotWelcomeReply(), recommendReply(), comboMenuReply(), usageChooserReply()]) {\n  const bubble = message.contents.type === "carousel" ? message.contents.contents[0] : message.contents;\n  assert.ok(bubble.hero, "小老闆卡缺少圖片");\n  assert.ok(bubble.hero.url.includes("/images/brand/xianjiawei-mascot.jpg?v=300.5"));\n}\nassert.strictEqual(recommendReply().contents.contents.length, 4);\nassert.strictEqual(usageChooserReply().contents.contents.length, DATA.products.length + 1);\nconsole.log("PASS LINE OA mascot cards v300.8");\n`;
write("function.test.js", functionTest);
const pkg = JSON.parse(read("package.json")); pkg.version = "3.0.8";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");
write(".github/workflows/verify-line-and-website-catalog.yml", read(".github/workflows/verify-line-and-website-catalog.yml").replace(/v300\.7/g, "v300.8"));
let readme = read("README.md").replace(/LINE OA v300\.7/g, "LINE OA v300.8").replace(/"version": "v300\.7"/g, '"version": "v300.8"');
if (!readme.includes("## v300.8 仙加味小老闆")) readme += "\n## v300.8 仙加味小老闆\n\n歡迎、幫我推薦、搭配組合與使用方式總覽加入小老闆品牌導覽卡；產品規格、價格、數量、購物車與結帳流程維持原功能。\n";
write("README.md", readme);
console.log("Applied LINE OA mascot integration v300.8");
