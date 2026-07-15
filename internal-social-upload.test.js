"use strict";

const assert = require("assert");
const {
  detectImage,
  publicUrl,
  injectUploadUi,
  storageHeaders,
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

const previous = process.env.SUPABASE_SECRET_KEY;
process.env.SUPABASE_SECRET_KEY = "sb_secret_example";
const secretHeaders = storageHeaders();
assert.strictEqual(secretHeaders.apikey, "sb_secret_example");
assert.ok(!("Authorization" in secretHeaders));
process.env.SUPABASE_SECRET_KEY = "eyJexample";
assert.strictEqual(storageHeaders().Authorization, "Bearer eyJexample");
if (previous === undefined) delete process.env.SUPABASE_SECRET_KEY;
else process.env.SUPABASE_SECRET_KEY = previous;

const html = '<html><head><style>body{}</style></head><body><form id="socialForm"><label>公開圖片網址<input name="imageUrl" type="url" placeholder="https://..."></label></form></body></html>';
const injected = injectUploadUi(html);
assert.ok(injected.includes('id="socialImageFile"'));
assert.ok(injected.includes('id="socialImageUploadBtn"'));
assert.ok(injected.includes('/internal/social-upload.js'));
assert.ok(injected.includes('從相簿或檔案選擇照片'));
assert.strictEqual(injectUploadUi(injected), injected);

console.log("PASS internal social image upload helpers");