"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const weekly = require("./social-weekly-schedule-override");
const reviewGate = require("./social-review-only-mode");
const batch = require("./social-final-approved-batch");
const sales = require("./line-sales-master.json");
const imageSafety = require("./line-image-safety");

assert.strictEqual(weekly.VERSION, "2026-08-08-tue-sat-v3");
assert.strictEqual(weekly.FIXED_SCHEDULES.length, 7);
assert.strictEqual(new Set(weekly.FIXED_SCHEDULES).size, weekly.FIXED_SCHEDULES.length);

for (const scheduledAt of weekly.FIXED_SCHEDULES) {
  const parts = reviewGate.taipeiParts(scheduledAt);
  assert(parts, `無法解析建議排程：${scheduledAt}`);
  const isTue = parts.weekday === "Tue" && parts.hour === "19" && parts.minute === "30";
  const isSat = parts.weekday === "Sat" && parts.hour === "09" && parts.minute === "30";
  assert(isTue || isSat, `固定貼文不是週二19:30或週六09:30：${scheduledAt}`);
  assert(reviewGate.validFixedSlot(scheduledAt), `review gate不接受目前固定時段：${scheduledAt}`);
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
  posts: batch.POSTS.map((post) => ({...post,status: post.conditionalWeather ? "paused" : "approved",assetLocked: true})),
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

const ingredientAuthority = {
  "guilu-gao": ["鹿角萃取物", "龜板萃取物", "枸杞", "紅棗", "黃耆", "粉光蔘"],
  "guilu-drink-30": ["水", "龜板萃取物", "鹿角萃取物", "粉光蔘", "枸杞", "紅棗", "黃耆"],
  "guilu-drink-180": ["水", "龜板萃取物", "鹿角萃取物", "粉光蔘", "枸杞", "紅棗", "黃耆"],
  "guilu-tangkuai": ["龜板萃取物", "鹿角萃取物"],
  "guilu-jiao": ["龜板萃取物", "鹿角萃取物"],
  "luerong-fen": ["鹿茸"],
};
assert.strictEqual(sales.version, "2026-08-08-canonical-v6-six-single-specs");
for (const [id, ingredients] of Object.entries(ingredientAuthority)) {
  assert.deepStrictEqual(sales.products[id].ingredients, ingredients, `${id}成分或順序錯誤`);
}
assert.strictEqual(sales.products["guilu-gao"].usage[0], "每日早上及下午各一小匙");
assert(!sales.products["guilu-gao"].usage.some((line) => String(line).includes("每天一次，每次一小匙")));

assert.strictEqual(sales.products["guilu-gao"].price, 1800);
assert.strictEqual(sales.products["guilu-gao"].originalPrice, 2100);
assert.strictEqual(sales.products["guilu-drink-30"].price, 60);
assert(sales.products["guilu-drink-30"].offers.includes("買10送1"));
assert.strictEqual(sales.products["guilu-drink-180"].price, 200);
assert(sales.products["guilu-drink-180"].offers.includes("買10送1"));
assert.strictEqual(sales.products["guilu-tangkuai"].price, 1600);
assert.strictEqual(sales.products["guilu-tangkuai"].specification, "75g／盒｜8塊裝｜每塊約9.375g");
assert.ok(!sales.products["guilu-tangkuai"].variants);
assert.strictEqual(sales.products["luerong-fen"].price, 2000);
assert.strictEqual(sales.products["guilu-jiao"].price, 9600);
assert.strictEqual(sales.products["guilu-jiao"].originalPrice, 12000);
assert.strictEqual(sales.products["guilu-jiao"].quoteOnly, false);
assert.strictEqual(sales.imagePolicy.approvalRequiredBeforePublish, true);
assert.strictEqual(sales.imagePolicy.realProductImagesOnly, true);
assert(sales.imagePolicy.partners.includes("小鹿"));
assert(sales.imagePolicy.partners.includes("小烏龜"));

function jpegSize(buffer) {
  assert(buffer[0] === 0xff && buffer[1] === 0xd8, "正式入口圖不是 JPEG");
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    if (!Number.isFinite(length) || length < 2) break;
    offset += 2 + length;
  }
  throw new Error("無法讀取正式入口圖尺寸");
}

const officialScenes = ["recommend", "combo", "usage", "faq"];
assert.deepStrictEqual(imageSafety.APPROVED_MASCOT_NAMES, officialScenes);
for (const name of officialScenes) {
  const file = path.join(__dirname, "public", "mascot", `${name}.jpg`);
  assert(fs.existsSync(file), `缺少正式入口圖：${name}.jpg`);
  const { width, height } = jpegSize(fs.readFileSync(file));
  assert(width >= 1000 && height >= 1000, `正式入口圖尺寸不足：${name}.jpg (${width}x${height})`);
}

console.log("PASS current social policy: Tue/Sat schedule, six specs, canonical product facts, 30cc/180cc pricing and image safety");
