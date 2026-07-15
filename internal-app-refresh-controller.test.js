"use strict";

const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("./internal-app-refresh-controller"), "utf8");
if (!source.includes("更新中…")) throw new Error("missing loading feedback");
if (!source.includes("已更新")) throw new Error("missing success feedback");
if (!source.includes("window.loadAll")) throw new Error("missing main data reload");
if (!source.includes("/internal/api/v2/ops/diagnostics")) throw new Error("missing diagnostics refresh");
new vm.Script(source);
console.log("PASS internal app refresh controller");
