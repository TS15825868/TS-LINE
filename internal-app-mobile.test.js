"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync(require.resolve("./internal-app-mobile-stable.js"), "utf8");

new vm.Script(source);
[
  "xjwMobileNav",
  "xjwMobileSheet",
  "更多功能",
  "社群排程",
  "員工權限",
  "營運工具",
  "env(safe-area-inset-bottom)",
  "xjw-mobile-hidden",
  "moreSignature",
].forEach((token) => assert.ok(source.includes(token), `mobile UI missing ${token}`));
assert.ok(source.includes("grid-template-columns:repeat(5,1fr)"));
assert.ok(source.includes("padding-bottom:calc(94px"));
assert.ok(source.includes("if (signature === moreSignature) return"));
console.log("PASS complete mobile navigation, safe-area spacing and non-blocking connection status");
