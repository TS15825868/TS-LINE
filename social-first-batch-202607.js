"use strict";

const Module = require("module");

const VERSION = "1.0.0";
const CAMPAIGN_ID = "xjw-social-first-batch-202607-v1";
const OLD_CAMPAIGN_ID = "xjw-approved-zip-202607-v1";
const RAW_BASE = "https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/social/first-batch";

const POSTS = [
  {
    id: "first-batch-other-choose-form-20260724",
    sequenceRole: "product",
    category: "產品選擇",
    title: "依照自己的作息，選擇適合的日常型態",
    scheduledAt: "2026-07-24T12:00:00.000Z",
    image: "other-choose-form-2026-07-24.jpg",
    instagramCaption: [
      "仙加味的不同產品型態，適合不同的生活安排。",
      "",
      "想慢慢依日常節奏使用，可以先了解龜鹿膏；需要方便攜帶，可看看龜鹿飲；偏好熱水沖泡，可了解龜鹿湯塊或龜鹿膠；鹿茸粉則可依個人習慣加入飲品。",
      "",
      "先看自己的作息與使用情境，再選順手的方式。",
      "補養，是一種節奏。",
      "",
      "#仙加味 #仙加味小老闆 #產品怎麼選 #日常型態 #漢方生活",
    ].join("\n"),
    facebookCaption: [
      "產品不一定要從『哪一款最好』開始選，也可以先從自己的作息與使用情境出發。",
      "",
      "龜鹿膏適合依日常節奏取用；龜鹿飲方便攜帶；龜鹿湯塊與龜鹿膠可用熱水沖泡；鹿茸粉可依習慣加入溫開水、牛奶、豆漿或其他飲品。",
      "",
      "先看懂型態，再慢慢選擇自己順手的方式。",
      "補養，是一種節奏。",
      "",
      "#仙加味 #產品怎麼選 #漢方生活",
    ].join("\n"),
  },
  {
    id: "first-batch-care-work-rest-20260729",
    sequenceRole: "care",
    category: "日常關心",
    title: "工作再忙，也別忘了休息一下",
    scheduledAt: "2026-07-29T02:00:00.000Z",
    image: "care-work-rest-2026-07-29.jpg",
    instagramCaption: [
      "工作一忙，很容易連喝水和休息都忘了。",
      "",
      "久坐一段時間可以起身伸展，手邊放杯水，忙碌之間也替自己留一點喘息時間。",
      "",
      "把日常節奏放穩，慢慢來也很好。",
      "",
      "#仙加味 #仙加味小老闆 #日常關心 #工作日常 #記得休息",
    ].join("\n"),
    facebookCaption: [
      "工作再忙，也別忘了替自己留一點休息時間。",
      "",
      "久坐後起身伸展、記得補充水分，讓忙碌的一天多一點從容。照顧日常，不一定要一次改很多，從一個小動作開始就很好。",
      "",
      "#仙加味 #日常關心 #記得休息",
    ].join("\n"),
  },
  {
    id: "first-batch-other-hot-drink-20260731",
    sequenceRole: "product",
    category: "使用方式",
    title: "想喝熱熱的，記得先化開再調整溫度",
    scheduledAt: "2026-07-31T12:00:00.000Z",
    image: "other-hot-drink-2026-07-31.jpg",
    instagramCaption: [
      "想安排一杯熱飲，步驟可以很簡單。",
      "",
      "龜鹿膏、龜鹿湯塊或龜鹿膠，請先依產品標示使用熱水化開，再調整到適口溫度後慢慢飲用。",
      "",
      "簡單順手的日常方式，比較容易持續。",
      "",
      "#仙加味 #使用小提醒 #熱飲方式 #日常安排",
    ].join("\n"),
    facebookCaption: [
      "想喝熱熱的時候，記得先用熱水化開，再調整到適口溫度。",
      "",
      "龜鹿膏、龜鹿湯塊與龜鹿膠的實際水量與使用方式，仍以產品標示及個人飲用習慣為準。步驟安排得簡單順手，也更容易融入日常。",
      "",
      "#仙加味 #使用小提醒 #熱飲方式",
    ].join("\n"),
  },
  {
    id: "first-batch-care-family-20260805",
    sequenceRole: "care",
    category: "日常關心",
    title: "照顧自己，也別忘了關心家人",
    scheduledAt: "2026-08-05T02:00:00.000Z",
    image: "care-family-2026-08-05.jpg",
    instagramCaption: [
      "一句問候、一起吃頓飯，都是日常裡很溫柔的陪伴。",
      "",
      "照顧自己的同時，也別忘了關心身邊的人。把關心放進生活，不需要很複雜。",
      "",
      "陪伴，往往就是最溫柔的照顧。",
      "",
      "#仙加味 #仙加味小老闆 #日常關心 #家人陪伴 #溫暖日常",
    ].join("\n"),
    facebookCaption: [
      "有時候，一句簡單的問候，就很有溫度。",
      "",
      "一起吃飯、一起休息，或只是問問今天過得好不好，都是生活裡珍貴的陪伴。照顧自己，也別忘了關心家人。",
      "",
      "#仙加味 #日常關心 #家人陪伴",
    ].join("\n"),
  },
  {
    id: "first-batch-other-storage-20260807",
    sequenceRole: "product",
    category: "保存方式",
    title: "開封後與平時保存，記得放在適合的地方",
    scheduledAt: "2026-08-07T12:00:00.000Z",
    image: "other-storage-2026-08-07.jpg",
    instagramCaption: [
      "保存方式看清楚，日常使用更安心。",
      "",
      "龜鹿膏開罐後需冷藏；龜鹿湯塊與龜鹿膠可常溫置於陰涼處，或保存於 5°C 以下冷藏；鹿茸粉開封後請密封保存並儘早食用完畢。",
      "",
      "實際仍以包裝標示為準。",
      "",
      "#仙加味 #保存小提醒 #產品標示 #日常使用",
    ].join("\n"),
    facebookCaption: [
      "產品收到後，除了看品名與規格，也別忘了確認保存方式。",
      "",
      "龜鹿膏開罐後需冷藏；龜鹿湯塊與龜鹿膠可置於陰涼處，或保存於 5°C 以下冷藏；鹿茸粉開封後請密封保存並儘早食用完畢。實際保存方式請以包裝標示為準。",
      "",
      "#仙加味 #保存小提醒 #產品標示",
    ].join("\n"),
  },
  {
    id: "first-batch-care-temperature-gap-20260812",
    sequenceRole: "care",
    category: "氣候關心",
    title: "早晚溫差大，出門多帶一件薄外套",
    scheduledAt: "2026-08-12T02:00:00.000Z",
    image: "care-temperature-gap-2026-08-12.jpg",
    instagramCaption: [
      "早晚、室內外溫差明顯時，出門可以多帶一件薄外套。",
      "",
      "忙碌的一天也記得留點休息時間，依當下溫度調整穿著，讓日常更從容。",
      "",
      "慢慢照顧自己，日常更安心。",
      "",
      "#仙加味 #日常關心 #溫差提醒 #照顧自己",
    ].join("\n"),
    facebookCaption: [
      "最近若遇到早晚或室內外溫差較大，出門可以多帶一件薄外套。",
      "",
      "依當下感受調整穿著，忙碌中也記得留點休息時間。小小的準備，就能讓日常安排更從容。",
      "",
      "#仙加味 #溫差提醒 #日常關心",
    ].join("\n"),
  },
  {
    id: "first-batch-other-warm-meal-20260814",
    sequenceRole: "product",
    category: "生活情境",
    title: "想吃得暖一點，日常也可以慢慢安排",
    scheduledAt: "2026-08-14T12:00:00.000Z",
    image: "other-warm-meal-2026-08-14.jpg",
    instagramCaption: [
      "想吃得暖一點，不一定要準備得很複雜。",
      "",
      "一碗熱湯、簡單的家常菜，再替自己留一點慢慢吃飯的時間，就是很踏實的日常。",
      "",
      "把生活過得穩穩的，也是照顧自己的方式。",
      "",
      "#仙加味 #日常分享 #家常餐桌 #生活節奏",
    ].join("\n"),
    facebookCaption: [
      "忙碌時，簡單準備一頓熱熱的家常餐，也很好。",
      "",
      "不用追求複雜，讓自己坐下來慢慢吃飯，把生活節奏放穩，就是日常裡很實在的照顧。",
      "",
      "#仙加味 #日常分享 #家常餐桌",
    ].join("\n"),
  },
  {
    id: "first-batch-care-hydration-20260819",
    sequenceRole: "care",
    category: "氣候關心",
    title: "天氣炎熱，記得分次補充水分",
    scheduledAt: "2026-08-19T02:00:00.000Z",
    image: "care-hydration-2026-08-19.jpg",
    instagramCaption: [
      "天氣炎熱，水瓶可以放在看得到、拿得到的地方。",
      "",
      "外出記得帶水，不用等到很渴才喝；忙碌中也替自己安排幾次補充水分與休息的時間。",
      "",
      "照顧自己，也照顧家人。",
      "",
      "#仙加味 #日常關心 #炎熱提醒 #補充水分",
    ].join("\n"),
    facebookCaption: [
      "天氣熱的時候，記得把補充水分放進日常安排。",
      "",
      "外出帶水瓶、分次飲用，忙碌時也別忘了休息一下。簡單的小提醒，也可以分享給身邊的家人。",
      "",
      "#仙加味 #炎熱提醒 #補充水分",
    ].join("\n"),
  },
  {
    id: "first-batch-other-rainy-day-20260821",
    sequenceRole: "product",
    category: "日常使用情境",
    title: "下雨天在家，也可以留一點暖暖的時間",
    scheduledAt: "2026-08-21T12:00:00.000Z",
    image: "care-rainy-day-2026-08-26.jpg",
    instagramCaption: [
      "下雨天待在家，可以替自己留一點慢下來的時間。",
      "",
      "泡一杯溫熱飲品、簡單整理餐桌，或和家人一起坐下來聊聊天，讓日常多一點溫度。",
      "",
      "天氣有變化，生活節奏也可以慢慢調整。",
      "",
      "#仙加味 #日常分享 #下雨天 #溫暖時光",
    ].join("\n"),
    facebookCaption: [
      "下雨天在家，不妨替自己留一點暖暖的時間。",
      "",
      "泡杯溫熱飲品、把步調放慢，或陪家人聊聊天。照顧日常，有時就是從這些簡單的小事開始。",
      "",
      "#仙加味 #下雨天 #溫暖日常",
    ].join("\n"),
  },
];

let installed = false;
let cleanupTimer = null;

function imageUrl(file) {
  return `${RAW_BASE}/${file}?v=first-batch-202607`;
}

function cancelObsolete(store, nowIso) {
  let changed = 0;
  store.posts = (store.posts || []).map((post) => {
    const obsolete = post.campaignId === OLD_CAMPAIGN_ID || /^approved-mascot-original-/.test(String(post.id || ""));
    if (!obsolete || ["published", "cancelled"].includes(post.status)) return post;
    changed += 1;
    return {
      ...post,
      status: "cancelled",
      assetLocked: false,
      lastError: "已由新版無編號社群貼文取代",
      updatedAt: nowIso,
    };
  });
  return changed;
}

function upsertBatch(loaded) {
  const store = loaded.readStore();
  const nowIso = new Date().toISOString();
  let changed = cancelObsolete(store, nowIso);

  for (const item of POSTS) {
    const existing = store.posts.find((post) => post.id === item.id);
    if (existing) continue;
    store.posts.push({
      ...item,
      campaignId: CAMPAIGN_ID,
      campaignVersion: VERSION,
      imageUrl: imageUrl(item.image),
      sourceImageFile: item.image,
      publishInstagram: true,
      publishFacebook: true,
      assetLocked: false,
      status: "draft",
      result: {},
      lastError: "",
      history: [{
        id: `batch-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
        action: "建立新版待審貼文",
        detail: "圖片與 FB／IG 文案已配對，等待檢查通過",
        createdAt: nowIso,
      }],
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    changed += 1;
  }

  store.socialFirstBatchVersion = VERSION;
  store.socialFirstBatchCampaignId = CAMPAIGN_ID;
  store.socialFirstBatchUpdatedAt = nowIso;
  if (changed) loaded.writeStore(store);

  console.log("First social batch reconciled", {
    campaignId: CAMPAIGN_ID,
    createdOrCancelled: changed,
    futureDrafts: POSTS.length,
    firstAt: POSTS[0].scheduledAt,
    lastAt: POSTS.at(-1).scheduledAt,
  });
  return { changed, count: POSTS.length };
}

function cleanupObsolete(loaded) {
  const store = loaded.readStore();
  const changed = cancelObsolete(store, new Date().toISOString());
  if (changed) loaded.writeStore(store);
  return changed;
}

function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./social-server" && parent?.filename?.endsWith("internal-entry.js") && loaded?.readStore && loaded?.writeStore) {
      setTimeout(() => {
        try {
          upsertBatch(loaded);
        } catch (error) {
          console.error("First social batch setup failed", error);
        }
      }, 500).unref?.();

      if (!cleanupTimer) {
        cleanupTimer = setInterval(() => {
          try {
            const changed = cleanupObsolete(loaded);
            if (changed) console.log("Obsolete numbered social posts cancelled", { changed });
          } catch (error) {
            console.error("Obsolete social cleanup failed", error);
          }
        }, 30000);
        cleanupTimer.unref?.();
      }
    }
    return loaded;
  };
}

install();

module.exports = {
  VERSION,
  CAMPAIGN_ID,
  POSTS,
  imageUrl,
  cancelObsolete,
  upsertBatch,
  cleanupObsolete,
  install,
};
