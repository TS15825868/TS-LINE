"use strict";

const VERSION = "2.0.0";
const { POSTS } = require("./social-final-posts");

const ORIGINAL_POST_ID = "first-batch-v2-care-work-rest-20260729";
const REPUBLISH_POST_ID = "clear-republish-care-work-rest-20260724";
const SOURCE_IMAGE_FILE = "634CBEF9-5A29-44EE-BFFC-AA5DDB8C049B.PNG";
const REFERENCE_IMAGE_FILE = SOURCE_IMAGE_FILE;
const SCHEDULED_AT = "2026-07-24T02:00:00.000Z"; // 台灣時間 2026/7/24 10:00

function applyClearRepublishPolicy(posts = POSTS) {
  const matches = posts.filter((item) => [ORIGINAL_POST_ID, REPUBLISH_POST_ID].includes(String(item?.id || "")));
  const post = matches[0];
  if (!post) throw new Error("找不到7/24上午首發的日常關心貼文");

  Object.assign(post, {
    id: REPUBLISH_POST_ID,
    title: "工作再忙，也別忘了休息一下",
    scheduledAt: SCHEDULED_AT,
    imageName: "care-work-rest-clear.jpg",
    sourceImageFile: SOURCE_IMAGE_FILE,
    referenceImageFile: REFERENCE_IMAGE_FILE,
    correctedClearRepublish: true,
    manualScheduleOverride: false,
    scheduleTimePolicy: "fixed-wed-fri-10:00",
    clearOriginalRequired: true,
    approvedOriginalAsset: true,
    originalCompositionLocked: true,
    originalCharacterLayoutLocked: true,
    originalSourceWidth: 1254,
    originalSourceHeight: 1254,
    originalSourceDimensions: "1254x1254",
    minimumSourceWidth: 1200,
    minimumSourceHeight: 1200,
    oneTimeCorrectedRepublish: true,
    republishReason: "7/24上午10:00開始正式發布；使用1254×1254清晰圖，小老闆、小鹿與小烏龜配置維持不變",
  });

  for (const duplicate of matches.slice(1)) {
    duplicate.status = "cancelled";
    duplicate.assetLocked = false;
    duplicate.lastError = "已由7/24上午10:00單一正式首發排程取代";
  }
  return post;
}

const appliedPost = applyClearRepublishPolicy();

module.exports = {
  VERSION,
  ORIGINAL_POST_ID,
  REPUBLISH_POST_ID,
  SOURCE_IMAGE_FILE,
  REFERENCE_IMAGE_FILE,
  SCHEDULED_AT,
  applyClearRepublishPolicy,
  appliedPost,
};
