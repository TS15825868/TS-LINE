"use strict";

const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("./internal-app-form-controller"), "utf8");
if (source.includes("event.currentTarget.reset")) throw new Error("unsafe currentTarget reset still exists");
if (!source.includes("const form = event.target")) throw new Error("form is not captured from event target");
if (!source.includes("event.stopImmediatePropagation()")) throw new Error("legacy submit handlers are not blocked");
if (!source.includes("已建立待審草稿，表單已清空")) throw new Error("missing social create and reset feedback");
if (!source.includes("草稿已更新，表單已清空")) throw new Error("missing social edit and reset feedback");
if (!source.includes('method: id ? "PATCH" : "POST"')) throw new Error("social create/edit method switch missing");
if (!source.includes("resetSocial(form)")) throw new Error("social reset is not executed");
new vm.Script(source);
console.log("PASS Safari-safe unified internal app forms");
