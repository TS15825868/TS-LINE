"use strict";

const assert = require("assert");
const guard = require("./social-publish-guard");

(async () => {
  assert.strictEqual(guard.platformDone({ result: { instagram: { id: "ig-1" } } }, "instagram"), true);
  assert.strictEqual(guard.platformDone({ platformStatus: { instagram: "成功" } }, "instagram"), true);
  assert.strictEqual(guard.platformDone({ instagramPublishedAt: "2026-07-22T00:00:00.000Z" }, "instagram"), true);
  assert.strictEqual(guard.platformDone({ platformStatus: { instagram: "失敗" } }, "instagram"), false);

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

  console.log("PASS social publish guard prevents duplicate retries and preserves successful platform state");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
