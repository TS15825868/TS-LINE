"use strict";

const { KNOWLEDGE } = require("./social-content-library");
const { EXTRA_KNOWLEDGE } = require("./social-knowledge-extension");

const VERSION = "1.0.0";
const CAMPAIGN_ID = "xjw-official-social-202607-v1";
const APP = "https://ts-line.onrender.com";
const KEEP_STATUSES = new Set(["published", "partial", "publishing"]);

function taipeiDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((item) => [item.type, item.value]));
}

function nextWednesdayFridaySlots(count, now = new Date()) {
  const parts = taipeiDateParts(now);
  const start = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00.000Z`);
  const slots = [];
  for (let offset = 0; slots.length < count && offset < 400; offset += 1) {
    const day = new Date(start.getTime() + offset * 86400000);
    const weekday = day.getUTCDay();
    if (weekday !== 3 && weekday !== 5) continue;
    const scheduled = new Date(Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      12, 0, 0, 0
    ));
    if (scheduled.getTime() <= now.getTime()) continue;
    slots.push(scheduled.toISOString());
  }
  if (slots.length !== count) throw new Error(`無法建立 ${count} 個週三／週五排程`);
  return slots;
}

function officialImageUrl(post, index) {
  const raw = String(post.imageUrl || "");
  const slugMatch = raw.match(/\/knowledge\/(?:v\d+\/)?([^/?]+)\.png/i);
  const slug = slugMatch?.[1];
  if (slug) return `${APP}/social-assets/knowledge/v9/${slug}.png`;
  return `${APP}/social-assets/knowledge/v9/card-${String(index + 1).padStart(2, "0")}.png`;
}

function buildOfficialDrafts(now = new Date()) {
  const source = [...KNOWLEDGE, ...EXTRA_KNOWLEDGE];
  if (source.length !== 30) throw new Error(`正式圖文應為 30 篇，目前 ${source.length} 篇`);
  const slots = nextWednesdayFridaySlots(source.length, now);
  const createdAt = now.toISOString();
  return source.map((item, index) => ({
    id: `post-${CAMPAIGN_ID}-${String(index + 1).padStart(2, "0")}`,
    campaignId: CAMPAIGN_ID,
    campaignKey: `${CAMPAIGN_ID}-${String(index + 1).padStart(2, "0")}`,
    campaignDay: index + 1,
    knowledgeTopic: item.knowledgeTopic || item.title,
    title: String(item.title || "").replace(/小老闆知識\s*\d+/, `小老闆知識 ${String(index + 1).padStart(2, "0")}`),
    imageUrl: officialImageUrl(item, index),
    instagramCaption: item.instagramCaption,
    facebookCaption: item.facebookCaption,
    publishInstagram: true,
    publishFacebook: true,
    scheduledAt: slots[index],
    status: "draft",
    result: {},
    platformStatus: { instagram: "待審核", facebook: "待審核" },
    lastError: "",
    createdAt,
    updatedAt: createdAt,
  }));
}

function resetOfficialSocialDrafts(readStore, writeStore, now = new Date()) {
  const store = readStore();
  const original = Array.isArray(store.posts) ? store.posts : [];
  const history = original.filter((post) => KEEP_STATUSES.has(String(post.status || "")));
  const removed = original.length - history.length;
  const drafts = buildOfficialDrafts(now);
  store.posts = [...history, ...drafts];
  writeStore(store);
  return {
    version: VERSION,
    campaignId: CAMPAIGN_ID,
    preservedPublishedHistory: history.length,
    removedUnpublished: removed,
    draftsCreated: drafts.length,
    firstAt: drafts[0]?.scheduledAt || "",
    lastAt: drafts.at(-1)?.scheduledAt || "",
    cadence: "每週三、週五晚上 8:00",
    timezone: "Asia/Taipei",
  };
}

module.exports = {
  VERSION,
  CAMPAIGN_ID,
  KEEP_STATUSES,
  nextWednesdayFridaySlots,
  buildOfficialDrafts,
  resetOfficialSocialDrafts,
};
