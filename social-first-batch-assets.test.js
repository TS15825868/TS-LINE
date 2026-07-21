"use strict";

const assert = require("assert");
const sharp = require("sharp");
const assets = require("./social-first-batch-assets");

(async () => {
  const names = Object.keys(assets.ASSETS);
  assert.strictEqual(names.length, 9);
  for (const name of names) {
    const buffer = await assets.imageBuffer(name);
    assert.strictEqual(buffer[0], 0xff);
    assert.strictEqual(buffer[1], 0xd8);
    const metadata = await sharp(buffer).metadata();
    assert.strictEqual(metadata.width, 1080);
    assert.strictEqual(metadata.height, 1080);
    assert.strictEqual(metadata.format, "jpeg");
  }
  console.log("PASS nine generated 1080x1080 first-batch social images");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
