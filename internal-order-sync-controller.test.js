"use strict";

const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("./internal-order-sync-controller"), "utf8");
if (!source.includes("可用庫存")) throw new Error("missing available inventory display");
if (!source.includes("已保留")) throw new Error("missing reserved inventory display");
if (!source.includes("LINE 訂單，可自動通知")) throw new Error("missing LINE order indicator");
new vm.Script(source);
console.log("PASS order sync client controller");
