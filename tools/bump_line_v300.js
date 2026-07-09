"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const files = [
  {
    path: path.join(ROOT, "server.js"),
    replacements: [
      ["仙加味 LINE OA Bot v299.1", "仙加味 LINE OA Bot v300.0"],
      ['const VERSION = "v299.1";', 'const VERSION = "v300.0";'],
    ],
  },
  {
    path: path.join(ROOT, "test.js"),
    replacements: [
      ['assert.strictEqual(VERSION, "v299.1");', 'assert.strictEqual(VERSION, "v300.0");'],
    ],
  },
];

for (const file of files) {
  let content = fs.readFileSync(file.path, "utf8");
  for (const [from, to] of file.replacements) {
    if (!content.includes(from) && !content.includes(to)) {
      throw new Error(`${path.basename(file.path)} 找不到預期版本文字：${from}`);
    }
    content = content.replace(from, to);
  }
  fs.writeFileSync(file.path, content, "utf8");
}

console.log("LINE OA runtime and tests updated to v300.0");
