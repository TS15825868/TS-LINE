"use strict";

require("./knowledge-card-extension");

const library = require("./social-content-library");
const { weeklySchedule } = require("./social-draft-library-weekly");

const VERSION = "1.0.0";
const CAMPAIGN_ID = "xjw-knowledge-202607-v2";
const IMAGE_PATH_VERSION = "v9";
const APP = "https://ts-line.onrender.com";
const TAGS = "#仙加味 #仙加味小老闆 #龜鹿 #漢方生活 #日常補養 #補養是一種節奏";
const CTA = "有產品、保存或使用方式的問題，可私訊或加入官方 LINE：@762jybnm。";

const ROWS = [
  [
    "opening-date",
    "開封日期與日常管理",
    "小老闆知識 21｜開封後記下日期管理更清楚",
    "產品開封後，為什麼建議把日期記下來？",
    "記下開封日期，方便掌握目前使用進度，也能配合包裝上的保存方式與有效日期。這不是改變期限，而是讓日常管理更清楚。",
    "產品開封後，可在外盒或自己的紀錄中寫下日期，方便掌握使用進度，並配合包裝標示的保存方式與有效日期。開封紀錄不會改變產品期限，只是讓家中管理更清楚。",
    `${TAGS} #開封日期 #日常管理`,
  ],
  [
    "spoon-size",
    "湯匙大小與實際份量",
    "小老闆知識 22｜一匙不是固定公克",
    "同樣寫一匙，為什麼每個人取出的量可能不同？",
    "不同湯匙的大小與深度不同，一匙不等於固定公克數。安排時先看包裝建議，再使用固定、乾淨的工具會比較清楚。",
    "家中的茶匙、湯匙或量匙大小並不完全相同，因此一匙不能直接當成固定重量。可先參考產品包裝建議，再固定使用同一支乾淨、乾燥的工具，日常份量會比較容易掌握。",
    `${TAGS} #份量安排 #取用工具`,
  ],
  [
    "family-portions",
    "家人共用先分清每次份量",
    "小老闆知識 23｜家人一起使用先分清份量",
    "家人一起使用同一項產品，怎麼安排比較清楚？",
    "先確認每個人平常怎麼安排，再用乾淨、乾燥的工具分別取用。不要因為多人共用，就把每次份量混在一起計算。",
    "家人共用同一項產品時，可先確認每個人的日常安排與每次份量，再分別使用乾淨、乾燥的工具取用。把每人每次的份量分清楚，比只看全家一天用了多少更容易管理。",
    `${TAGS} #家人共用 #份量管理`,
  ],
  [
    "original-packaging",
    "外出攜帶保留原包裝資訊",
    "小老闆知識 24｜外出攜帶盡量保留原包裝",
    "外出攜帶時，為什麼保留原包裝比較好？",
    "原包裝保留了產品名稱、規格、使用與保存資訊，也比較不容易和其他食品混淆。攜帶前再確認封口完整。",
    "外出攜帶時，盡量保留產品原包裝或完整標示，方便隨時查看品名、規格、使用方式與保存提醒，也能降低和其他食品混淆的機會。出門前再確認封口是否完整。",
    `${TAGS} #外出攜帶 #產品標示`,
  ],
  [
    "simple-soup-base",
    "料理搭配先從單純湯底開始",
    "小老闆知識 25｜第一次料理先從單純湯底開始",
    "第一次用龜鹿湯塊搭配料理，從哪種湯底開始比較容易？",
    "可以先從自己熟悉的雞湯、排骨湯或簡單家常湯底開始，完成後再調整濃淡，比一次加入很多配料更容易掌握。",
    "第一次把龜鹿湯塊或龜鹿膠放進料理時，可先選擇平常熟悉的雞湯、排骨湯或簡單家常湯底。先完成基本湯品，再依家中口味調整濃淡與其他食材，會比較容易找到喜歡的比例。",
    `${TAGS} #料理搭配 #家常湯品`,
  ],
  [
    "gift-instructions",
    "分享產品時附上使用保存說明",
    "小老闆知識 26｜分享給家人朋友別忘了附上說明",
    "送給家人朋友時，除了產品還可以一起附上什麼？",
    "可一起說明產品名稱、規格、使用方式與保存方法，讓對方收到後知道怎麼安排，不必只靠外觀猜測。",
    "把產品分享給家人朋友時，除了確認包裝完整，也可一起告知產品名稱、規格、日常使用方式與保存方法。資訊說清楚，對方收到後會更容易依自己的生活習慣安排。",
    `${TAGS} #分享提醒 #使用說明`,
  ],
  [
    "no-pour-back",
    "取出或沖泡後不要倒回原容器",
    "小老闆知識 27｜取出後不要再倒回原容器",
    "已經取出或沖泡過的內容，可以再倒回原容器嗎？",
    "已取出、接觸過水或其他食物的內容，不建議再倒回原容器。取多少就使用多少，能減少水氣與其他內容混入。",
    "產品一旦取出，或已經接觸過水、飲品與其他食材，就不建議再倒回原容器。每次先取需要的份量，剩下的原產品立即密封並依標示保存，管理會比較單純。",
    `${TAGS} #取用方式 #保存細節`,
  ],
  [
    "repack-label",
    "分裝容器標示品名日期與保存方式",
    "小老闆知識 28｜需要分裝記得標示三項資訊",
    "需要分裝時，容器上至少要標示哪些資訊？",
    "建議寫清楚產品名稱、分裝日期與保存方式，並保留原包裝。不要只靠容器外觀記憶內容。",
    "確實需要分裝時，容器上至少應寫清楚產品名稱、分裝日期與保存方式，原包裝也先保留。這樣家中其他人不容易拿錯，後續需要確認資訊時也有依據。",
    `${TAGS} #分裝提醒 #產品管理`,
  ],
  [
    "first-in-first-out",
    "同款產品先使用已開封包裝",
    "小老闆知識 29｜同款產品先開先用較清楚",
    "家裡有同款產品，先開哪一個比較好？",
    "通常先使用已開封的包裝，未開封品則依標示妥善保存；同時確認有效日期，避免同時開太多。",
    "家中有同款產品時，可先把已開封的包裝使用完，再開新的；未開封品依包裝標示妥善保存，並確認有效日期。避免同時開太多包裝，日常管理會比較清楚。",
    `${TAGS} #先開先用 #保存管理`,
  ],
  [
    "personal-notes",
    "記錄自己順手的沖泡方式",
    "小老闆知識 30｜記下自己的沖泡方式",
    "怎麼找到自己最順手的沖泡方式？",
    "可以記下習慣的水量、飲用溫度與安排時段。下次照同樣方式準備，再慢慢微調，比每次重新猜測更方便。",
    "找到順手的方式後，可簡單記錄使用的水量、飲用溫度與安排時段。下次先照同樣方式準備，再依當天口感微調，會比每次從頭猜測更容易維持日常節奏。",
    `${TAGS} #沖泡紀錄 #日常節奏`,
  ],
];

function image(slug) {
  return `${APP}/social-assets/knowledge/${IMAGE_PATH_VERSION}/${slug}.png`;
}

function ig(headline, body, tags) {
  return [headline, "", body, "", "仙加味小老闆幫你整理", "補養，是一種節奏。", "", tags || TAGS].join("\n");
}

function fb(headline, body, tags) {
  return [headline, "", body, "", "仙加味小老闆幫你整理", "補養，是一種節奏。", "", CTA, "", tags || TAGS].join("\n");
}

const EXTRA_KNOWLEDGE = ROWS.map((row, index) => {
  const [slug, topic, title, headline, igBody, fbBody, tags] = row;
  return {
    campaignId: CAMPAIGN_ID,
    campaignKey: `${CAMPAIGN_ID}-${String(index + 1).padStart(2, "0")}`,
    campaignDay: index + 21,
    knowledgeTopic: topic,
    title,
    imageUrl: image(slug),
    instagramCaption: ig(headline, igBody, tags),
    facebookCaption: fb(headline, fbBody, tags),
    publishInstagram: true,
    publishFacebook: true,
    scheduledAt: weeklySchedule(library.POSTS.length + index),
  };
});

function fingerprint(post) {
  return library.fingerprint(post);
}

function seedExtraSocialKnowledge(readStore, writeStore) {
  const store = readStore();
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  const byKey = new Map(store.posts.map((post) => [post.campaignKey, post]));
  const fingerprints = new Set(store.posts.map(fingerprint).filter((value) => value.length > 80));
  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;
  let skippedDuplicate = 0;
  let preserved = 0;

  for (const item of EXTRA_KNOWLEDGE) {
    const existing = byKey.get(item.campaignKey);
    if (!existing) {
      const fp = fingerprint(item);
      if (fingerprints.has(fp)) {
        skippedDuplicate += 1;
        continue;
      }
      store.posts.push({
        id: `post-${item.campaignKey}`,
        ...item,
        status: "draft",
        result: {},
        platformStatus: { instagram: "待處理", facebook: "待處理" },
        lastError: "",
        createdAt: now,
        updatedAt: now,
      });
      fingerprints.add(fp);
      added += 1;
      continue;
    }

    if (["published", "cancelled", "failed", "partial", "publishing"].includes(existing.status)) {
      preserved += 1;
      continue;
    }

    Object.assign(existing, {
      campaignId: item.campaignId,
      campaignDay: item.campaignDay,
      knowledgeTopic: item.knowledgeTopic,
      title: item.title,
      imageUrl: item.imageUrl,
      instagramCaption: item.instagramCaption,
      facebookCaption: item.facebookCaption,
      scheduledAt: item.scheduledAt,
      publishInstagram: true,
      publishFacebook: true,
      updatedAt: now,
    });
    updated += 1;
  }

  if (added || updated) writeStore(store);
  return {
    version: VERSION,
    campaignId: CAMPAIGN_ID,
    added,
    updated,
    skippedDuplicate,
    preserved,
    total: EXTRA_KNOWLEDGE.length,
    firstAt: EXTRA_KNOWLEDGE[0]?.scheduledAt,
    lastAt: EXTRA_KNOWLEDGE.at(-1)?.scheduledAt,
  };
}

if (!library.__xjwKnowledgeExtensionWrapped) {
  const baseSeed = library.seedSocialContentLibrary;
  library.seedSocialContentLibrary = function seedSocialContentLibraryWithExtension(readStore, writeStore) {
    const base = baseSeed(readStore, writeStore);
    const extra = seedExtraSocialKnowledge(readStore, writeStore);
    return {
      ...base,
      extraCampaignId: extra.campaignId,
      extraAdded: extra.added,
      extraUpdated: extra.updated,
      extraSkippedDuplicate: extra.skippedDuplicate,
      extraPreserved: extra.preserved,
      total: base.total + extra.total,
      knowledgeTotal: base.knowledgeTotal + extra.total,
      lastAt: extra.lastAt || base.lastAt,
    };
  };
  Object.defineProperty(library, "__xjwKnowledgeExtensionWrapped", {
    value: true,
    enumerable: false,
  });
}

module.exports = {
  VERSION,
  CAMPAIGN_ID,
  IMAGE_PATH_VERSION,
  ROWS,
  EXTRA_KNOWLEDGE,
  seedExtraSocialKnowledge,
};
