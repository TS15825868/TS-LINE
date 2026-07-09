"use strict";
const fs = require("fs");
const file = ".github/workflows/verify-line-and-website-catalog.yml";
let text = fs.readFileSync(file, "utf8");
text = text.replace('"version":"v300.3"', '"version":"v300.4"');
fs.writeFileSync(file, text, "utf8");
console.log("verification version updated to v300.4");
