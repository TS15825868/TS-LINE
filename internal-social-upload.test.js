"use strict";

const assert = require("assert");
const {
  detectImage,
  publicUrl,
  injectUploadUi,
  MAX_IMAGE_BYTES,
} = require("./internal-social-upload");

assert.strictEqual(MAX_IMAGE_BYTES, 12 * 1024 * 1024);
assert.deepStrictEqual(
  detectImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])),
  { mime: "image/jpeg", extension: "jpg" }
);
assert.deepStrictEqual(
  detectImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])),
  { mime: "image/png", extension: "png" }
);
assert.deepStrictEqual(
  detectImage(Buffer.from("RIFFxxxxWEBP", "ascii")),
  { mime: "image/webp", extension: "webp" }
);
assert.strictEqual(detectImage(Buffer.from("not-an-image")), null);

assert.strictEqual(
  publicUrl(
    { url: "https://example.supabase.co", bucket: "social media" },
    "2026/07/a b.png"
  ),
  "https://example.supabase.co/storage/v1/object/public/social%20media/2026/07/a%20b.png"
);

const html = '<html><head><style>body{}</style></head><body><form id="socialForm"><label>公開圖片網址<input name="imageUrl" type="url" placeholder="https://..."></label></form></body></html>';
const injected = injectUploadUi(html);
assert.ok(injected.includes('id="socialImageFile"'));
assert.ok(injected.includes('id="socialImageUploadBtn"'));
assert.ok(injected.includes('/internal/api/v2/social/upload'));
assert.ok(injected.includes('上傳完成，可以建立草稿'));
assert.strictEqual(injectUploadUi(injected), injected);

console.log("PASS internal social image upload helpers");