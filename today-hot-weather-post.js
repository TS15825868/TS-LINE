"use strict";

const Module = require("module");

const VERSION = "1.0.0";
const POST_ID = "weather-hot-care-20260721";
const SCHEDULED_AT = "2026-07-21T12:00:00.000Z"; // Asia/Taipei 20:00
const PUBLISH_EARLY_MS = 10 * 1000;
const IMAGE_URL = "https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/social/weather-hot-care-2026-07-21.jpg?v=20260721-corrected";

const INSTAGRAM_CAPTION = [
  "天氣悶熱，外出記得留意防曬與補充水分。",
  "",
  "☀️ 帽子、陽傘都很實用",
  "💧 不要等到口渴才喝，分次補充更順手",
  "🏠 回家後先休息一下，讓步調慢下來",
  "",
  "天氣熱的時候，也要把自己照顧好。",
  "補養，是一種節奏。",
  "",
  "#仙加味 #仙加味小老闆 #日常關心 #夏日提醒 #補充水分 #防曬 #照顧自己",
].join("\n");

const FACEBOOK_CAPTION = [
  "天氣悶熱，外出時也別忘了照顧自己。",
  "",
  "帽子、陽傘都是很實用的防曬準備；喝水則不用等到口渴才想起來，分次補充會更順手。回家後先休息一下，也讓忙了一天的步調慢下來。",
  "",
  "天氣有變化，照顧自己，也關心身邊的人。",
  "補養，是一種節奏。",
  "",
  "#仙加味 #仙加味小老闆 #日常關心 #夏日提醒 #補充水分 #防曬",
].join("\n");

let installed = false;
let publishing = false;
let publishTimer = null;

function postTemplate(nowIso) {
  return {
    id: POST_ID,
    campaignId: "xjw-weather-care-20260721-v1",
    campaignVersion: VERSION,
    category: "氣候關心",
    knowledgeTopic: "天氣悶熱｜防曬與補水提醒",
    title: "天氣悶熱，外出記得留意防曬與補水",
    imageUrl: IMAGE_URL,
    sourceImageFile: "weather-hot-care-2026-07-21.jpg",
    instagramCaption: INSTAGRAM_CAPTION,
    facebookCaption: FACEBOOK_CAPTION,
    publishInstagram: true,
    publishFacebook: true,
    assetLocked: true,
    status: "approved",
    scheduledAt: SCHEDULED_AT,
    result: {},
    lastError: "",
    oneTimeWeatherPost: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function updatePost(loaded, change) {
  const store = loaded.readStore();
  const index = store.posts.findIndex((post) => post.id === POST_ID);
  if (index < 0) return null;
  store.posts[index] = {
    ...store.posts[index],
    ...change,
    updatedAt: new Date().toISOString(),
  };
  loaded.writeStore(store);
  return store.posts[index];
}

function upsertPost(loaded) {
  const store = loaded.readStore();
  const nowIso = new Date().toISOString();
  const index = store.posts.findIndex((post) => post.id === POST_ID);
  const previous = index >= 0 ? store.posts[index] : null;

  if (previous?.status === "published") {
    console.log("Today hot-weather social post already published", { id: POST_ID, publishedAt: previous.publishedAt });
    return previous;
  }

  const desired = postTemplate(previous?.createdAt || nowIso);
  const next = {
    ...previous,
    ...desired,
    result: previous?.result || {},
    createdAt: previous?.createdAt || desired.createdAt,
    updatedAt: nowIso,
  };

  if (index >= 0) store.posts[index] = next;
  else store.posts.push(next);
  loaded.writeStore(store);

  console.log("Today hot-weather social post scheduled", {
    id: POST_ID,
    scheduledAt: SCHEDULED_AT,
    imageUrl: IMAGE_URL,
    platforms: ["Facebook", "Instagram"],
  });
  return next;
}

async function publishPost(loaded) {
  if (publishing) return;
  publishing = true;
  try {
    const current = loaded.readStore().posts.find((post) => post.id === POST_ID);
    if (!current || current.status === "published") return;

    let post = updatePost(loaded, { status: "publishing", lastError: "" });
    const result = { ...(post?.result || {}) };
    const errors = [];

    if (post.publishInstagram && !result.instagram) {
      try {
        result.instagram = await loaded.publishInstagram(post);
      } catch (error) {
        errors.push(`Instagram：${error.message}`);
      }
    }

    if (post.publishFacebook && !result.facebook) {
      try {
        result.facebook = await loaded.publishFacebook(post);
      } catch (error) {
        errors.push(`Facebook：${error.message}`);
      }
    }

    post = updatePost(loaded, {
      result,
      status: errors.length ? (Object.keys(result).length ? "partial" : "failed") : "published",
      lastError: errors.join("｜"),
      publishedAt: errors.length ? "" : new Date().toISOString(),
    });

    console.log("Today hot-weather social post publish result", {
      id: POST_ID,
      status: post?.status,
      lastError: post?.lastError || "",
    });
  } catch (error) {
    updatePost(loaded, { status: "failed", lastError: error.message || "單次發布失敗" });
    console.error("Today hot-weather social post publish failed", error);
  } finally {
    publishing = false;
  }
}

function schedulePublisher(loaded) {
  const publishAt = new Date(SCHEDULED_AT).getTime() - PUBLISH_EARLY_MS;
  const delay = Math.max(0, publishAt - Date.now());
  if (publishTimer) clearTimeout(publishTimer);
  publishTimer = setTimeout(() => publishPost(loaded), delay);
  publishTimer.unref?.();
}

function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (
      request === "./social-server" &&
      parent?.filename?.endsWith("internal-entry.js") &&
      loaded?.readStore && loaded?.writeStore &&
      loaded?.publishInstagram && loaded?.publishFacebook
    ) {
      setImmediate(() => {
        try {
          upsertPost(loaded);
          schedulePublisher(loaded);
        } catch (error) {
          console.error("Today hot-weather social post setup failed", error);
        }
      });
    }
    return loaded;
  };
}

install();

module.exports = {
  VERSION,
  POST_ID,
  SCHEDULED_AT,
  IMAGE_URL,
  INSTAGRAM_CAPTION,
  FACEBOOK_CAPTION,
  postTemplate,
  upsertPost,
  publishPost,
  install,
};
