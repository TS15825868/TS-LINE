"use strict";

require("./social-knowledge-extension");

const library = require("./social-content-library");
const { EXTRA_KNOWLEDGE } = require("./social-knowledge-extension");
const { weeklySchedule } = require("./social-draft-library-weekly");

const VERSION = "1.0.1";
const KNOWLEDGE_IMAGE_BASE = "https://ts-line.onrender.com/social-assets/knowledge/v9";
const ACTIVE_STATUSES = new Set(["draft", "rejected", "approved"]);
const HISTORY_STATUSES = new Set(["published", "cancelled", "failed", "partial", "publishing"]);
const CATEGORY_PATTERN = [
  "product",
  "knowledge",
  "usage",
  "product",
  "knowledge",
  "faq",
  "recipe",
  "knowledge",
  "brand",
];

function clean(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/#\S+/g, "")
    .replace(/(?:30天草稿|長期草稿|小老闆知識)\s*\d+\s*[｜|]/g, "")
    .replace(/仙加味(?:・龜鹿)?|補養是一種節奏|仙加味小老闆幫你整理/g, "")
    .replace(/[\s，。！？、：；（）()｜|／/・#@\-—~～…「」『』【】\[\]]/g, "");
}

function headline(post) {
  return String(post.instagramCaption || post.facebookCaption || "").split("\n")[0].trim();
}

function contentText(post) {
  return clean([
    post.title,
    headline(post),
    post.instagramCaption,
    post.facebookCaption,
  ].join("\n"));
}

function grams(value, size = 2) {
  const text = clean(value);
  const result = new Set();
  if (text.length < size) {
    if (text) result.add(text);
    return result;
  }
  for (let index = 0; index <= text.length - size; index += 1) {
    result.add(text.slice(index, index + size));
  }
  return result;
}

function similarity(left, right) {
  const a = grams(left);
  const b = grams(right);
  if (!a.size || !b.size) return 0;
  let common = 0;
  a.forEach((item) => { if (b.has(item)) common += 1; });
  return common / (a.size + b.size - common);
}

function category(post) {
  const text = `${post.title || ""}\n${headline(post)}\n${post.knowledgeTopic || ""}`;
  if (/小老闆知識|xjw-knowledge/.test(`${post.title || ""}${post.campaignId || ""}`)) return "knowledge";
  if (/料理|燉湯|湯底|餐桌|雞湯|排骨湯|食材/.test(text)) return "recipe";
  if (/收到|宅配|外箱|客服|保存|開封|取用|分裝|日期|包裝|標示|異常|拍照/.test(text)) return "faq";
  if (/怎麼|使用|沖泡|水量|熱水|熱飲|時段|早上|下午|保溫壺|安排|搭配|外出|辦公室/.test(text)) return "usage";
  if (/品牌|認識仙加味|資訊一致|一週|節奏|網站|客服說明/.test(text)) return "brand";
  return "product";
}

function semanticFamily(post) {
  const text = `${post.title || ""}\n${headline(post)}\n${post.instagramCaption || ""}\n${post.facebookCaption || ""}`;
  const rules = [
    ["opening-date", /開封/, /日期|記下/],
    ["powder-drink-start", /鹿茸粉/, /牛奶|豆漿|飲品|少量|第一次/],
    ["season-temperature", /冬天|天氣熱|季節/, /龜鹿膏|產品型態|日常安排/],
    ["morning-afternoon", /早上|下午/, /時間|時段|睡前|安排/],
    ["shape-content", /外型|型態/, /成分|內容|原料|比較|選擇/],
  ];
  const match = rules.find(([, first, second]) => first.test(text) && second.test(text));
  return match ? match[0] : "";
}

function duplicateReason(left, right) {
  const leftTitle = clean(left.title);
  const rightTitle = clean(right.title);
  const leftHeadline = clean(headline(left));
  const rightHeadline = clean(headline(right));
  if (leftTitle && leftTitle === rightTitle) return "標題完全相同";
  if (leftHeadline && leftHeadline === rightHeadline) return "主標完全相同";

  const familyLeft = semanticFamily(left);
  const familyRight = semanticFamily(right);
  if (familyLeft && familyLeft === familyRight) return `主題重複：${familyLeft}`;

  const titleScore = similarity(leftTitle, rightTitle);
  const headlineScore = similarity(leftHeadline, rightHeadline);
  const bodyScore = similarity(contentText(left), contentText(right));
  if (bodyScore >= 0.78) return `文案高度重複：${bodyScore.toFixed(2)}`;
  if (titleScore >= 0.76 && bodyScore >= 0.52) return `標題與內容近似：${titleScore.toFixed(2)}/${bodyScore.toFixed(2)}`;
  if (headlineScore >= 0.78 && bodyScore >= 0.48) return `主標與內容近似：${headlineScore.toFixed(2)}/${bodyScore.toFixed(2)}`;
  if (category(left) === category(right) && titleScore >= 0.58 && bodyScore >= 0.68) {
    return `同分類內容近似：${bodyScore.toFixed(2)}`;
  }
  return "";
}

function knowledgeSlug(post) {
  const match = String(post.imageUrl || "").match(/\/([^/?]+)\.png(?:\?|$)/i);
  return match ? match[1] : "";
}

function normalizeCanonicalPost(post) {
  const next = { ...post };
  if (/xjw-knowledge/.test(String(next.campaignId || ""))) {
    const slug = knowledgeSlug(next);
    if (slug) next.imageUrl = `${KNOWLEDGE_IMAGE_BASE}/${slug}.png`;
  }
  return next;
}

function canonicalPosts() {
  const all = [...library.POSTS, ...EXTRA_KNOWLEDGE].map(normalizeCanonicalPost);
  const seen = new Set();
  return all.filter((post) => {
    const key = String(post.campaignKey || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function score(post, originalIndex = 0) {
  let result = 0;
  if (/xjw-knowledge/.test(String(post.campaignId || ""))) result += 400;
  else if (/xjw-30day/.test(String(post.campaignKey || ""))) result += 260;
  if (post.status === "approved") result += 35;
  if (post.imageUrl) result += 20;
  if (post.instagramCaption && post.facebookCaption) result += 20;
  result += Math.min(40, Math.floor(contentText(post).length / 40));
  result -= originalIndex / 10000;
  return result;
}

function imageKey(post) {
  const value = String(post.imageUrl || "");
  const match = value.match(/\/([^/?]+?)(?:\.(?:png|jpe?g|webp))(?:\?|$)/i);
  return match ? match[1].replace(/[-_]dm$/i, "") : value;
}

function validImage(post) {
  const value = String(post.imageUrl || "").trim();
  if (!/^https:\/\//.test(value)) return false;
  if (/xjw-knowledge/.test(String(post.campaignId || ""))) {
    return /\/social-assets\/knowledge\/v9\/[a-z0-9-]+\.png$/i.test(value);
  }
  return /\.(?:png|jpe?g|webp)(?:\?|$)/i.test(value);
}

function validCopy(post) {
  return Boolean(
    String(post.title || "").trim() &&
    String(post.instagramCaption || "").trim() &&
    String(post.facebookCaption || "").trim()
  );
}

function chooseUnique(posts) {
  const ranked = posts
    .map((post, index) => ({ post, index, score: score(post, index) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const kept = [];
  const duplicates = [];

  for (const candidate of ranked) {
    const existing = kept.find((item) => duplicateReason(candidate.post, item.post));
    if (!existing) {
      kept.push(candidate);
      continue;
    }
    duplicates.push({
      post: candidate.post,
      kept: existing.post,
      reason: duplicateReason(candidate.post, existing.post),
    });
  }

  kept.sort((a, b) => a.index - b.index);
  return { kept: kept.map((item) => item.post), duplicates };
}

function balancedOrder(posts) {
  const buckets = new Map();
  posts.forEach((post) => {
    const key = category(post);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(post);
  });

  const result = [];
  let lastImage = "";
  let patternIndex = 0;
  while ([...buckets.values()].some((items) => items.length)) {
    const preferred = CATEGORY_PATTERN[patternIndex % CATEGORY_PATTERN.length];
    patternIndex += 1;
    let bucket = buckets.get(preferred) || [];
    if (!bucket.length) {
      bucket = [...buckets.values()].filter((items) => items.length).sort((a, b) => b.length - a.length)[0] || [];
    }
    if (!bucket.length) break;

    let selectedIndex = bucket.findIndex((post) => imageKey(post) !== lastImage);
    if (selectedIndex < 0) selectedIndex = 0;
    const [selected] = bucket.splice(selectedIndex, 1);
    result.push(selected);
    lastImage = imageKey(selected);
  }
  return result;
}

function nextScheduleOffset(now = new Date()) {
  const minimum = now.getTime() + 60 * 60 * 1000;
  for (let index = 0; index < 1000; index += 1) {
    if (new Date(weeklySchedule(index)).getTime() >= minimum) return index;
  }
  return 0;
}

function auditSocialSchedule(readStore, writeStore, options = {}) {
  const store = readStore();
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  const now = options.now ? new Date(options.now) : new Date();
  const canonical = canonicalPosts();
  const existingByKey = new Map(store.posts.map((post) => [post.campaignKey, post]));
  const stamp = now.toISOString();
  let added = 0;
  let repaired = 0;

  for (const item of canonical) {
    let post = existingByKey.get(item.campaignKey);
    if (!post) {
      post = {
        id: `post-${item.campaignKey}`,
        ...item,
        status: "draft",
        result: {},
        platformStatus: { instagram: "待處理", facebook: "待處理" },
        lastError: "",
        createdAt: stamp,
        updatedAt: stamp,
      };
      store.posts.push(post);
      existingByKey.set(item.campaignKey, post);
      added += 1;
      continue;
    }
    if (!ACTIVE_STATUSES.has(post.status)) continue;
    const fields = [
      "campaignId", "campaignDay", "knowledgeTopic", "title", "imageUrl",
      "instagramCaption", "facebookCaption", "publishInstagram", "publishFacebook",
    ];
    let changed = false;
    fields.forEach((field) => {
      if (item[field] !== undefined && post[field] !== item[field]) {
        post[field] = item[field];
        changed = true;
      }
    });
    if (changed) {
      post.updatedAt = stamp;
      repaired += 1;
    }
  }

  const candidates = store.posts.filter((post) => ACTIVE_STATUSES.has(post.status));
  const uniqueResult = chooseUnique(candidates);
  let duplicatesCancelled = 0;

  uniqueResult.duplicates.forEach(({ post, kept, reason }) => {
    if (!ACTIVE_STATUSES.has(post.status)) return;
    post.status = "cancelled";
    post.auditStatus = "duplicate-cancelled";
    post.auditDuplicateOf = kept.campaignKey || kept.id;
    post.lastError = `社群整理：與「${kept.title}」內容重複，已取消排程（${reason}）`;
    post.updatedAt = stamp;
    duplicatesCancelled += 1;
  });

  const valid = [];
  const needsFix = [];
  uniqueResult.kept.forEach((post) => {
    const issues = [];
    if (!validCopy(post)) issues.push("標題或平台文案不完整");
    if (!validImage(post)) issues.push("圖片網址缺漏或格式不正確");
    if (issues.length) {
      post.status = "rejected";
      post.auditStatus = "needs-fix";
      post.lastError = `社群整理：${issues.join("、")}`;
      post.updatedAt = stamp;
      needsFix.push(post);
      return;
    }
    post.auditStatus = "verified";
    post.auditVersion = VERSION;
    post.contentCategory = category(post);
    post.lastError = "";
    valid.push(post);
  });

  const ordered = balancedOrder(valid);
  const storedOffset = store.posts.find((post) => Number.isInteger(post.scheduleAuditOffset))?.scheduleAuditOffset;
  const scheduleOffset = Number.isInteger(storedOffset) ? storedOffset : nextScheduleOffset(now);
  ordered.forEach((post, index) => {
    post.scheduleAuditOffset = scheduleOffset;
    post.scheduleSequence = index + 1;
    post.scheduledAt = weeklySchedule(scheduleOffset + index);
    post.updatedAt = stamp;
  });

  const activeOrdered = [...ordered, ...needsFix];
  const activeIds = new Set(activeOrdered.map((post) => post.id));
  const history = store.posts
    .filter((post) => !activeIds.has(post.id))
    .sort((a, b) => {
      const aPublished = HISTORY_STATUSES.has(a.status) ? 1 : 0;
      const bPublished = HISTORY_STATUSES.has(b.status) ? 1 : 0;
      return bPublished - aPublished || new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    });
  store.posts = [...activeOrdered, ...history];

  writeStore(store);
  const categoryCounts = ordered.reduce((result, post) => {
    const key = post.contentCategory;
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});

  return {
    version: VERSION,
    canonicalTotal: canonical.length,
    activeTotal: ordered.length,
    added,
    repaired,
    duplicatesCancelled,
    needsFix: needsFix.length,
    scheduleOffset,
    firstAt: ordered[0]?.scheduledAt || "",
    lastAt: ordered.at(-1)?.scheduledAt || "",
    categoryCounts,
    consecutiveImageRepeats: ordered.slice(1).filter((post, index) => imageKey(post) === imageKey(ordered[index])).length,
  };
}

module.exports = {
  VERSION,
  KNOWLEDGE_IMAGE_BASE,
  ACTIVE_STATUSES,
  CATEGORY_PATTERN,
  clean,
  headline,
  contentText,
  similarity,
  category,
  semanticFamily,
  duplicateReason,
  knowledgeSlug,
  normalizeCanonicalPost,
  canonicalPosts,
  validImage,
  validCopy,
  chooseUnique,
  balancedOrder,
  auditSocialSchedule,
};
