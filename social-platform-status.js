"use strict";

const VERSION = "1.0.0";

function platformDone(post, key) {
  return Boolean(post?.result?.[key]) || post?.platformStatus?.[key] === "成功";
}

function platformLabel(post, key, enabled) {
  if (!enabled) return "未選擇";
  if (post?.result?.[key]) return "成功";
  if (post?.platformStatus?.[key] === "成功") return "成功";
  if (["failed", "partial"].includes(post?.status)) return "失敗";
  if (post?.status === "published") return "成功";
  return post?.platformStatus?.[key] || "待處理";
}

function normalizePost(post) {
  if (!post || typeof post !== "object") return { changed: false, post };

  const instagram = platformLabel(post, "instagram", Boolean(post.publishInstagram));
  const facebook = platformLabel(post, "facebook", Boolean(post.publishFacebook));
  const instagramDone = !post.publishInstagram || platformDone(post, "instagram") || (post.status === "published" && instagram === "成功");
  const facebookDone = !post.publishFacebook || platformDone(post, "facebook") || (post.status === "published" && facebook === "成功");
  const allDone = instagramDone && facebookDone;
  const anyDone = (post.publishInstagram && instagramDone) || (post.publishFacebook && facebookDone);

  const nextStatus = allDone
    ? "published"
    : anyDone && ["failed", "partial", "publishing"].includes(post.status)
      ? "partial"
      : post.status;

  const next = {
    ...post,
    platformStatus: { ...(post.platformStatus || {}), instagram, facebook },
    status: nextStatus,
  };

  if (allDone) {
    next.lastError = "";
    next.publishedAt = post.publishedAt || new Date().toISOString();
  }

  const changed = JSON.stringify({
    platformStatus: post.platformStatus || {},
    status: post.status,
    lastError: post.lastError || "",
    publishedAt: post.publishedAt || "",
  }) !== JSON.stringify({
    platformStatus: next.platformStatus,
    status: next.status,
    lastError: next.lastError || "",
    publishedAt: next.publishedAt || "",
  });

  if (changed) next.updatedAt = new Date().toISOString();
  return { changed, post: next };
}

function normalizeSocialPlatformStatus(readStore, writeStore) {
  const store = readStore();
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  let updated = 0;
  store.posts = store.posts.map((post) => {
    const result = normalizePost(post);
    if (result.changed) updated += 1;
    return result.post;
  });
  if (updated) writeStore(store);
  return { version: VERSION, updated, total: store.posts.length };
}

function wrapExecute(execute, readStore, writeStore) {
  return async function executeWithStatusReconciliation(postId) {
    await execute(postId);
    normalizeSocialPlatformStatus(readStore, writeStore);
    const store = readStore();
    return (store.posts || []).find((post) => post.id === postId) || null;
  };
}

module.exports = {
  VERSION,
  platformDone,
  platformLabel,
  normalizePost,
  normalizeSocialPlatformStatus,
  wrapExecute,
};
