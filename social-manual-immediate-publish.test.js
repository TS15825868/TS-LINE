"use strict";

const assert = require("assert");
const fs = require("fs");
const wrapper = fs.readFileSync("social-manual-immediate-publish.js", "utf8");
const clearPolicy = require("./social-clear-republish-policy");
const batch = require("./social-final-approved-batch");

assert.match(wrapper, /internal-app-pro\.js/);
assert.match(wrapper, /post\.status = "approved"/);
assert.match(wrapper, /post\.assetLocked = true/);
assert.match(wrapper, /post\.manualImmediatePublish = true/);
assert.match(wrapper, /已成功的平台不重複發布/);
assert.strictEqual(clearPolicy.SCHEDULED_AT, "2026-07-24T02:00:00.000Z");
assert.strictEqual(clearPolicy.appliedPost.title, "工作再忙，也別忘了休息一下");
assert.strictEqual(batch.POSTS.length, 10);
assert.strictEqual(batch.POSTS.every((post) => post.qBossMascotLocked), true);
assert.strictEqual(batch.POSTS.every((post) => post.deerPartnerPresent && post.turtlePartnerPresent), true);
console.log("PASS immediate publish controls preserved and first batch starts 7/24 morning");
