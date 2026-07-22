"use strict";

const VERSION = "1.1.0";
const { POSTS } = require("./social-final-posts");

const ORIGINAL_POST_ID = "first-batch-v2-care-work-rest-20260729";
const REPUBLISH_POST_ID = "clear-republish-care-work-rest-20260723";
const SOURCE_IMAGE_FILE = "care-work-rest-clear-vector-1254.svg";
const REFERENCE_IMAGE_FILE = "D558F584-DEE1-45BB-B243-6166E118617C.PNG";
const SCHEDULED_AT = "2026-07-23T11:30:00.000Z"; // 台灣時間 2026/7/23 19:30

function applyClearRepublishPolicy(posts = POSTS) {
  const post = posts.find((item) => [ORIGINAL_POST_ID, REPUBLISH_POST_ID].includes(String(item?.id || "")));
  if (!post) throw new Error("找不到要重新發布的日常關心貼文");

  Object.assign(post, {
    id: REPUBLISH_POST_ID,
    title: "工作再忙，也別忘了休息一下",
    scheduledAt: SCHEDULED_AT,
    imageName: "care-work-rest-clear.jpg",
    sourceImageFile: SOURCE_IMAGE_FILE,
    referenceImageFile: REFERENCE_IMAGE_FILE,
    correctedClearRepublish: true,
    clearOriginalRequired: true,
    minimumSourceWidth: 1200,
    minimumSourceHeight: 1200,
    republishReason: "取代已刪除的模糊重複貼文；依使用者上傳核准圖內容製作1254×1254向量清晰版",
  });

  post.instagramCaption = [
    "工作一忙，很容易連喝水和休息都忘了。",
    "",
    "久坐一段時間，可以起身伸展一下；手邊放杯水，也替忙碌中的自己留一點喘息時間。",
    "",
    "照顧自己，不必一次改變很多。從一個簡單的小習慣開始，把日常節奏慢慢放穩。",
    "",
    "#仙加味 #仙加味小老闆 #日常關心 #工作日常 #記得休息",
  ].join("\n");

  post.facebookCaption = [
    "工作再忙，也別忘了休息一下。",
    "",
    "久坐後起身伸展、記得補充水分，讓忙碌的一天多一點從容。照顧日常，不一定要一次改很多，從一個簡單的小動作開始就很好。",
    "",
    "#仙加味 #日常關心 #記得休息",
  ].join("\n");

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
