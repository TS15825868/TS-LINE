"use strict";

const Module = require("module");

const VERSION = "1.0.1";
const CAMPAIGN_ID = "xjw-approved-zip-202607-v1";
const SEQUENCE_VERSION = "weekly-care-product-v1";
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const REORDERABLE_STATUSES = new Set(["draft", "rejected", "approved", "paused", "failed", "partial"]);

// 依週交錯安排：先關心／生活，再產品／知識。編號只作內部 ID，不對外顯示。
const ORDER = [
  "approved-mascot-original-03", // 早上安排，重點是固定
  "approved-mascot-original-01", // 先分型態，再看怎麼安排
  "approved-mascot-original-05", // 忙碌日與在家日
  "approved-mascot-original-21", // 看懂產品型態
  "approved-mascot-original-04", // 下午補養，也是一種安排
  "approved-mascot-original-02", // 每次份量與整體規格
  "approved-mascot-original-24", // 先想在哪裡使用
  "approved-mascot-original-23", // 小包裝與大包裝
  "approved-mascot-original-06", // 分享給家人
  "approved-mascot-original-08", // 保存方式
  "approved-mascot-original-09", // 熱水沖泡
  "approved-mascot-original-25", // 風味與搭配方式
  "approved-mascot-original-29", // 初次安排先從順手開始
  "approved-mascot-original-28", // 選購前三個問題
  "approved-mascot-original-07", // 收到商品先看封口標示
  "approved-mascot-original-30", // 資訊寫清楚
  "approved-mascot-original-26", // 不同形式的方便
  "approved-mascot-original-27", // 名稱相近仍要看完整標示
  "approved-mascot-original-10", // 講清楚特色
  "approved-mascot-original-22", // 單方與複方
];

function localParts(timestamp) {
  const local = new Date(timestamp + TAIPEI_OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    date: local.getUTCDate(),
  };
}

function taipeiSlotUtc(year, month, date) {
  return Date.UTC(year, month, date, 20, 0, 0) - TAIPEI_OFFSET_MS;
}

function occupiedSlots(posts, excludedIds) {
  const occupied = new Set();
  for (const post of posts) {
    if (!post?.scheduledAt || excludedIds.has(post.id)) continue;
    if (["published", "cancelled"].includes(post.status)) continue;
    const value = new Date(post.scheduledAt).getTime();
    if (Number.isFinite(value)) occupied.add(new Date(value).toISOString());
  }
  return occupied;
}

function nextScheduleSlots(count, nowMs = Date.now(), occupied = new Set()) {
  const slots = [];
  const earliest = nowMs + 24 * 60 * 60 * 1000;
  let cursor = earliest;
  while (slots.length < count) {
    const parts = localParts(cursor);
    for (let offset = 0; offset < 21 && slots.length < count; offset += 1) {
      const local = new Date(Date.UTC(parts.year, parts.month, parts.date + offset));
      const day = local.getUTCDay();
      if (day !== 3 && day !== 5) continue;
      const candidate = taipeiSlotUtc(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
      if (candidate < earliest) continue;
      const iso = new Date(candidate).toISOString();
      if (occupied.has(iso) || slots.includes(iso)) continue;
      slots.push(iso);
    }
    cursor += 21 * 24 * 60 * 60 * 1000;
  }
  return slots;
}

function orderIndex(post) {
  const index = ORDER.indexOf(post.id);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function reorderStore(store, nowMs = Date.now()) {
  if (!store || !Array.isArray(store.posts)) {
    return { store, changed: 0, firstAt: "", lastAt: "", skipped: true };
  }

  const candidates = store.posts
    .filter((post) => post?.campaignId === CAMPAIGN_ID && REORDERABLE_STATUSES.has(post.status))
    .sort((a, b) => orderIndex(a) - orderIndex(b));

  const alreadyCurrent = store.officialSocialSequenceVersion === SEQUENCE_VERSION
    && candidates.every((post) => post.sequenceVersion === SEQUENCE_VERSION);
  if (alreadyCurrent) {
    return { store, changed: 0, firstAt: "", lastAt: "", skipped: true };
  }

  if (!candidates.length) {
    return {
      store: { ...store, officialSocialSequenceVersion: SEQUENCE_VERSION },
      changed: 0,
      firstAt: "",
      lastAt: "",
      skipped: false,
    };
  }

  const candidateIds = new Set(candidates.map((post) => post.id));
  const occupied = occupiedSlots(store.posts, candidateIds);
  const slots = nextScheduleSlots(candidates.length, nowMs, occupied);
  const scheduleById = new Map(candidates.map((post, index) => [post.id, slots[index]]));
  const updatedAt = new Date(nowMs).toISOString();
  let changed = 0;

  const posts = store.posts.map((post) => {
    const scheduledAt = scheduleById.get(post.id);
    if (!scheduledAt) return post;
    if (post.scheduledAt !== scheduledAt) changed += 1;
    const index = ORDER.indexOf(post.id);
    return {
      ...post,
      scheduledAt,
      sequenceVersion: SEQUENCE_VERSION,
      sequenceRole: index >= 0 && index % 2 === 0 ? "care" : "product",
      updatedAt,
    };
  });

  return {
    store: {
      ...store,
      posts,
      officialSocialSequenceVersion: SEQUENCE_VERSION,
      officialSocialSequenceUpdatedAt: updatedAt,
    },
    changed,
    firstAt: slots[0] || "",
    lastAt: slots.at(-1) || "",
    skipped: false,
  };
}

function reorderLiveStore(loaded, nowMs = Date.now()) {
  if (!loaded || typeof loaded.readStore !== "function" || typeof loaded.writeStore !== "function") {
    return { changed: 0, skipped: true };
  }
  const result = reorderStore(loaded.readStore(), nowMs);
  if (!result.skipped) loaded.writeStore(result.store);
  return result;
}

function wrapOfficialRebuild(loaded) {
  const original = loaded?.rebuildOfficialSocialSchedule;
  if (typeof original !== "function" || original.__xjwSequenceReorderWrapped) return;
  const wrapped = function reorderedOfficialSocialSchedule(readStore, writeStore, options = {}) {
    const result = original(readStore, writeStore, options);
    const sequence = reorderStore(readStore(), Number(options.nowMs || Date.now()));
    if (!sequence.skipped) writeStore(sequence.store);
    return {
      ...result,
      sequenceVersion: SEQUENCE_VERSION,
      sequenceChanged: sequence.changed,
      sequenceFirstAt: sequence.firstAt,
      sequenceLastAt: sequence.lastAt,
    };
  };
  Object.defineProperty(wrapped, "__xjwSequenceReorderWrapped", { value: true });
  loaded.rebuildOfficialSocialSchedule = wrapped;
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./social-official-rebuild") wrapOfficialRebuild(loaded);
    if (request === "./social-server" && parent?.filename?.endsWith("internal-entry.js") && loaded?.app) {
      setImmediate(() => {
        try {
          const result = reorderLiveStore(loaded);
          if (!result.skipped) {
            console.log("Official social pending sequence reordered", {
              version: SEQUENCE_VERSION,
              changed: result.changed,
              firstAt: result.firstAt,
              lastAt: result.lastAt,
            });
          }
        } catch (error) {
          console.error("Official social sequence reorder failed", error);
        }
      });
    }
    return loaded;
  };
}

install();

module.exports = {
  VERSION,
  CAMPAIGN_ID,
  SEQUENCE_VERSION,
  ORDER,
  nextScheduleSlots,
  reorderStore,
  reorderLiveStore,
  install,
};
