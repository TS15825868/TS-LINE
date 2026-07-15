"use strict";

const assert = require("assert");
const fs = require("fs");
const source = fs.readFileSync("knowledge-card-server.js", "utf8");

[
  "sharp.cache(false)",
  "sharp.concurrency(1)",
  "CACHE_DIR",
  "renderQueue",
  "renderCardFile",
  "density: 72",
  "res.sendFile(file)",
].forEach((token) => assert.ok(source.includes(token), `missing bounded-memory token: ${token}`));

assert.ok(!source.includes("const imageCache = new Map()"), "rendered PNG buffers must not remain in memory");
assert.ok(!source.includes("density: 144"), "knowledge cards must not render at accidental double resolution");
console.log("PASS bounded-memory serialized knowledge card rendering with disk cache");
