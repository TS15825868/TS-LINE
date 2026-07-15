"use strict";

const assert = require("assert");
const vm = require("vm");
const { VERSION, browserScript, inject } = require("./internal-social-auto-upload");

assert.strictEqual(VERSION, "1.0.0");
const script = browserScript();
assert.ok(script.includes("正在自動上傳"));
assert.ok(script.includes("form.requestSubmit()"));
assert.ok(script.includes("document.addEventListener(\"submit\""));
new vm.Script(script);

const html = '<html><head><title>仙加味內部管理 App</title></head><body><form id="socialForm"></form></body></html>';
const result = inject(html);
assert.ok(result.includes('/internal/social-auto-upload.js?v=1.0.0'));
assert.strictEqual(inject(result), result);
assert.strictEqual(inject("plain response"), "plain response");
console.log("PASS automatic social photo upload flow");