"use strict";

const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("./internal-app-form-controller"), "utf8");
if (source.includes("event.currentTarget.reset")) throw new Error("unsafe currentTarget reset still exists");
if (!source.includes("const form = event.target")) throw new Error("form is not captured from event target");
if (!source.includes('event.stopImmediatePropagation()')) throw new Error("legacy submit handlers are not blocked");
if (!source.includes('alert("已建立待審草稿")')) throw new Error("missing social success feedback");
new vm.Script(source);
console.log("PASS Safari-safe internal app forms");
