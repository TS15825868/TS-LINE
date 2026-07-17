"use strict";

const crypto = require("crypto");

const VERSION = "2.0.0";
const CAMPAIGN_ID = "xjw-approved-zip-202607-v1";
const IMAGE_VERSION = "approved-original-v1";
const ASSET_STORE_KEY = "approvedMascotAssets";
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const CTA = "有產品、保存或使用方式的問題，可私訊或加入官方 LINE：@762jybnm。";
const TAGS = "#仙加味 #仙加味小老闆 #龜鹿 #漢方生活 #日常補養 #補養是一種節奏";

const TOPICS = [
  {
    number: 1,
    slug: "form-first",
    file: "A307B1B9-2414-45B1-B839-4A1FC90B9B74.PNG",
    title: "先分型態，再看怎麼安排",
    bullets: ["膏、飲、湯塊、粉是不同型態", "先看哪一種適合你的日常", "再確認規格與使用方式"],
    lead: "同樣是龜鹿系列，不同型態對應的是不同的使用情境。先把日常需求想清楚，選擇會更容易。",
  },
  {
    number: 2,
    slug: "serving-and-total",
    file: "790D6C1D-B3A2-4D65-8C3A-F60494D63437.PNG",
    title: "先看每次份量，再看整體規格",
    bullets: ["每次份量是一次安排的量", "每盒、每罐是完整內容量", "先看單次，再看整體"],
    lead: "比較規格時，單次使用量與整盒內容量是兩件事。先分清楚，才不會只看大數字。",
  },
  {
    number: 3,
    slug: "morning-rhythm",
    file: "9679EC48-F3A3-43E5-8261-08CFEA97F9A1.PNG",
    title: "早上安排，重點是固定",
    bullets: ["選自己不容易忘的時間", "依產品標示安排份量", "固定後更容易持續"],
    lead: "早上的安排不必複雜，選一個自己記得住、做得到的時間，比臨時想到才使用更順手。",
  },
  {
    number: 4,
    slug: "afternoon-rhythm",
    file: "A92B951E-78B9-4153-882E-185EA91FE7ED.PNG",
    title: "下午補養，也是一種安排",
    bullets: ["可配合午餐或工作休息時間", "依生活作息選擇", "找到適合自己的固定時段"],
    lead: "不習慣早上安排，也可以把下午休息時間納入日常節奏，重點是符合自己的作息。",
  },
  {
    number: 5,
    slug: "busy-home-days",
    file: "F6985971-E131-42EF-BCA8-4E434F8CC345.PNG",
    title: "忙碌日與在家日，方式可不同",
    bullets: ["外出可看即飲或小包裝", "在家可看沖泡或料理", "不必每天使用同一種型態"],
    lead: "生活情境每天都可能不同，外出與在家可以選擇不同型態，不必勉強自己只用一種方式。",
  },
  {
    number: 6,
    slug: "share-with-family",
    file: "8C1EAF67-9007-41A0-8729-D0B4631416BE.PNG",
    title: "分享給家人，先看使用方式",
    bullets: ["先確認對方習慣的型態", "一起說明每次份量", "保存方式也要交代清楚"],
    lead: "把產品分享給家人時，除了交給對方，也要把份量、使用與保存方式一起說清楚。",
  },
  {
    number: 7,
    slug: "seal-and-label",
    file: "581D7AAC-AB40-4BA4-81EF-07DA66AC3BC7.PNG",
    title: "收到商品，先看封口與標示",
    bullets: ["確認外盒與封口完整", "查看品名與規格", "有疑問先拍照保留"],
    lead: "收到商品先別急著拆封，先確認外觀、封口、品名與規格，後續保存與使用也更安心。",
  },
  {
    number: 8,
    slug: "storage-label",
    file: "CBDD60D2-C5BE-449B-95DF-469122F3DB08.PNG",
    title: "保存方式，依包裝說明最準",
    bullets: ["未開封與開封後可能不同", "放陰涼處或依標示保存", "取用後記得密封"],
    lead: "不同型態、不同包裝的保存條件可能不同，最可靠的做法是依產品包裝標示處理。",
  },
  {
    number: 9,
    slug: "hot-water-method",
    file: "9DF04070-FD41-4B4E-81EE-1D277DFD202F.PNG",
    title: "想搭配熱水，先看沖泡方式",
    bullets: ["先確認產品是否適合沖泡", "再看建議水量與溫度", "依口感慢慢調整"],
    lead: "不是每一種型態都用同一種沖泡方式。先確認產品說明，再依水量與口感逐步調整。",
  },
  {
    number: 10,
    slug: "clear-features",
    file: "52C83E67-1BAD-4A85-94B5-E016887607F6.PNG",
    title: "講清楚特色，比拼湊更重要",
    bullets: ["重點放在自己的原料與規格", "清楚說明使用方式", "讓消費者依需求判斷"],
    lead: "介紹產品不必靠比較或貶低別人，把自己的內容、規格與使用方式講清楚，資訊才真正有幫助。",
  },
  {
    number: 21,
    slug: "understand-forms",
    file: "89C17637-77B2-4F14-8629-2136A9A0BA2E.PNG",
    title: "看懂產品型態，安排更順手",
    bullets: ["膏與粉可自行取用", "飲品可直接安排", "湯塊適合沖泡或料理"],
    lead: "先看產品是膏、飲、湯塊還是粉，再安排使用情境，會比只看名稱更容易理解。",
  },
  {
    number: 22,
    slug: "single-compound",
    file: "1653AFD1-28A0-43A6-9CD2-E37E196977A7.PNG",
    title: "看懂單方與複方，選擇更清楚",
    bullets: ["單方原料較單純", "複方包含多種原料搭配", "先看成分表再做選擇"],
    lead: "單方與複方是內容組成方式的差別，選購前先閱讀成分標示，再依自己的需求判斷。",
  },
  {
    number: 23,
    slug: "small-large-pack",
    file: "3F187045-74E9-45AC-B3DD-1F42FA35438D.PNG",
    title: "小包裝與大包裝，各有方便",
    bullets: ["小包裝適合攜帶與分次", "大包裝適合固定居家安排", "先看使用情境，不只看大小"],
    lead: "包裝大小沒有絕對好壞，外出攜帶、居家固定使用與保存空間，都是選擇時要一起看的條件。",
  },
  {
    number: 24,
    slug: "choose-by-place",
    file: "E3DF57ED-1A6E-4A93-A187-BFCACFCE0B74.PNG",
    title: "先想在哪裡使用，再做選擇",
    bullets: ["在家可看日常節奏", "外出可看攜帶方便", "餐桌搭配可看料理型態"],
    lead: "先想像實際使用的地方：家中、工作場所、外出或餐桌，再挑選適合的型態會更實際。",
  },
  {
    number: 25,
    slug: "flavour-method",
    file: "14A289E2-99BA-457F-9A21-464C3A2C83AD.PNG",
    title: "風味會受搭配方式影響",
    bullets: ["原料組合會影響風味", "沖泡、溫熱、燉煮口感不同", "先看使用方式再品嚐"],
    lead: "同一類產品用不同方式安排，入口的濃淡與風味感受也可能不同，這是正常的呈現差異。",
  },
  {
    number: 26,
    slug: "different-convenience",
    file: "CA5CF41E-414B-4840-A259-7A3C06C082A1.PNG",
    title: "同樣是方便，不一定是同一種方便",
    bullets: ["有的是開封方便", "有的是料理安排方便", "有的是保存與攜帶方便"],
    lead: "所謂方便，可能是打開就能使用、方便料理，也可能是好保存或好攜帶，先確認自己在意哪一種。",
  },
  {
    number: 27,
    slug: "similar-names",
    file: "586D7D03-5224-48B1-B6C2-2F74B6D5EB53.PNG",
    title: "名稱相近，也要看完整標示",
    bullets: ["名稱接近，規格可能不同", "型態不同，使用方式也可能不同", "比較前先把標示看完整"],
    lead: "產品名稱看起來相近，不代表內容、規格與使用方式完全相同，完整標示才是比較基礎。",
  },
  {
    number: 28,
    slug: "three-questions",
    file: "6A5717B1-D9BC-40A6-858C-5FDD8464AF53.PNG",
    title: "選購前，先問自己三個問題",
    bullets: ["想怎麼安排", "想在哪裡使用", "想要哪一種方便"],
    lead: "選購前先把使用方式、地點與便利需求想清楚，能更快排除不適合自己生活的選項。",
  },
  {
    number: 29,
    slug: "easy-first",
    file: "FAB540D0-8BB7-4272-97A7-2BB7C82C964D.PNG",
    title: "初次安排，先從順手開始",
    bullets: ["先選自己容易做到的方式", "順手後再固定日常節奏", "不求一次很多，重點是持續"],
    lead: "第一次接觸不用把流程弄得複雜，先從容易做到的方式開始，再慢慢形成自己的日常節奏。",
  },
  {
    number: 30,
    slug: "clear-information",
    file: "84E5C7EC-593B-4086-B1F6-1B4EE09A01AB.PNG",
    title: "資訊寫清楚，選購更安心",
    bullets: ["規格清楚較容易比較", "成分清楚較容易理解", "保存與使用說明也要完整"],
    lead: "完整資訊不是把文字堆得很多，而是讓規格、成分、保存與使用方式都能被清楚理解。",
  },
];

function instagramCaption(topic) {
  return [
    topic.title,
    "",
    topic.lead,
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
    topic.lead,
    "",
    topic.bullets.map((item, index) => `✓ ${item}`).join("\n"),
    "",
    "先把資訊看清楚，再依自己的生活情境選擇，會比只看單一數字或外觀更實際。",
    "",
    CTA,
    "",
    TAGS,
  ].join("\n");
}

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
      if (candidate < earliest || slots.includes(candidate)) continue;
      slots.push(candidate);
    }
    cursor += 14 * 24 * 60 * 60 * 1000;
  }
  return slots.slice(0, count).map((value) => new Date(value).toISOString());
}

function assetFiles(store) {
  const assets = store?.[ASSET_STORE_KEY];
  if (!assets || assets.campaignId !== CAMPAIGN_ID || typeof assets.files !== "object") return {};
  return assets.files;
}

function imageUrl(topic, store) {
  const files = assetFiles(store);
  return String(files[topic.file] || files[topic.slug] || "").trim();
}

function draftId(topic) {
  return `approved-mascot-original-${String(topic.number).padStart(2, "0")}`;
}

function buildDraft(topic, scheduledAt, nowIso, store) {
  return {
    id: draftId(topic),
    campaignId: CAMPAIGN_ID,
    campaignVersion: VERSION,
    category: "小老闆知識",
    knowledgeTopic: topic.title,
    title: `小老闆知識 ${String(topic.number).padStart(2, "0")}｜${topic.title}`,
    imageUrl: imageUrl(topic, store),
    sourceImageFile: topic.file,
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
  const files = assetFiles(source);
  const missingFiles = TOPICS.filter((topic) => !/^https:\/\//i.test(String(files[topic.file] || files[topic.slug] || "")))
    .map((topic) => topic.file);

  if (missingFiles.length) {
    const resultStore = { ...source, posts: published.slice(-500) };
    writeStore(resultStore);
    return {
      version: VERSION,
      campaignId: CAMPAIGN_ID,
      imageVersion: IMAGE_VERSION,
      awaitingApprovedZip: true,
      missingFiles,
      preservedPublished: published.length,
      removedUnpublished: posts.length - published.length,
      inserted: 0,
      updated: 0,
      pendingReview: 0,
      activeTotal: 0,
      firstAt: "",
      lastAt: "",
      total: resultStore.posts.length,
      signature: "awaiting-approved-zip",
    };
  }

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

  for (const [index, topic] of TOPICS.entries()) {
    const id = draftId(topic);
    if (publishedIds.has(id)) continue;
    const desired = buildDraft(topic, slots[index], nowIso, source);
    const previous = existingCurrent.get(id);
    if (!previous) {
      rebuilt.push(desired);
      inserted += 1;
      continue;
    }
    rebuilt.push({
      ...previous,
      ...desired,
      status: previous.status || "draft",
      scheduledAt: previous.scheduledAt || desired.scheduledAt,
      result: previous.result || {},
      lastError: previous.lastError || "",
      createdAt: previous.createdAt || desired.createdAt,
      updatedAt: nowIso,
    });
    updated += 1;
  }

  const resultStore = { ...source, posts: [...published, ...rebuilt].slice(-500) };
  writeStore(resultStore);
  const active = rebuilt.slice().sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  return {
    version: VERSION,
    campaignId: CAMPAIGN_ID,
    imageVersion: IMAGE_VERSION,
    awaitingApprovedZip: false,
    missingFiles: [],
    preservedPublished: published.length,
    removedUnpublished: posts.filter((post) => post.status !== "published" && post.campaignId !== CAMPAIGN_ID).length,
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
  ASSET_STORE_KEY,
  TOPICS,
  instagramCaption,
  facebookCaption,
  imageUrl,
  nextScheduleSlots,
  rebuildOfficialSocialSchedule,
};