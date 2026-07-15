"use strict";

const assert = require("assert");
const vm = require("vm");
const { CLIENT_BINDINGS, fixGeneratedHtml } = require("./internal-app-client-fix");

const broken = `<html><head><title>仙加味內部管理 App</title></head><body><div id="mActive"></div><script>const text="a".replace(/\n/g,"<br>");</script></body></html>`;
const fixed = fixGeneratedHtml(broken);

assert.ok(fixed.includes("const __xjwById="));
assert.ok(fixed.includes("replace(/\\n/g"));
assert.ok(!fixed.includes("replace(/\n/g"));
for (const id of CLIENT_BINDINGS) assert.ok(fixed.includes(`const ${id}=__xjwById(${JSON.stringify(id)})`));

const script = fixed.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, "generated browser script must exist");
new vm.Script(script);

assert.strictEqual(fixGeneratedHtml("plain response"), "plain response");
assert.strictEqual(fixGeneratedHtml(fixed), fixed);
console.log("PASS internal app generated browser script and Safari bindings");
