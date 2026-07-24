"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const runtime = require("./line-approved-mascot-runtime");
const safety = require("./line-image-safety");
const server = require("./server");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function allBubbles(message) {
  if (message?.type !== "flex") return [];
  return message.contents?.type === "carousel" ? message.contents.contents : [message.contents];
}

function syntheticScene(title) {
  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      body: { type: "box", layout: "vertical", contents: [{ type: "text", text: title }] },
    },
  };
}

(async () => {
  assert.strictEqual(runtime.VERSION, "402.1");
  assert.strictEqual(runtime.APPROVED_MASCOT_VERSION, safety.APPROVED_MASCOT_VERSION);
  assert.strictEqual(runtime.APPROVED_SCENES.length, 9);
  assert.strictEqual(safety.APPROVED_MASCOT_NAMES.length, 9);

  for (const scene of runtime.APPROVED_SCENES) {
    const file = path.join(__dirname, "public", "mascot", `${scene}.jpg`);
    assert(fs.existsSync(file), `missing ${scene}.jpg`);
    const meta = await sharp(file).metadata();
    assert(meta.width >= 768 && meta.height >= 768, `${scene}.jpg must remain clear`);
    assert.strictEqual(meta.width, meta.height, `${scene}.jpg must keep the approved square layout`);
    const url = runtime.assetUrl(scene);
    assert.strictEqual(safety.isApprovedMascotUrl(url), true, `${scene} should be approved`);
    assert.strictEqual(safety.isBlockedMascotUrl(url), false, `${scene} should not be blocked`);
    assert.strictEqual(safety.isBlockedMascotUrl(url.replace(runtime.APPROVED_MASCOT_VERSION, "old")), true, `${scene} old versions must be blocked`);
  }

  const flows = [
    [server.mascotWelcomeReply(), "welcome"],
    [server.recommendReply(), "recommend"],
    [server.comboReply(), "combo"],
    [server.comboMenuReply(), "combo"],
    [server.usageChooserReply(), "usage"],
    [server.faqReply(), "faq"],
    [server.brandStoryReply(), "brand"],
    [syntheticScene("產品總覽｜小老闆幫你整理"), "products"],
    [server.cartFlex({ cart: [], checkout: null }), "cart"],
  ];

  for (const [message, expectedScene] of flows) {
    const output = clone(message);
    runtime.applyApprovedMascotScenes(output);
    safety.applyImageSafety(output);
    const sceneBubble = allBubbles(output).find((bubble) => bubble.hero && !runtime.realProductHero(bubble.hero));
    assert(sceneBubble, `${expectedScene} scene missing`);
    assert(sceneBubble.hero.url.includes(`/mascot/${expectedScene}.jpg`), `${expectedScene} wrong scene`);
    assert.strictEqual(safety.isApprovedMascotUrl(sceneBubble.hero.url), true);
  }

  const products = clone(server.productCarousel());
  runtime.applyApprovedMascotScenes(products);
  safety.applyImageSafety(products);
  assert.strictEqual(products.contents.contents.length, 6);
  for (const bubble of products.contents.contents) {
    assert(runtime.realProductHero(bubble.hero), "real product hero must not be replaced");
    assert(bubble.hero.url.includes("/xianjiawei/images/products-v3/"));
  }

  console.log("PASS nine approved LINE OA scenes, six real product cards, old-version blocking and full reply flow mapping");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
