"use strict";
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "server.js");
let text = fs.readFileSync(file, "utf8");
text = text.replace(
  '  const bubble = flexCard(title, description, buttons).contents;\n',
  '  const bubble = flexCard(title, description, buttons).contents;\n  bubble.size = "mega";\n'
);
text = text.replace(
  'console.error("LINE 回覆失敗：", error?.originalError?.response?.data || error.message || error);',
  'const detail = error?.originalError?.response?.data || error?.response?.data || error.message || error;\n    console.error("LINE 回覆失敗：", typeof detail === "object" ? JSON.stringify(detail) : detail);'
);
fs.writeFileSync(file, text, "utf8");
console.log("Applied Flex carousel size fix and readable LINE error logging");
