"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const weekly = require("./social-weekly-schedule-override");
const reviewGate = require("./social-review-only-mode");
const batch = require("./social-final-approved-batch");
const sales = require("./line-sales-master.json");
const imageSafety = require("./line-image-safety");

assert.strictEqual(weekly.VERSION, "2026-07-25-weekly-once-v1");
assert.strictEqual(reviewGate.VERSION, "2026-07-26-review-gate-v5");
assert.strictEqual(weekly.FIXED_SCHEDULES.length, 7);
assert.strictEqual(new Set(weekly.FIXED_SCHEDULES).size, weekly.FIXED_SCHEDULES.length);

for (const scheduledAt of weekly.FIXED_SCHEDULES) {
  const parts = reviewGate.taipeiParts(scheduledAt);
  assert(parts, `無法解析建議排程：${scheduledAt}`);
  assert.strictEqual(parts.weekday, "Wed", `固定貼文建議排程不是週三：${scheduledAt}`);
  assert.strictEqual(parts.hour, "20", `固定貼文建議排程不是晚上8點：${scheduledAt}`);
  assert.strictEqual(parts.minute, "00", `固定貼文建議排程分鐘不正確：${scheduledAt}`);
}

assert.strictEqual(batch.POSTS.length, 10);
assert.strictEqual(batch.POSTS.filter((post) => post.conditionalWeather).length, 3);
assert.strictEqual(batch.POSTS.filter((post) => !post.conditionalWeather).length, 7);
assert.strictEqual(new Set(batch.POSTS.map((post) => post.id)).size, 10);
assert.strictEqual(new Set(batch.POSTS.map((post) => post.title)).size, 10);
assert(batch.POSTS.every((post) => post.qBossMascotLocked === true));
assert(batch.POSTS.every((post) => post.deerPartnerPresent === true));
assert(batch.POSTS.every((post) => post.turtlePartnerPresent === true));

const reset = reviewGate.initialReset({
  posts: batch.POSTS.map((post) => ({
    ...post,
    status: post.conditionalWeather ? "paused" : "approved",
    assetLocked: true,
  })),
  publicationLedger: { facebook: {}, instagram: {} },
});
const canonical = reset.posts.filter((post) => reviewGate.CANONICAL_IDS.has(post.id));
assert.strictEqual(canonical.length, 10);
assert(canonical.every((post) => post.status === "pending_review"));
assert(canonical.every((post) => post.scheduledAt === ""));
assert(canonical.filter((post) => !post.conditionalWeather).every((post) => reviewGate.validFixedSlot(post.proposedScheduledAt)));
assert(canonical.every((post) => post.assetLocked === false));
assert(canonical.every((post) => post.approved === false));
assert(canonical.every((post) => post.schedule_enabled === false));
assert(canonical.every((post) => !post.reviewApprovedAt));
assert.strictEqual(reset.automaticSchedulingAfterReview, true);
assert.strictEqual(reset.automaticRetryEnabled, false);

assert.strictEqual(sales.products["guilu-gao"].price, 1500);
assert.strictEqual(sales.products["guilu-gao"].originalPrice, 1800);
assert.strictEqual(sales.products["guilu-drink-30"].price, 50);
assert(sales.products["guilu-drink-30"].offers.includes("買10送2"));
assert.strictEqual(sales.products["guilu-drink-180"].price, 200);
assert(sales.products["guilu-drink-180"].offers.includes("買10送2"));
assert.strictEqual(sales.products["guilu-tangkuai"].price, 1600);
assert.strictEqual(sales.products["luerong-fen"].price, 2000);
assert.strictEqual(sales.products["guilu-jiao"].price, 9600);
assert.strictEqual(sales.products["guilu-jiao"].originalPrice, 12000);
assert.strictEqual(sales.products["guilu-jiao"].quoteOnly, false);
assert.strictEqual(sales.imagePolicy.approvalRequiredBeforePublish, true);
assert.strictEqual(sales.imagePolicy.realProductImagesOnly, true);
assert(sales.imagePolicy.partners.includes("小鹿娃娃"));
assert(sales.imagePolicy.partners.includes("小烏龜娃娃"));

function jpegSize(buffer) {
  assert(buffer[0] === 0xff && buffer[1] === 0xd8, "正式入口圖不是 JPEG");
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (!Number.isFinite(length) || length < 2) break;
    offset += 2 + length;
  }
  throw new Error("無法讀取正式入口圖尺寸");
}

const officialScenes = ["recommend", "combo", "usage", "faq"];
assert.deepStrictEqual(imageSafety.APPROVED_MASCOT_NAMES, officialScenes);
for (const name of officialScenes) {
  const file = path.join(__dirname, "public", "mascot", `${name}.jpg`);
  assert(fs.existsSync(file), `缺少 Issue #146 正式入口圖：${name}.jpg`);
  const buffer = fs.readFileSync(file);
  assert(buffer.length >= 50000, `Issue #146 正式入口圖檔案過小：${name}.jpg`);
  const size = jpegSize(buffer);
  assert(size.width >= 900 && size.height >= 900, `Issue #146 正式入口圖解析度不足：${name}.jpg`);
  assert(Math.abs(size.width / size.height - 1) < 0.03, `Issue #146 正式入口圖不是近似正方形：${name}.jpg`);
}

const sceneCases = [
  ["幫我推薦", "recommend"],
  ["搭配組合", "combo"],
  ["怎麼使用", "usage"],
  ["常見問題", "faq"],
];
for (const [title, expected] of sceneCases) {
  const bubble = { type: "bubble", body: { type: "box", contents: [{ type: "text", text: title }] } };
  imageSafety.applyImageSafety(bubble);
  assert(bubble.hero, `${title} 未套用正式入口圖`);
  assert(bubble.hero.url.includes(`/mascot/${expected}.jpg`), `${title} 套用錯誤入口圖`);
  assert.strictEqual(bubble.hero.aspectRatio, "1:1");
}

const officialProductHero = "https://ts15825868.github.io/xianjiawei/images/products-v3/guilu-gao.jpg";
const productBubble = {
  type: "bubble",
  hero: { type: "image", url: officialProductHero, aspectMode: "fit" },
  body: { type: "box", contents: [{ type: "text", text: "龜鹿膏 100g" }] },
};
imageSafety.applyImageSafety(productBubble);
assert.strictEqual(productBubble.hero.url, officialProductHero, "產品卡真實產品原圖被小老闆圖覆蓋");
assert.strictEqual(productBubble.hero.aspectMode, "fit", "產品卡真實產品圖未維持等比例 fit");

const legacyBubble = {
  type: "bubble",
  hero: { type: "image", url: "https://example.com/welcome.jpg" },
  body: { type: "box", contents: [{ type: "text", text: "其他內容" }] },
};
imageSafety.applyImageSafety(legacyBubble);
assert.strictEqual(legacyBubble.hero, undefined, "舊拼湊小老闆圖未移除");

console.log("PASS current policy: all unpublished posts pending review, schedule only after approval, weekly Wednesday 20:00, fixed mascot partners, official prices and LINE OA Issue #146 image routing");
