"use strict";

const assert = require("assert");
const {
  CAMPAIGN_ID,
  MASCOT_CAMPAIGN_ID,
  TOPICS,
  imageUrl,
  instagramCaption,
  facebookCaption,
  nextScheduleSlots,
  rebuildProductContentSchedule,
} = require("./social-product-content-rebuild");

assert.strictEqual(TOPICS.length, 20, "產品與品牌貼文必須剛好20篇");
assert.strictEqual(new Set(TOPICS.map((topic) => topic.slug)).size, 20, "slug不可重複");
assert.strictEqual(new Set(TOPICS.map((topic) => topic.number)).size, 20, "編號不可重複");

for (const topic of TOPICS) {
  assert.ok(imageUrl(topic).startsWith("https://ts15825868.github.io/xianjiawei/"), `${topic.slug} 圖片必須來自正式官網`);
  assert.ok(/images\/(dm-final|products-v3)\//.test(topic.image), `${topic.slug} 必須使用正式產品圖或DM`);
  assert.ok(instagramCaption(topic).includes("@762jybnm"), `${topic.slug} IG文案缺少LINE`);
  assert.ok(facebookCaption(topic).includes("@762jybnm"), `${topic.slug} FB文案缺少LINE`);
  const combined = `${topic.title}\n${topic.lead}\n${topic.bullets.join("\n")}`;
  for (const prohibited of ["治療", "療效", "改善疾病", "治癒", "預防疾病"]) {
    assert.ok(!combined.includes(prohibited), `${topic.slug} 出現不允許的醫療宣稱：${prohibited}`);
  }
}

const nowMs = Date.UTC(2026, 6, 17, 13, 0, 0);
const slots = nextScheduleSlots(20, nowMs);
assert.strictEqual(slots.length, 20, "排程必須剛好20個時段");
for (const slot of slots) {
  const taipei = new Date(Date.parse(slot) + 8 * 60 * 60 * 1000);
  assert.ok([0, 2].includes(taipei.getUTCDay()), "排程必須是週日或週二");
  assert.strictEqual(taipei.getUTCHours(), 20, "排程必須是台北時間20:00");
  assert.strictEqual(taipei.getUTCMinutes(), 0, "排程分鐘必須為00");
}

const published = {
  id: "published-keep-1",
  campaignId: MASCOT_CAMPAIGN_ID,
  title: "已發布貼文",
  status: "published",
  scheduledAt: "2026-07-15T12:00:00.000Z",
};
const mascotPosts = Array.from({ length: 20 }, (_, index) => ({
  id: `approved-mascot-original-${String(index + 1).padStart(2, "0")}`,
  campaignId: MASCOT_CAMPAIGN_ID,
  title: `小老闆 ${index + 1}`,
  status: "draft",
  scheduledAt: new Date(nowMs + (index + 2) * 86400000).toISOString(),
}));
const previousProductPosts = [
  {
    id: "approved-product-brand-01",
    campaignId: CAMPAIGN_ID,
    status: "approved",
    scheduledAt: "2026-07-19T12:00:00.000Z",
    result: { review: "kept" },
    createdAt: "2026-07-17T12:00:00.000Z",
  },
  {
    id: "approved-product-brand-02",
    campaignId: CAMPAIGN_ID,
    status: "rejected",
    scheduledAt: "2026-07-21T12:00:00.000Z",
    lastError: "已退回修改",
    createdAt: "2026-07-17T12:00:00.000Z",
  },
];
const wrongDrafts = Array.from({ length: 30 }, (_, index) => ({
  id: `wrong-${index + 1}`,
  campaignId: "wrong-auto-campaign",
  status: "draft",
}));

let store = { posts: [published, ...mascotPosts, ...wrongDrafts] };
const result = rebuildProductContentSchedule(
  () => store,
  (next) => { store = next; },
  { nowMs, previousPosts: previousProductPosts }
);

assert.strictEqual(result.activeTotal, 20, "第二批活動必須剛好20篇");
assert.strictEqual(result.preservedMascot, 20, "必須保留20篇小老闆貼文");
assert.strictEqual(result.preservedPublished, 1, "必須保留已發布貼文");
assert.strictEqual(store.posts.length, 41, "總數必須為1篇已發布＋20篇小老闆＋20篇產品品牌");
assert.strictEqual(store.posts.filter((post) => post.campaignId === CAMPAIGN_ID).length, 20, "產品品牌活動必須20篇");
assert.strictEqual(store.posts.filter((post) => post.campaignId === MASCOT_CAMPAIGN_ID && post.status !== "published").length, 20, "小老闆活動必須保留20篇");
assert.strictEqual(store.posts.filter((post) => post.campaignId === "wrong-auto-campaign").length, 0, "錯誤舊草稿不得保留");
assert.strictEqual(store.posts.find((post) => post.id === "approved-product-brand-01").status, "approved", "已審核狀態必須保留");
assert.strictEqual(store.posts.find((post) => post.id === "approved-product-brand-02").status, "rejected", "退回狀態必須保留");
assert.strictEqual(store.posts.find((post) => post.id === "approved-product-brand-01").scheduledAt, "2026-07-19T12:00:00.000Z", "原排程不得被部署重設");

console.log("PASS 產品與品牌第二批：20篇正式文案、官網產品圖/DM、週日週二20:00、保留20篇小老闆與已發布紀錄、清除錯誤舊草稿。");
