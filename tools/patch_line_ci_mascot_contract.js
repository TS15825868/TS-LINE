"use strict";

const fs = require("fs");
const path = ".github/workflows/ci.yml";
let text = fs.readFileSync(path, "utf8");
const oldBlock = `      - name: Run complete LINE OA, social, review and schedule tests\n        run: npm test\n`;
const newBlock = `      - name: Run complete LINE OA, social, review and schedule tests\n        run: |\n          npm test\n          node tests/line-approved-mascot-contract.js\n`;
if (!text.includes("node tests/line-approved-mascot-contract.js")) {
  const count = text.split(oldBlock).length - 1;
  if (count !== 1) throw new Error(`主 CI npm test 步驟匹配數錯誤：${count}`);
  text = text.replace(oldBlock, newBlock);
  fs.writeFileSync(path, text);
}
console.log("PASS 正式小老闆圖片契約已納入主 CI");
