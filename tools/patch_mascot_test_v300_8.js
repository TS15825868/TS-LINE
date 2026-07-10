"use strict";
const fs = require("fs");
let text = fs.readFileSync("test.js", "utf8");
const updates = [
  ["assert.strictEqual(recommendReply().contents.contents.length, 3);", "assert.strictEqual(recommendReply().contents.contents.length, 4);"],
  ["assert.strictEqual(usageChooserReply().contents.contents.length, 6);", "assert.strictEqual(usageChooserReply().contents.contents.length, DATA.products.length + 1);"],
  ["assert.strictEqual(comboMenuReply().contents.contents.length, DATA.offers.comboOffers.length);", "assert.strictEqual(comboMenuReply().contents.contents.length, DATA.offers.comboOffers.length + 1);"],
  ["assert.ok(comboMenuReply().contents.contents[0].body.contents[0].text.includes(\"日常節奏組\"));", "assert.ok(comboMenuReply().contents.contents[0].body.contents[0].text.includes(\"小老闆搭配導覽\"));\nassert.ok(comboMenuReply().contents.contents[1].body.contents[0].text.includes(\"日常節奏組\"));"],
];
for (const [before, after] of updates) {
  if (!text.includes(before)) throw new Error("找不到測試更新位置：" + before);
  text = text.replace(before, after);
}
fs.writeFileSync("test.js", text, "utf8");
console.log("Updated mascot card expectations in test.js");
