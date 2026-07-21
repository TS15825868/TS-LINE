"use strict";

const assert = require("assert");
const patch = require("./social-approved-mascot-assets");

const source = [
  'imageUrl: `${RAW_BASE}/care-work-rest-2026-07-29.jpg?v=first-batch-v2`,',
  'imageUrl: `${RAW_BASE}/care-family-2026-08-05.jpg?v=first-batch-v2`,',
  'imageUrl: `${RAW_BASE}/care-temperature-gap-2026-08-12.jpg?v=first-batch-v2`,',
  'imageUrl: `${RAW_BASE}/care-hydration-2026-08-19.jpg?v=first-batch-v2`,',
  'imageUrl: `${RAW_BASE}/care-rainy-day-2026-08-26.jpg?v=first-batch-v2`,',
].join("\n");

const transformed = patch.transformFirstBatch(source);
assert.ok(transformed.includes("public/mascot/faq.jpg"));
assert.ok(transformed.includes("public/mascot/brand.jpg"));
assert.ok(transformed.includes("public/mascot/service.jpg"));
assert.ok(transformed.includes("public/mascot/usage.jpg"));
assert.ok(transformed.includes("public/mascot/welcome.jpg"));
assert.ok(!transformed.includes("care-work-rest-2026-07-29.jpg"));
assert.strictEqual(Object.keys(patch.CARE_IMAGE_MAP).length, 5);

console.log("approved mascot care asset tests passed");