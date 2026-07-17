"use strict";

const crypto = require("crypto");
const { CAMPAIGN_ID: MASCOT_CAMPAIGN_ID } = require("./social-official-rebuild");

const VERSION = "1.0.0";
const CAMPAIGN_ID = "xjw-product-brand-202607-v1";
const SITE_BASE = "https://ts15825868.github.io/xianjiawei/";
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const CTA = "想了解適合的型態、規格或購買方式，歡迎私訊或加入官方 LINE：@762jybnm。";
const TAGS = "#仙加味 #仙加味龜鹿 #龜鹿膏 #龜鹿飲 #龜鹿湯塊 #龜鹿膠 #鹿茸粉 #日常食補 #補養是一種節奏";

const TOPICS = [
  {
    number: 1,
    slug: "gao-intro",
    category: "產品介紹",
    image: "images/dm-final/01_guilu-gao-100g-dm.jpg?v=408.7",
    title: "龜鹿膏 100g｜固定日常的小罐安排",
    lead: "龜鹿膏把鹿角、龜板與枸杞、紅棗、黃耆、粉光蔘整理成方便取用的膏狀型態，適合想建立固定日常食補節奏的人。",
    bullets: ["100g小罐設計", "可直接取用或用熱水化開", "可依作息安排於早上或下午"],
  },
  {
    number: 2,
    slug: "gao-method",
    category: "使用方式",
    image: "images/products-v3/guilu-gao.jpg?v=408.7",
    title: "龜鹿膏怎麼吃？兩種方式都可以",
    lead: "有人喜歡直接取用，也有人習慣化成溫熱飲品。方式不用複雜，選自己能固定持續的做法就好。",
    bullets: ["每次可取1～2小匙", "可加入約100～300mL熱水化開", "開封後密封冷藏並使用乾淨湯匙"],
  },
  {
    number: 3,
    slug: "drink30-intro",
    category: "產品介紹",
    image: "images/dm-final/02_guilu-drink-30cc-dm.jpg?v=408.7",
    title: "龜鹿飲 30cc｜小瓶即飲，外出更順手",
    lead: "30cc玻璃小瓶，把龜鹿膏的成分方向整理成方便即飲的液態型態，適合外出、工作空檔或想簡單安排的人。",
    bullets: ["30cc玻璃小瓶", "開瓶即可飲用", "可依習慣溫熱後飲用"],
  },
  {
    number: 4,
    slug: "drink30-scene",
    category: "日常情境",
    image: "images/products-v3/guilu-drink-30.jpg?v=408.7",
    title: "忙碌時，也能保留自己的日常節奏",
    lead: "不是每天都有時間沖泡或準備。小瓶即飲的價值，就是讓外出、開會或工作空檔也能簡單安排。",
    bullets: ["體積小，方便攜帶", "不需另外量取份量", "開瓶後請儘速飲用完畢"],
  },
  {
    number: 5,
    slug: "drink180-intro",
    category: "產品介紹",
    image: "images/dm-final/03_guilu-drink-180cc-dm.jpg?v=408.7",
    title: "龜鹿飲 180cc｜一次安排較完整的即飲份量",
    lead: "180cc鋁袋同樣是方便即飲的液態型態，適合居家、工作空檔，或偏好一次飲用較完整份量的人。",
    bullets: ["180cc鋁袋包裝", "撕開即可飲用", "可依個人習慣溫熱後飲用"],
  },
  {
    number: 6,
    slug: "drink-size-compare",
    category: "差異比較",
    image: "images/products-v3/guilu-drink-180.jpg?v=408.7",
    title: "30cc與180cc，差別先看使用情境",
    lead: "兩種都是即飲型態，重點不是哪一種比較好，而是哪一種份量與包裝更符合你的生活安排。",
    bullets: ["30cc適合輕巧攜帶", "180cc適合一次完整飲用", "兩者開封後都應儘速飲用"],
  },
  {
    number: 7,
    slug: "tangkuai-intro",
    category: "產品介紹",
    image: "images/dm-final/05_guilu-tangkuai-75g-dm.jpg?v=408.7",
    title: "龜鹿湯塊 75g｜沖泡與燉湯都能安排",
    lead: "75g盒裝共有8塊，每塊約9.375g，適合熱水沖泡、保溫壺悶泡，也能加入家常湯品。",
    bullets: ["75g／盒，8塊裝", "每塊約9.375g", "原料為鹿角萃取物與龜板萃取物"],
  },
  {
    number: 8,
    slug: "tangkuai-hot-water",
    category: "使用方式",
    image: "images/products-v3/guilu-tangkuai.jpg?v=408.7",
    title: "一塊湯塊，怎麼用熱水安排？",
    lead: "想簡單一點，可以直接用熱水沖泡；想讓風味更均勻，也可以放進保溫壺悶泡。",
    bullets: ["取1塊龜鹿湯塊", "加入約300～500mL熱水", "依個人口味調整水量與悶泡時間"],
  },
  {
    number: 9,
    slug: "tangkuai-soup",
    category: "料理搭配",
    image: "images/dm-final/05_guilu-tangkuai-75g-dm.jpg?v=408.7",
    title: "龜鹿湯塊，也能回到日常餐桌",
    lead: "除了沖泡，龜鹿湯塊也可以加入雞湯、排骨湯等家常料理，依口味搭配紅棗、枸杞等食材。",
    bullets: ["適合雞湯或排骨湯", "可搭配紅棗、枸杞", "先少量嘗試，再依口味調整"],
  },
  {
    number: 10,
    slug: "jiao-intro",
    category: "產品介紹",
    image: "images/dm-final/06_guilu-jiao-600g-dm.jpg?v=408.7",
    title: "龜鹿膠 600g｜傳統一斤大規格",
    lead: "600g一斤裝共有32塊，每塊約18.75g，適合熟悉龜鹿產品、家庭固定安排或偏好大規格的人。",
    bullets: ["600g／盒，32塊裝", "每塊約18.75g", "可用熱水化開或加入湯品"],
  },
  {
    number: 11,
    slug: "jiao-tangkuai-compare",
    category: "差異比較",
    image: "images/products-v3/guilu-jiao.jpg?v=408.7",
    title: "龜鹿膠與龜鹿湯塊，原料相同差在哪？",
    lead: "兩者都是鹿角萃取物與龜板萃取物，主要差別在包裝、規格與每塊份量。",
    bullets: ["湯塊75g為8塊小盒裝", "龜鹿膠600g為32塊一斤裝", "依使用頻率與家庭需求選擇"],
  },
  {
    number: 12,
    slug: "luerong-intro",
    category: "產品介紹",
    image: "images/dm-final/04_luerong-fen-75g-dm.jpg?v=408.7",
    title: "鹿茸粉 75g｜單方粉狀，自行搭配更彈性",
    lead: "鹿茸粉為單方鹿茸，粉狀型態方便依個人飲食習慣調整份量與搭配方式。",
    bullets: ["75g／罐", "成分為鹿茸", "適合喜歡自行調飲與調整份量的人"],
  },
  {
    number: 13,
    slug: "luerong-drink",
    category: "使用方式",
    image: "images/products-v3/luerong-fen.jpg?v=408.7",
    title: "鹿茸粉不只加溫水，也能這樣搭配",
    lead: "粉狀型態的方便，在於可以依自己的飲食習慣安排，不必限定單一喝法。",
    bullets: ["可加入溫開水", "也可搭配牛奶或豆漿", "攪拌均勻後飲用，開封後密封保存"],
  },
  {
    number: 14,
    slug: "gao-drink-compare",
    category: "差異比較",
    image: "images/dm-final/01_guilu-gao-100g-dm.jpg?v=408.7",
    title: "龜鹿膏與龜鹿飲，怎麼選比較實際？",
    lead: "兩者成分方向相近，差別主要在型態與使用方式：一個適合固定取用，一個適合方便即飲。",
    bullets: ["膏：可自行取量或熱水化開", "飲：開封即可飲用", "可依在家與外出的情境搭配"],
  },
  {
    number: 15,
    slug: "full-series",
    category: "差異比較",
    image: "images/dm-final/05_guilu-tangkuai-75g-dm.jpg?v=408.7",
    title: "膏、飲、湯塊、膠、粉，一次看懂用途方向",
    lead: "選產品不用只看名稱，先看你想固定取用、方便即飲、沖泡燉湯、家庭大規格，還是自行調飲。",
    bullets: ["膏：固定日常", "飲：方便即飲", "湯塊與膠：沖泡燉湯；鹿茸粉：自行搭配"],
  },
  {
    number: 16,
    slug: "storage-guide",
    category: "常見問題",
    image: "images/products-v3/guilu-gao.jpg?v=408.7",
    title: "產品怎麼保存？先分開封前與開封後",
    lead: "不同型態的保存方式不完全相同，最準確的做法仍是依包裝標示處理。",
    bullets: ["未開封避免高溫與日光直射", "龜鹿膏開封後密封冷藏", "飲品開封後儘速飲用；粉類開封後密封"],
  },
  {
    number: 17,
    slug: "first-choice",
    category: "常見問題",
    image: "images/dm-final/02_guilu-drink-30cc-dm.jpg?v=408.7",
    title: "第一次接觸仙加味，先從哪一種開始？",
    lead: "先不用一次選很多，從自己最容易做到的方式開始，會比只看規格或別人的選擇更適合。",
    bullets: ["想固定安排可看龜鹿膏", "想方便即飲可看龜鹿飲", "喜歡沖泡、料理或自行調飲，可看湯塊與鹿茸粉"],
  },
  {
    number: 18,
    slug: "how-to-buy",
    category: "購買方式",
    image: "images/dm-final/06_guilu-jiao-600g-dm.jpg?v=408.7",
    title: "價格、優惠與配送，為什麼請先透過 LINE 確認？",
    lead: "不同產品、數量與配送方式可能有不同安排，先確認需求，才能提供正確的規格與購買資訊。",
    bullets: ["告訴我們想詢問的產品", "確認數量與配送方式", "官方 LINE：@762jybnm"],
  },
  {
    number: 19,
    slug: "family-arrangement",
    category: "日常情境",
    image: "images/products-v3/guilu-tangkuai.jpg?v=408.7",
    title: "自己使用與家庭安排，選擇可以不同",
    lead: "一個人外出可能在意攜帶方便，家庭固定使用則可能更在意份量、料理方式與保存空間。",
    bullets: ["個人外出可看小瓶即飲", "居家固定可看膏或湯塊", "家庭大規格可了解龜鹿膠"],
  },
  {
    number: 20,
    slug: "brand-rhythm",
    category: "品牌理念",
    image: "images/dm-final/04_luerong-fen-75g-dm.jpg?v=408.7",
    title: "補養，不是追求一次很多，而是找到自己的節奏",
    lead: "仙加味希望把傳統食補整理成更容易理解、選擇與安排的日常方式。",
    bullets: ["看懂型態與規格", "選擇自己做得到的方法", "依產品標示與個人生活安排"],
  },
];

function imageUrl(topic) {
  return new URL(topic.image, SITE_BASE).toString();
}

function instagramCaption(topic) {
  return [
    topic.title,
    "",
    topic.lead,
    "",
    topic.bullets.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    "",
    "補養，是一種節奏。",
    "",
    CTA,
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
    topic.bullets.map((item) => `✓ ${item}`).join("\n"),
    "",
    "產品型態與使用方式不同，請依包裝標示與自己的生活情境安排。",
    "",
    CTA,
    "",
    TAGS,
  ].join("\n");
}

function localParts(timestamp) {
  const local = new Date(timestamp + TAIPEI_OFFSET_MS);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), date: local.getUTCDate() };
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
      const local = new Date(Date.UTC(parts.year, parts.month, parts.date + offset));
      const day = local.getUTCDay();
      if (day !== 0 && day !== 2) continue;
      const candidate = taipeiSlotUtc(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
      if (candidate < earliest || slots.includes(candidate)) continue;
      slots.push(candidate);
    }
    cursor += 14 * 24 * 60 * 60 * 1000;
  }
  return slots.slice(0, count).map((value) => new Date(value).toISOString());
}

function draftId(topic) {
  return `approved-product-brand-${String(topic.number).padStart(2, "0")}`;
}

function buildDraft(topic, scheduledAt, nowIso) {
  return {
    id: draftId(topic),
    campaignId: CAMPAIGN_ID,
    campaignVersion: VERSION,
    category: topic.category,
    knowledgeTopic: topic.title,
    title: `產品與品牌 ${String(topic.number).padStart(2, "0")}｜${topic.title}`,
    imageUrl: imageUrl(topic),
    sourceImageFile: topic.image,
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

function uniquePosts(posts) {
  const seen = new Set();
  return posts.filter((post) => {
    if (!post?.id || seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}

function rebuildProductContentSchedule(readStore, writeStore, options = {}) {
  const nowMs = Number(options.nowMs || Date.now());
  const nowIso = new Date(nowMs).toISOString();
  const source = readStore();
  const currentPosts = Array.isArray(source.posts) ? source.posts : [];
  const previousPosts = Array.isArray(options.previousPosts)
    ? options.previousPosts
    : currentPosts.filter((post) => post.campaignId === CAMPAIGN_ID);

  const published = currentPosts.filter((post) => post.status === "published");
  const mascotActive = currentPosts.filter(
    (post) => post.campaignId === MASCOT_CAMPAIGN_ID && post.status !== "published"
  );
  const publishedIds = new Set(published.map((post) => post.id));
  const previousById = new Map(previousPosts.map((post) => [post.id, post]));
  const slots = nextScheduleSlots(TOPICS.length, nowMs);
  const rebuilt = [];
  let inserted = 0;
  let updated = 0;

  for (const [index, topic] of TOPICS.entries()) {
    const id = draftId(topic);
    if (publishedIds.has(id)) continue;
    const desired = buildDraft(topic, slots[index], nowIso);
    const previous = previousById.get(id);
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

  const posts = uniquePosts([...published, ...mascotActive, ...rebuilt]).slice(-500);
  writeStore({ ...source, posts });
  const active = rebuilt.slice().sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  return {
    version: VERSION,
    campaignId: CAMPAIGN_ID,
    inserted,
    updated,
    pendingReview: active.filter((post) => post.status === "draft").length,
    activeTotal: active.length,
    preservedPublished: published.length,
    preservedMascot: mascotActive.length,
    firstAt: active[0]?.scheduledAt || "",
    lastAt: active.at(-1)?.scheduledAt || "",
    total: posts.length,
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
  MASCOT_CAMPAIGN_ID,
  TOPICS,
  imageUrl,
  instagramCaption,
  facebookCaption,
  nextScheduleSlots,
  rebuildProductContentSchedule,
};
