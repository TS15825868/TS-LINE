"use strict";

const assert = require("assert");
const guard = require("./social-publish-guard");

(async () => {
  assert.strictEqual(guard.VERSION, "2.0.0");
  assert.strictEqual(guard.platformDone({ result: { instagram: { id: "ig-1" } } }, "instagram"), true);
  assert.strictEqual(guard.platformDone({ platformStatus: { instagram: "成功" } }, "instagram"), true);
  assert.strictEqual(guard.platformDone({ platformStatus: { instagram: "已略過重複" } }, "instagram"), true);
  assert.strictEqual(guard.platformDone({ instagramPublishedAt: "2026-07-22T00:00:00.000Z" }, "instagram"), true);
  assert.strictEqual(guard.platformDone({ platformStatus: { instagram: "失敗" } }, "instagram"), false);

  const published = {
    id: "published-post",
    title: "工作再忙，也別忘了休息一下",
    sourceImageFile: "care-work-rest.jpg",
    imageUrl: "https://ts-line.onrender.com/social-approved-assets/care-work-rest.jpg?v=old",
    instagramCaption: "工作一忙，也記得休息。",
    facebookCaption: "工作一忙，也記得休息。",
    publishInstagram: true,
    publishFacebook: true,
    result: { instagram: { id: "ig-1" } },
    platformStatus: { instagram: "成功", facebook: "失敗" },
    instagramPublishedAt: "2026-07-22T11:30:00.000Z",
  };
  const retryUnderDifferentId = {
    ...published,
    id: "duplicate-record",
    imageUrl: "https://ts-line.onrender.com/social-approved-assets/care-work-rest.jpg?v=highres-new",
    result: {},
    platformStatus: {},
    instagramPublishedAt: "",
  };
  assert.strictEqual(
    guard.platformFingerprint(published, "instagram"),
    guard.platformFingerprint(retryUnderDifferentId, "instagram"),
    "cache-busting image version must not create a new publication fingerprint"
  );

  const store = { posts: [published], publicationLedger: {} };
  const historyMatch = guard.findPublishedMatch(store, retryUnderDifferentId, "instagram");
  assert(historyMatch && historyMatch.postId === "published-post", "published post history must block duplicate record");

  guard.recordPublication(store, published, "instagram", { id: "ig-1" }, published.instagramPublishedAt);
  const ledgerMatch = guard.findPublishedMatch({ posts: [], publicationLedger: store.publicationLedger }, retryUnderDifferentId, "instagram");
  assert(ledgerMatch && ledgerMatch.source === "ledger", "persistent ledger must survive post list cleanup or restart");

  assert.deepStrictEqual(
    guard.publishOutcome({
      publishInstagram: true,
      publishFacebook: true,
      result: { instagram: { id: "ig-1" } },
      platformStatus: { instagram: "成功", facebook: "失敗" },
    }),
    {
      requested: ["instagram", "facebook"],
      completed: ["instagram"],
      allDone: false,
      anyDone: true,
      status: "partial",
    }
  );

  let calls = 0;
  const first = guard.withPostLock("post-1", async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return "done";
  });
  const second = guard.withPostLock("post-1", async () => {
    calls += 1;
    return "duplicate";
  });
  assert.strictEqual(first, second, "同一貼文的同時發布必須共用同一個 Promise");
  assert.strictEqual(await first, "done");
  assert.strictEqual(await second, "done");
  assert.strictEqual(calls, 1, "同一貼文同時點擊只能執行一次");
  assert.strictEqual(guard.inFlightCount(), 0);

  console.log("PASS persistent fingerprint ledger and per-post lock prevent duplicate social publishing");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
