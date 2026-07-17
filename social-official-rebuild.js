"use strict";

const crypto = require("crypto");

const VERSION = "1.0.0";
const CAMPAIGN_ID = "xjw-official-mascot-202607-v1";
const IMAGE_VERSION = "v10";
const APP_ORIGIN = "https://ts-line.onrender.com";
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const CTA = "有產品、保存或使用方式的問題，可私訊或加入官方 LINE：@762jybnm。";
const TAGS = "#仙加味 #仙加味小老闆 #龜鹿 #漢方生活 #日常補養 #補養是一種節奏";

const TOPICS = [
  ["daily-rhythm", "日常安排，重點是節奏", ["補養不是一次安排很多", "早上、下午或餐桌都可安排", "能持續、順手更重要"]],
  ["morning-rhythm", "早上安排，重點是固定", ["選自己不容易忘的時間", "依產品標示安排份量", "固定後更容易持續"]],
  ["afternoon-rhythm", "下午安排，也是一種選擇", ["可配合午餐或工作休息時間", "依生活作息選擇", "找到適合自己的固定時段"]],
  ["busy-home-days", "忙碌日與在家日，方式可不同", ["外出可看即飲或小包裝", "在家可看沖泡或料理", "不必每天使用同一種型態"]],
  ["form-first", "先分型態，再看怎麼安排", ["膏、飲、湯塊、粉是不同型態", "先看哪一種適合你的日常", "再確認規格與使用方式"]],
  ["small-large-pack", "小包裝與大包裝，各有方便", ["小包裝適合攜帶與分次", "大包裝適合固定居家安排", "先看使用情境，不只看大小"]],
  ["g-and-cc", "g 與 cc 不能只看數字比較", ["g 是重量單位", "cc 是容量單位", "先看型態與使用方式"]],
  ["taiwan-catty", "一台斤是多少公克", ["台灣一台斤是 600 公克", "半斤是 300 公克", "換算後再比較規格"]],
  ["pieces-and-weight", "片數多，不代表總重量比較多", ["片數是切分方式", "總重量才是完整規格", "也可一起看每片約重"]],
  ["serving-and-total", "先看每次份量，再看整體規格", ["每次份量是一次安排的量", "每盒每罐是完整內容量", "先看單次，再看整體"]],
  ["understand-forms", "看懂產品型態，安排更順手", ["膏與粉可自行取用", "飲品可直接安排", "湯塊適合沖泡或料理"]],
  ["single-compound", "看懂單方與複方，選擇更清楚", ["單方原料較單純", "複方包含多種原料搭配", "先看成分表再做選擇"]],
  ["thermos-cube", "保溫壺也能沖泡湯塊", ["先用熱水預熱容器", "加入湯塊與足量熱水", "依口感調整時間與水量"]],
  ["taste-adjustment", "口感濃淡，可以依習慣調整", ["同一產品水量不同口感也不同", "先從順口的比例開始", "需要時再慢慢調整"]],
  ["flavour-method", "風味會受搭配方式影響", ["原料組合會影響風味", "沖泡、溫熱、燉煮口感不同", "先看使用方式再品嚐"]],
  ["dissolve-speed", "化開快慢，不能單獨判斷品質", ["水溫會影響化開速度", "型態與切塊大小也有差", "成分與標示要一起看"]],
  ["storage-label", "保存方式，依包裝說明最準", ["未開封與開封後可能不同", "放陰涼處或依標示保存", "取用後記得密封"]],
  ["storage-space", "購買前，先確認保存空間", ["先看是否需要冷藏", "再看包裝大小", "選擇家中方便保存的規格"]],
  ["seal-and-label", "收到商品，先看封口與標示", ["確認外盒與封口完整", "查看品名與規格", "有疑問先拍照保留"]],
  ["delivery-check", "收到產品後，先確認什麼", ["名稱與規格是否正確", "有效日期與保存方式", "包裝運送狀況是否完整"]],
  ["appearance-content", "外型不能代表內容比例", ["包裝與型態只是呈現方式", "真正要看成分與規格", "不靠外觀直接下判斷"]],
  ["similar-names", "名稱相近，也要看完整標示", ["名稱接近規格可能不同", "型態不同使用方式也可能不同", "比較前先把標示看完整"]],
  ["clear-features", "講清楚特色，比複雜比較更重要", ["重點放在自己的原料與規格", "清楚說明使用方式", "讓消費者依需求判斷"]],
  ["clear-information", "資訊寫清楚，選購更安心", ["規格清楚較容易比較", "成分清楚較容易理解", "保存與使用說明也要完整"]],
  ["share-with-family", "分享給家人，先看使用方式", ["先確認對方習慣的型態", "一起說明每次份量", "保存方式也要交代清楚"]],
  ["choose-by-place", "先想在哪裡使用，再做選擇", ["在家可看日常節奏", "外出可看攜帶方便", "餐桌搭配可看料理型態"]],
  ["different-convenience", "同樣是方便，不一定是同一種方便", ["有的是開封方便", "有的是料理安排方便", "有的是保存與攜帶方便"]],
  ["three-questions", "選購前，先問自己三個問題", ["想怎麼安排", "想在哪裡使用", "想要哪一種方便"]],
  ["easy-first", "初次安排，先從順手開始", ["先選自己容易做到的方式", "順手後再固定日常節奏", "不求一次很多，重點是持續"]],
  ["hot-water-method", "想搭配熱水，先看沖泡方式", ["先確認產品是否適合沖泡", "再看建議水量與溫度", "依口感慢慢調整"]],
].map(([slug, title, bullets], index) => ({ number: index + 1, slug, title, bullets }));

function instagramCaption(topic) {
  return [
    topic.title,
    "",
    topic.bullets.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    "",
    "仙加味小老闆幫你整理。",
    "補養，是一種節奏。",
    "",
    TAGS,
  ].join("\n");
}

function facebookCaption(topic) {
  return [
    topic.title,
    "",
    "選擇產品時，不必只看單一數字或外觀。把型態、規格、使用方式與自己的生活情境一起看，會更容易找到順手的安排。",
    "",
    topic.bullets.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    "",
    "仙加味小老闆幫你整理。",
    "補養，是一種節奏。",
    "",
    CTA,
    "",
    TAGS,
  ].join("\n");
}

function imageUrl(topic) {
  return `${APP_ORIGIN}/social-assets/knowledge/${IMAGE_VERSION}/${topic.slug}.png`;
}

function localParts(timestamp) {
  const local = new Date(timestamp + TAIPEI_OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    date: local.getUTCDate(),
    day: local.getUTCDay(),
    hour: local.getUTCHours(),
  };
}

function taipeiSlotUtc(year, month, date) {
  return Date.UTC(year, month, date, 20, 0, 0) - TAIPEI_OFFSET_MS;
}

function nextScheduleSlots(count, nowMs = Date.now()) {
  const slots = [];
  const earliest = nowMs + 24 * 60 * 60 * 1000;
  let cursor = earliest;
  while (slots.length < count) {
    const parts = localParts(cursor);
    for (let offset = 0; offset < 14 && slots.length < count; offset += 1) {
      const candidateLocal = new Date(Date.UTC(parts.year, parts.month, parts.date + offset));
      const day = candidateLocal.getUTCDay();
      if (day !== 3 && day !== 5) continue;
      const candidate = taipeiSlotUtc(
        candidateLocal.getUTCFullYear(),
        candidateLocal.getUTCMonth(),
        candidateLocal.getUTCDate()
      );
      if (candidate < earliest) continue;
      if (!slots.includes(candidate)) slots.push(candidate);
    }
    cursor += 14 * 24 * 60 * 60 * 1000;
  }
  return slots.slice(0, count).map((value) => new Date(value).toISOString());
}

function draftId(topic) {
  return `official-mascot-v10-${String(topic.number).padStart(2, "0")}`;
}

function buildDraft(topic, scheduledAt, nowIso) {
  return {
    id: draftId(topic),
    campaignId: CAMPAIGN_ID,
    campaignVersion: VERSION,
    category: "小老闆知識",
    knowledgeTopic: topic.title,
    title: `小老闆知識 ${String(topic.number).padStart(2, "0")}｜${topic.title}`,
    imageUrl: imageUrl(topic),
    instagramCaption: instagramCaption(topic),
    facebookCaption: facebookCaption(topic),
    publishInstagram: true,
    publishFacebook: true,
    status: "draft",
    scheduledAt,
    result: {},
    lastError: "",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function rebuildOfficialSocialSchedule(readStore, writeStore, options = {}) {
  const nowMs = Number(options.nowMs || Date.now());
  const nowIso = new Date(nowMs).toISOString();
  const source = readStore();
  const posts = Array.isArray(source.posts) ? source.posts : [];
  const published = posts.filter((post) => post.status === "published");
  const publishedIds = new Set(published.map((post) => post.id));
  const existingCurrent = new Map(
    posts
      .filter((post) => post.campaignId === CAMPAIGN_ID && post.status !== "published")
      .map((post) => [post.id, post])
  );
  const slots = nextScheduleSlots(TOPICS.length, nowMs);
  const rebuilt = [];
  let inserted = 0;
  let updated = 0;

  for (const topic of TOPICS) {
    const id = draftId(topic);
    if (publishedIds.has(id)) continue;
    const desired = buildDraft(topic, slots[topic.number - 1], nowIso);
    const previous = existingCurrent.get(id);
    if (!previous) {
      rebuilt.push(desired);
      inserted += 1;
      continue;
    }
    const merged = {
      ...previous,
      ...desired,
      status: previous.status || "draft",
      scheduledAt: previous.scheduledAt || desired.scheduledAt,
      result: previous.result || {},
      lastError: previous.lastError || "",
      createdAt: previous.createdAt || desired.createdAt,
      updatedAt: nowIso,
    };
    rebuilt.push(merged);
    updated += 1;
  }

  const resultStore = {
    ...source,
    posts: [...published, ...rebuilt].slice(-500),
  };
  writeStore(resultStore);

  const removedUnpublished = posts.filter(
    (post) => post.status !== "published" && post.campaignId !== CAMPAIGN_ID
  ).length;
  const active = rebuilt.slice().sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  return {
    version: VERSION,
    campaignId: CAMPAIGN_ID,
    imageVersion: IMAGE_VERSION,
    preservedPublished: published.length,
    removedUnpublished,
    inserted,
    updated,
    pendingReview: active.filter((post) => post.status === "draft").length,
    activeTotal: active.length,
    firstAt: active[0]?.scheduledAt || "",
    lastAt: active.at(-1)?.scheduledAt || "",
    total: resultStore.posts.length,
    signature: crypto
      .createHash("sha1")
      .update(active.map((post) => `${post.id}|${post.title}|${post.imageUrl}`).join("\n"))
      .digest("hex")
      .slice(0, 12),
  };
}

module.exports = {
  VERSION,
  CAMPAIGN_ID,
  IMAGE_VERSION,
  TOPICS,
  instagramCaption,
  facebookCaption,
  imageUrl,
  nextScheduleSlots,
  rebuildOfficialSocialSchedule,
};
