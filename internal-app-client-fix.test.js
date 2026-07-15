"use strict";

const assert = require("assert");
const vm = require("vm");
const { runtimeScript, helpersScript, fixGeneratedHtml } = require("./internal-app-client-fix");

const runtime = runtimeScript();
assert.ok(runtime.includes("async function loadAll"));
assert.ok(runtime.includes("function renderInventory"));
assert.ok(runtime.includes("function renderSocial"));
new vm.Script(runtime);

const helpers = helpersScript();
assert.ok(helpers.includes("installToolsView"));
assert.ok(helpers.includes("bulkInventory"));
assert.ok(helpers.includes("editSocial"));
assert.ok(helpers.includes("installAutosave"));
new vm.Script(helpers);

const broken = '<html><head><title>仙加味內部管理 App</title></head><body><script>broken(</script></body></html>';
const fixed = fixGeneratedHtml(broken);
assert.ok(fixed.includes('/internal/app-runtime.js'));
assert.ok(fixed.includes('/internal/app-helpers.js'));
assert.ok(!fixed.includes('broken('));
assert.strictEqual(fixGeneratedHtml("plain response"), "plain response");

console.log("PASS stable internal app runtime and operations helper injection");