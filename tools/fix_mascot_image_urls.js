"use strict";
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "server.js");
let text = fs.readFileSync(file, "utf8");
text = text.replace(/const MASCOT_PATHS = \{[\s\S]*?\n\};/, `const MASCOT_PATHS = {
  welcome: "images/line/xianjiawei-rich-menu-2500x1686-v309.jpg?v=312.1",
  products: "images/line/xianjiawei-rich-menu-2500x1686-v309.jpg?v=312.1",
  recommend: "images/line/xianjiawei-rich-menu-2500x1686-v309.jpg?v=312.1",
  combo: "images/line/xianjiawei-rich-menu-2500x1686-v309.jpg?v=312.1",
  usage: "images/line/xianjiawei-rich-menu-2500x1686-v309.jpg?v=312.1",
  faq: "images/line/xianjiawei-rich-menu-2500x1686-v309.jpg?v=312.1",
  service: "images/line/xianjiawei-rich-menu-2500x1686-v309.jpg?v=312.1",
  brand: "images/line/xianjiawei-rich-menu-2500x1686-v309.jpg?v=312.1",
};`);
text = text.replace('aspectRatio: "4:3",\n    aspectMode: "fit",', 'aspectRatio: "3:2",\n    aspectMode: "cover",');
fs.writeFileSync(file, text, "utf8");

const testFile = path.join(__dirname, "..", "function.test.js");
let tests = fs.readFileSync(testFile, "utf8");
tests = tests.replace('assert.ok(bubble.hero.url.includes("/images/line-mascot/xianjiawei-mascot-line-"));', 'assert.ok(bubble.hero.url.includes("/images/line/xianjiawei-rich-menu-2500x1686-v309.jpg"));');
tests = tests.replace('assert.strictEqual(bubble.hero.aspectMode, "fit");', 'assert.strictEqual(bubble.hero.aspectMode, "cover");');
fs.writeFileSync(testFile, tests, "utf8");
console.log("Updated mascot hero URLs to a verified visible image");
