"use strict";

const base = require("./social-schedule-audit");
const { weeklySchedule } = require("./social-draft-library-weekly");

const ORDER_FIX_VERSION = "1.0.0";
const originalAuditSocialSchedule = base.auditSocialSchedule;

function imageKey(post) {
  const value = String(post?.imageUrl || "");
  const match = value.match(/\/([^/?]+?)(?:\.(?:png|jpe?g|webp))(?:\?|$)/i);
  return match ? match[1].replace(/[-_]dm$/i, "") : value;
}

function countImages(posts) {
  const counts = new Map();
  posts.forEach((post) => {
    const key = imageKey(post);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

function consecutiveImageRepeats(posts) {
  return posts.slice(1).filter((post, index) => imageKey(post) === imageKey(posts[index])).length;
}

function reorderWithoutAdjacentImages(posts) {
  const remaining = posts.map((post, index) => ({ post, index }));
  const ordered = [];
  let lastImage = "";
  let patternIndex = 0;

  while (remaining.length) {
    const counts = countImages(remaining.map((item) => item.post));
    const preferred = base.CATEGORY_PATTERN[patternIndex % base.CATEGORY_PATTERN.length];
    patternIndex += 1;

    const candidates = remaining
      .filter((item) => imageKey(item.post) !== lastImage)
      .sort((left, right) => {
        const leftKey = imageKey(left.post);
        const rightKey = imageKey(right.post);
        const frequencyDifference = (counts.get(rightKey) || 0) - (counts.get(leftKey) || 0);
        if (frequencyDifference) return frequencyDifference;

        const leftPreferred = base.category(left.post) === preferred ? 1 : 0;
        const rightPreferred = base.category(right.post) === preferred ? 1 : 0;
        if (leftPreferred !== rightPreferred) return rightPreferred - leftPreferred;

        const leftCategoryDistance = base.CATEGORY_PATTERN.indexOf(base.category(left.post));
        const rightCategoryDistance = base.CATEGORY_PATTERN.indexOf(base.category(right.post));
        if (leftCategoryDistance !== rightCategoryDistance) return leftCategoryDistance - rightCategoryDistance;
        return left.index - right.index;
      });

    if (!candidates.length) {
      return {
        ordered: [...ordered, ...remaining.map((item) => item.post)],
        unresolved: remaining.length,
      };
    }

    const selected = candidates[0];
    const selectedIndex = remaining.indexOf(selected);
    remaining.splice(selectedIndex, 1);
    ordered.push(selected.post);
    lastImage = imageKey(selected.post);
  }

  return { ordered, unresolved: 0 };
}

function auditSocialSchedule(readStore, writeStore, options = {}) {
  const baseResult = originalAuditSocialSchedule(readStore, writeStore, options);
  const store = readStore();
  store.posts = Array.isArray(store.posts) ? store.posts : [];

  const verified = store.posts
    .filter((post) => base.ACTIVE_STATUSES.has(post.status) && post.auditStatus === "verified")
    .sort((left, right) => Number(left.scheduleSequence || 0) - Number(right.scheduleSequence || 0));

  const reordered = reorderWithoutAdjacentImages(verified);
  const repeatCount = consecutiveImageRepeats(reordered.ordered);

  if (reordered.unresolved || repeatCount) {
    throw new Error(`無法完成社群圖片交錯排序：仍有 ${repeatCount || reordered.unresolved} 組相鄰圖片重複`);
  }

  const scheduleOffset = Number.isInteger(baseResult.scheduleOffset)
    ? baseResult.scheduleOffset
    : Number(verified[0]?.scheduleAuditOffset || 0);
  const stamp = (options.now ? new Date(options.now) : new Date()).toISOString();

  reordered.ordered.forEach((post, index) => {
    post.scheduleAuditOffset = scheduleOffset;
    post.scheduleSequence = index + 1;
    post.scheduledAt = weeklySchedule(scheduleOffset + index);
    post.updatedAt = stamp;
  });

  const orderedIds = new Set(reordered.ordered.map((post) => post.id));
  const activeNeedsFix = store.posts.filter(
    (post) => base.ACTIVE_STATUSES.has(post.status) && post.auditStatus === "needs-fix"
  );
  const needsFixIds = new Set(activeNeedsFix.map((post) => post.id));
  const history = store.posts.filter((post) => !orderedIds.has(post.id) && !needsFixIds.has(post.id));
  store.posts = [...reordered.ordered, ...activeNeedsFix, ...history];
  writeStore(store);

  return {
    ...baseResult,
    orderFixVersion: ORDER_FIX_VERSION,
    activeTotal: reordered.ordered.length,
    firstAt: reordered.ordered[0]?.scheduledAt || "",
    lastAt: reordered.ordered.at(-1)?.scheduledAt || "",
    consecutiveImageRepeats: 0,
  };
}

base.auditSocialSchedule = auditSocialSchedule;
base.reorderWithoutAdjacentImages = reorderWithoutAdjacentImages;
base.consecutiveImageRepeats = consecutiveImageRepeats;
base.ORDER_FIX_VERSION = ORDER_FIX_VERSION;

module.exports = base;
