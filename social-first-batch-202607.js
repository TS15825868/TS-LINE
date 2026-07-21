"use strict";

const Module = require("module");
require("./internal-social-immediate-ui");

const VERSION = "2.0.0";
const CONTENT_VERSION = "first-batch-10-approved-originals-v2";
const CAMPAIGN_ID = "xjw-social-first-batch-202607-v2";
const OBSOLETE_CAMPAIGN_IDS = new Set([
  "xjw-social-first-batch-202607-v1",
  "xjw-approved-zip-202607-v1",
]);
const RAW_BASE = "https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/social/first-batch";
const DM_BASE = "https://ts15825868.github.io/xianjiawei/images/dm-final";

const POSTS = [
  {
    id: "first-batch-v2-product-guilu-gao-20260724",
    sequenceRole: "product",
    category: "產品介紹",
    title: "龜鹿膏100g｜依日常節奏慢慢安排",
    scheduledAt: "2026-07-24T12:00:00.000Z",
    imageUrl: `${DM_BASE}/01_guilu-gao-100g-dm.jpg?v=408.7`,
    sourceImageFile: "01_guilu-gao-100g-dm.jpg",
    instagramCaption: [
      "龜鹿膏是膏狀型態，規格為100g／罐。",
      "",
      "可以依產品標示取用，也可加入溫熱水化開後慢慢飲用。第一次安排時不必急著一次很多，先從自己容易記得、做得到的節奏開始。",
      "",
      "開罐後請依包裝標示冷藏保存。",
      "補養，是一種節奏。",
      "",
      "#仙加味 #龜鹿膏 #100g #使用小提醒 #漢方生活",
    ].join("\n"),
    facebookCaption: [
      "龜鹿膏100g是適合依日常節奏取用的膏狀型態。",
      "",
      "可直接依產品標示取用，也可加入溫熱水化開後飲用。把時間安排在自己容易記得的時段，比臨時想到才使用更順手。開罐後請依包裝標示冷藏保存。",
      "",
      "產品圖片使用仙加味正式DM與真實產品外觀，不更動包裝與比例。",
      "",
      "#仙加味 #龜鹿膏 #使用小提醒",
    ].join("\n"),
  },
  {
    id: "first-batch-v2-care-work-rest-20260729",
    sequenceRole: "care",
    category: "日常關心",
    title: "工作再忙，也別忘了休息一下",
    scheduledAt: "2026-07-29T02:00:00.000Z",
    imageUrl: `${RAW_BASE}/care-work-rest-2026-07-29.jpg?v=first-batch-v2`,
    sourceImageFile: "care-work-rest-2026-07-29.jpg",
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
    id: "first-batch-v2-product-guilu-yin-30cc-20260731",
    sequenceRole: "product",
    category: "產品介紹",
    title: "龜鹿飲30cc｜輕巧瓶裝，外出攜帶方便",
    scheduledAt: "2026-07-31T12:00:00.000Z",
    imageUrl: `${DM_BASE}/02_guilu-drink-30cc-dm.jpg?v=408.7`,
    sourceImageFile: "02_guilu-drink-30cc-dm.jpg",
    instagramCaption: [
      "龜鹿飲30cc為矮胖的小玻璃瓶裝，輕巧好攜帶。",
      "",
      "開瓶即可飲用，也可依個人習慣溫熱後再喝；不需要把簡單的日常安排得太複雜。",
      "",
      "實際保存與飲用方式請以包裝標示為準。",
      "",
      "#仙加味 #龜鹿飲 #30cc #玻璃瓶 #日常攜帶",
    ].join("\n"),
    facebookCaption: [
      "龜鹿飲30cc是矮胖的小玻璃瓶裝，適合需要輕巧攜帶的日常情境。",
      "",
      "可直接飲用，也可依個人習慣溫熱後再喝。產品圖片維持正式真實外觀，不改瓶型、標籤、比例或包裝。實際保存方式請以包裝標示為準。",
      "",
      "#仙加味 #龜鹿飲30cc #日常攜帶",
    ].join("\n"),
  },
  {
    id: "first-batch-v2-care-family-20260805",
    sequenceRole: "care",
    category: "日常關心",
    title: "照顧自己，也別忘了關心家人",
    scheduledAt: "2026-08-05T02:00:00.000Z",
    imageUrl: `${RAW_BASE}/care-family-2026-08-05.jpg?v=first-batch-v2`,
    sourceImageFile: "care-family-2026-08-05.jpg",
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
    id: "first-batch-v2-product-lurongfen-75g-20260807",
    sequenceRole: "product",
    category: "產品介紹",
    title: "鹿茸粉75g｜依自己的飲食習慣搭配",
    scheduledAt: "2026-08-07T12:00:00.000Z",
    imageUrl: `${DM_BASE}/04_luerong-fen-75g-dm.jpg?v=408.7`,
    sourceImageFile: "04_luerong-fen-75g-dm.jpg",
    instagramCaption: [
      "鹿茸粉規格為75g／罐，原料為鹿茸。",
      "",
      "可依個人習慣取適量，加入溫開水、牛奶、豆漿或其他飲品中攪拌均勻。初次安排可以少量開始，再依自己的飲食習慣調整。",
      "",
      "開封後請密封保存並儘早食用完畢。",
      "",
      "#仙加味 #鹿茸粉 #75g #飲品搭配 #使用小提醒",
    ].join("\n"),
    facebookCaption: [
      "鹿茸粉75g可依自己的飲食習慣，加入溫開水、牛奶、豆漿或其他飲品中攪拌均勻。",
      "",
      "初次安排可從少量開始，再依個人習慣調整。開封後請密封保存並儘早食用完畢；實際使用與保存仍以包裝標示為準。",
      "",
      "#仙加味 #鹿茸粉 #使用小提醒",
    ].join("\n"),
  },
  {
    id: "first-batch-v2-care-temperature-gap-20260812",
    sequenceRole: "care",
    category: "氣候關心",
    title: "早晚溫差大，出門多帶一件薄外套",
    scheduledAt: "2026-08-12T02:00:00.000Z",
    imageUrl: `${RAW_BASE}/care-temperature-gap-2026-08-12.jpg?v=first-batch-v2`,
    sourceImageFile: "care-temperature-gap-2026-08-12.jpg",
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
    id: "first-batch-v2-product-tangkuai-75g-20260814",
    sequenceRole: "product",
    category: "產品介紹",
    title: "龜鹿湯塊75g｜8塊裝，沖泡料理都方便",
    scheduledAt: "2026-08-14T12:00:00.000Z",
    imageUrl: `${DM_BASE}/05_guilu-tangkuai-75g-dm.jpg?v=408.7`,
    sourceImageFile: "05_guilu-tangkuai-75g-dm.jpg",
    instagramCaption: [
      "龜鹿湯塊75g為每盒8塊裝，主要成分為龜板萃取物與鹿角萃取物。",
      "",
      "可依產品標示加入熱水沖泡，也能搭配雞湯、排骨湯等家常料理。水量與使用方式可依包裝標示及個人口感安排。",
      "",
      "#仙加味 #龜鹿湯塊 #75g #8塊裝 #沖泡料理",
    ].join("\n"),
    facebookCaption: [
      "龜鹿湯塊75g為8塊裝，適合熱水沖泡或家常料理。",
      "",
      "可搭配雞湯、排骨湯，也可依產品標示使用熱水沖泡。產品圖片維持正式盒型、塊數與真實外觀，不重畫、不改比例。",
      "",
      "#仙加味 #龜鹿湯塊 #沖泡料理",
    ].join("\n"),
  },
  {
    id: "first-batch-v2-care-hydration-20260819",
    sequenceRole: "care",
    category: "氣候關心",
    title: "天氣炎熱，記得分次補充水分",
    scheduledAt: "2026-08-19T02:00:00.000Z",
    imageUrl: `${RAW_BASE}/care-hydration-2026-08-19.jpg?v=first-batch-v2`,
    sourceImageFile: "care-hydration-2026-08-19.jpg",
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
    id: "first-batch-v2-product-guilu-jiao-600g-20260821",
    sequenceRole: "product",
    category: "產品介紹",
    title: "龜鹿膠600g｜家庭規格，依日常慢慢安排",
    scheduledAt: "2026-08-21T12:00:00.000Z",
    imageUrl: `${DM_BASE}/06_guilu-jiao-600g-dm.jpg?v=408.7`,
    sourceImageFile: "06_guilu-jiao-600g-dm.jpg",
    instagramCaption: [
      "龜鹿膠規格為600g／盒（1斤），共32塊，每塊約18.75g。",
      "",
      "可依產品標示加入熱水化開，也能搭配家常料理。家庭規格適合先確認保存空間與使用節奏，再慢慢安排。",
      "",
      "#仙加味 #龜鹿膠 #600g #家庭規格 #使用小提醒",
    ].join("\n"),
    facebookCaption: [
      "龜鹿膠600g為一斤裝，盒內共32塊，每塊約18.75g。",
      "",
      "可依產品標示以熱水化開，也能搭配家常料理。正式DM呈現真實盒型與產品規格，不改包裝、不改比例。",
      "",
      "#仙加味 #龜鹿膠 #600g",
    ].join("\n"),
  },
  {
    id: "first-batch-v2-care-rainy-day-20260826",
    sequenceRole: "care",
    category: "氣候關心",
    title: "下雨天在家，也別忘了留一點暖身時間",
    scheduledAt: "2026-08-26T02:00:00.000Z",
    imageUrl: `${RAW_BASE}/care-rainy-day-2026-08-26.jpg?v=first-batch-v2`,
    sourceImageFile: "care-rainy-day-2026-08-26.jpg",
    instagramCaption: [
      "下雨天待在家，可以替自己留一點慢下來的時間。",
      "",
      "泡一杯溫熱飲品、簡單整理餐桌，或和家人一起坐下來聊聊天，讓日常多一點溫度。",
      "",
      "天氣有變化，照顧自己也照顧身邊的人。",
      "",
      "#仙加味 #日常關心 #下雨天 #溫暖時光",
    ].join("\n"),
    facebookCaption: [
      "下雨天在家，不妨替自己留一點暖暖的時間。",
      "",
      "泡杯溫熱飲品、把步調放慢，或陪家人聊聊天。照顧日常，有時就是從這些簡單的小事開始。",
      "",
      "#仙加味 #下雨天 #日常關心",
    ].join("\n"),
  },
];

let installed = false;
let cleanupTimer = null;

function cancelObsolete(store, nowIso) {
  let changed = 0;
  store.posts = (store.posts || []).map((post) => {
    const obsolete =
      OBSOLETE_CAMPAIGN_IDS.has(String(post.campaignId || "")) ||
      /^approved-mascot-original-/.test(String(post.id || ""));
    if (!obsolete || ["published", "cancelled"].includes(post.status)) return post;
    changed += 1;
    return {
      ...post,
      status: "cancelled",
      assetLocked: false,
      lastError: "已由新版10篇無編號社群圖文取代",
      updatedAt: nowIso,
    };
  });
  return changed;
}

function desiredPost(item, nowIso, createdAt = nowIso) {
  return {
    ...item,
    campaignId: CAMPAIGN_ID,
    campaignVersion: VERSION,
    contentVersion: CONTENT_VERSION,
    publishInstagram: true,
    publishFacebook: true,
    assetLocked: false,
    status: "draft",
    approvedAt: "",
    result: {},
    lastError: "",
    history: [{
      id: `batch-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
      action: "建立新版待審貼文",
      detail: "5篇關心貼文與5篇正式產品DM已配對，等待檢查通過",
      createdAt: nowIso,
    }],
    createdAt,
    updatedAt: nowIso,
  };
}

function upsertBatch(loaded) {
  const store = loaded.readStore();
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  const nowIso = new Date().toISOString();
  let changed = cancelObsolete(store, nowIso);

  for (const item of POSTS) {
    const index = store.posts.findIndex((post) => post.id === item.id);
    if (index < 0) {
      store.posts.push(desiredPost(item, nowIso));
      changed += 1;
      continue;
    }

    const existing = store.posts[index];
    if (existing.status === "published" || existing.contentVersion === CONTENT_VERSION) continue;
    store.posts[index] = desiredPost(item, nowIso, existing.createdAt || nowIso);
    changed += 1;
  }

  store.socialFirstBatchVersion = VERSION;
  store.socialFirstBatchContentVersion = CONTENT_VERSION;
  store.socialFirstBatchCampaignId = CAMPAIGN_ID;
  store.socialFirstBatchUpdatedAt = nowIso;
  if (changed) loaded.writeStore(store);

  console.log("First social batch v2 reconciled", {
    campaignId: CAMPAIGN_ID,
    changed,
    total: POSTS.length,
    care: POSTS.filter((post) => post.sequenceRole === "care").length,
    other: POSTS.filter((post) => post.sequenceRole !== "care").length,
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
        try { upsertBatch(loaded); }
        catch (error) { console.error("First social batch v2 setup failed", error); }
      }, 500).unref?.();

      if (!cleanupTimer) {
        cleanupTimer = setInterval(() => {
          try {
            const changed = cleanupObsolete(loaded);
            if (changed) console.log("Obsolete social posts cancelled", { changed });
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
  CONTENT_VERSION,
  CAMPAIGN_ID,
  POSTS,
  cancelObsolete,
  desiredPost,
  upsertBatch,
  cleanupObsolete,
  install,
};
