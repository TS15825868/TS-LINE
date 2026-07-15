"use strict";

const VERSION = "1.0.0";
const LEGACY_PREFIXES = ["xjw-14day-202607"];

function hasPublishedResult(post) {
  return Boolean(post?.result?.instagram || post?.result?.facebook || post?.publishedAt);
}

function isLegacyDuplicate(post) {
  const key = String(post?.campaignKey || "");
  const campaignId = String(post?.campaignId || "");
  const title = String(post?.title || "");
  return LEGACY_PREFIXES.some((prefix) => key.startsWith(prefix) || campaignId.startsWith(prefix))
    || /^14天企劃\s*Day\s*\d+/i.test(title);
}

function removeLegacyDuplicateDrafts(readStore, writeStore) {
  const store = readStore();
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  const before = store.posts.length;
  let preservedHistory = 0;

  store.posts = store.posts.filter((post) => {
    if (!isLegacyDuplicate(post)) return true;
    if (["published", "cancelled"].includes(post.status) || hasPublishedResult(post)) {
      preservedHistory += 1;
      return true;
    }
    return false;
  });

  const removed = before - store.posts.length;
  if (removed) writeStore(store);
  return { version: VERSION, removed, preservedHistory, total: store.posts.length };
}

module.exports = { VERSION, LEGACY_PREFIXES, hasPublishedResult, isLegacyDuplicate, removeLegacyDuplicateDrafts };
