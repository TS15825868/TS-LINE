"use strict";

const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("./internal-app-upload-controller"), "utf8");
if (!source.includes("正在自動壓縮並上傳照片")) throw new Error("missing automatic upload status");
if (!source.includes("/internal/api/v2/social/upload")) throw new Error("missing upload endpoint");
if (!source.includes('file.addEventListener("change"')) throw new Error("missing file change handler");
if (!source.includes("form.requestSubmit()")) throw new Error("missing automatic resubmit");
new vm.Script(source);
console.log("PASS direct social upload controller");
