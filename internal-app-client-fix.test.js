"use strict";

const assert = require("assert");
const vm = require("vm");
const { runtimeScript, fixGeneratedHtml } = require("./internal-app-client-fix");

const runtime = runtimeScript();
assert.ok(runtime.includes("async function loadAll"));
assert.ok(runtime.includes("function renderInventory"));
assert.ok(runtime.includes("function renderSocial"));
new vm.Script(runtime);

const broken = '<html><head><title>仙加味內部管理 App</title></head><body><script>broken(</script></body></html>';
const fixed = fixGeneratedHtml(broken);
assert.ok(fixed.includes('/internal/app-runtime.js'));
assert.ok(!fixed.includes('broken('));
assert.strictEqual(fixGeneratedHtml("plain response"), "plain response");

console.log("PASS stable internal app runtime injection");