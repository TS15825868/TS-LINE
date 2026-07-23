"use strict";
const assert = require("assert");
const fs = require("fs");
const wrapper = fs.readFileSync("social-manual-immediate-publish.js", "utf8");
const assetSource = fs.readFileSync("social-original-asset-override.js", "utf8");
const assets = require("./social-original-asset-override");
const clearPolicy = require("./social-clear-republish-policy");

(async () => {
  assert.match(wrapper, /internal-app-pro\.js/);
  assert.match(wrapper, /post\.status = "approved"/);
  assert.match(wrapper, /post\.assetLocked = true/);
  assert.match(wrapper, /post\.manualImmediatePublish = true/);
  assert.match(wrapper, /post\.manualScheduleOverride = true/);
  assert.match(wrapper, /已成功的平台不重複發布/);
  assert.match(assetSource, /TARGET_SIZE = 1254/);
  assert.match(assetSource, /approved-original-1254-v10/);
  assert.match(assetSource, /exactOriginalSourceCount/);
  assert.match(assetSource, /crispVectorFallbackCount/);
  assert.match(assetSource, /X-XJW-Image-Size/);
  assert.strictEqual(clearPolicy.SCHEDULED_AT, "2026-07-24T11:30:00.000Z");
  assert.strictEqual(clearPolicy.appliedPost.manualScheduleOverride, true);
  assert.strictEqual(clearPolicy.appliedPost.title, "工作再忙，也別忘了休息一下");

  const clear = await assets.info("care-work-rest-clear.jpg");
  assert.strictEqual(clear.ok, true, clear.error || "clear asset failed");
  assert.strictEqual(clear.width, 1254);
  assert.strictEqual(clear.height, 1254);
  assert(clear.exactOriginalSource || clear.crispVectorFallback, "must use a verified original or crisp vector fallback");

  for (const name of Object.keys(assets.THEMES)) {
    const info = await assets.info(name);
    assert.strictEqual(info.ok, true, `${name}: ${info.error || "quality failed"}`);
    assert.strictEqual(info.width, 1254);
    assert.strictEqual(info.height, 1254);
    assert(info.bytes > 40000, `${name} compressed too much`);
  }
  console.log("PASS manual immediate publish, tomorrow schedule and 1254 clear assets");
})().catch((error) => { console.error(error); process.exit(1); });
