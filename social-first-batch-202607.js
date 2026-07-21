"use strict";

const Module = require("module");
require("./internal-social-immediate-ui");

const VERSION = "1.1.0";
const CAMPAIGN_ID = "xjw-social-first-batch-202607-v2";
const OBSOLETE_CAMPAIGNS = new Set([
  "xjw-social-first-batch-202607-v1",
  "xjw-approved-zip-202607-v1",
]);
const TS_MASCOT = "https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot";
const SITE_DM = "https://raw.githubusercontent.com/TS15825868/xianjiawei/main/images/dm-final";

const POSTS = [
  {
    id: "social-v2-product-guilu-gao-20260724",
    sequenceRole: "product",
    category: "產品介紹",
    title: "龜鹿膏 100g｜依日常節奏安排",
    scheduledAt: "2026-07-24T12:00:00.000Z",
    imageUrl: `${SITE_DM}/01_guilu-gao-100g-dm.jpg?v=408.7`,
    instagramCaption: [
      "龜鹿膏 100g，適合依自己的日常節奏安排。",
      "",
      "每日早上及下午各一小匙，可單吃，也可搭配 100～300 ml 熱水化開後，調整至適口溫度飲用；亦可依需求用於燉煮。",
      "",
      "開罐後請冷藏，實際使用仍以產品標示為準。",
      "補養，是一種節奏。",
      "",
      "#仙加味 #龜鹿膏 #使用方式 #日常補養",
    ].join("\n"),
    facebookCaption: [
      "龜鹿膏 100g，可依自己的日常節奏安排。",
      "",
      "建議每日早上及下午各一小匙，可單吃，或搭配 100～300 ml 熱水化開後，調整到適口溫度飲用；也可依需求搭配燉煮。開罐後請冷藏，實際使用方式請以產品標示為準。",
      "",
      "補養，是一種節奏。",
      "#仙加味 #龜鹿膏 #日常補養",
    ].join("\n"),
  },
  {
    id: "social-v2-care-work-rest-20260729",
    sequenceRole: "care",
    category: "日常關心",
    title: "工作再忙，也別忘了休息一下",
    scheduledAt: "2026-07-29T02:00:00.000Z",
    imageUrl: `${TS_MASCOT}/faq.jpg?v=401.6-20260714`,
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
    id: "social-v2-product-guilu-yin-30cc-20260731",
    sequenceRole: "product",
    category: "產品介紹",
    title: "龜鹿飲 30cc｜輕巧即飲",
    scheduledAt: "2026-07-31T12:00:00.000Z",
    imageUrl: `${SITE_DM}/02_guilu-drink-30cc-dm.jpg?v=408.7`,
    instagramCaption: [
      "龜鹿飲 30cc 玻璃瓶，輕巧、方便攜帶。",
      "",
      "開瓶即可飲用，也可依個人習慣溫熱後飲用。適合外出、工作或想簡單安排的時候。",
      "",
      "實際保存與飲用方式請以產品標示為準。",
      "",
      "#仙加味 #龜鹿飲 #30cc #即開即飲 #日常安排",
    ].join("\n"),
    facebookCaption: [
      "龜鹿飲 30cc 玻璃瓶，適合需要輕巧攜帶、簡單安排的日常。",
      "",
      "開瓶即可飲用，也可依個人習慣溫熱後飲用。外出、工作或行程忙碌時，都能依自己的步調安排。實際保存與飲用方式請以產品標示為準。",
      "",
      "#仙加味 #龜鹿飲 #30cc #日常安排",
    ].join("\n"),
  },
  {
    id: "social-v2-care-family-20260805",
    sequenceRole: "care",
    category: "日常關心",
    title: "照顧自己，也別忘了關心家人",
    scheduledAt: "2026-08-05T02:00:00.000Z",
    imageUrl: `${TS_MASCOT}/brand.jpg?v=401.6-20260714`,
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
    id: "social-v2-product-lurongfen-75g-20260807",
    sequenceRole: "product",
    category: "產品介紹",
    title: "鹿茸粉 75g｜依習慣搭配飲品",
    scheduledAt: "2026-08-07T12:00:00.000Z",
    imageUrl: `${SITE_DM}/04_luerong-fen-75g-dm.jpg?v=408.7`,
    instagramCaption: [
      "鹿茸粉 75g，可依個人的飲食習慣搭配。",
      "",
      "取適量加入溫開水、牛奶、豆漿或其他飲品中，攪拌均勻後飲用。",
      "",
      "開封後請密封保存並儘早食用完畢，實際使用以產品標示為準。",
      "",
      "#仙加味 #鹿茸粉 #75g #飲品搭配 #使用方式",
    ].join("\n"),
    facebookCaption: [
      "鹿茸粉 75g，可依自己的飲食習慣加入飲品。",
      "",
      "取適量加入溫開水、牛奶、豆漿或其他飲品中，攪拌均勻後飲用。開封後請密封保存並儘早食用完畢，實際使用方式請以產品標示為準。",
      "",
      "#仙加味 #鹿茸粉 #飲品搭配",
    ].join("\n"),
  },
  {
    id: "social-v2-care-temperature-gap-20260812",
    sequenceRole: "care",
    category: "氣候關心",
    title: "早晚溫差大，出門多帶一件薄外套",
    scheduledAt: "2026-08-12T02:00:00.000Z",
    imageUrl: `${TS_MASCOT}/service.jpg?v=401.6-20260714`,
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
    id: "social-v2-product-guilu-tangkuai-75g-20260814",
    sequenceRole: "product",
    category: "產品介紹",
    title: "龜鹿湯塊 75g｜8 塊裝方便沖泡",
    scheduledAt: "2026-08-14T12:00:00.000Z",
    imageUrl: `${SITE_DM}/05_guilu-tangkuai-75g-dm.jpg?v=408.7`,
    instagramCaption: [
      "龜鹿湯塊 75g，每盒 8 塊裝。",
      "",
      "使用時可加入約 300～500 ml 熱水沖泡。小包裝方便取用，也適合依日常需求慢慢安排。",
      "",
      "常溫置於陰涼處，或保存於 5°C 以下冷藏；實際仍以產品標示為準。",
      "",
      "#仙加味 #龜鹿湯塊 #75g #熱水沖泡 #使用方式",
    ].join("\n"),
    facebookCaption: [
      "龜鹿湯塊 75g，每盒 8 塊裝，適合想要方便沖泡與取用的日常。",
      "",
      "使用時可加入約 300～500 ml 熱水。保存可常溫置於陰涼處，或保存於 5°C 以下冷藏；實際使用與保存方式請以產品標示為準。",
      "",
      "#仙加味 #龜鹿湯塊 #熱水沖泡",
    ].join("\n"),
  },
  {
    id: "social-v2-care-hydration-20260819",
    sequenceRole: "care",
    category: "氣候關心",
    title: "天氣炎熱，記得分次補充水分",
    scheduledAt: "2026-08-19T02:00:00.000Z",
    imageUrl: `${TS_MASCOT}/usage.jpg?v=401.6-20260714`,
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
    id: "social-v2-product-guilu-jiao-600g-20260821",
    sequenceRole: "product",
    category: "產品介紹",
    title: "龜鹿膠 600g｜家庭大盒規格",
    scheduledAt: "2026-08-21T12:00:00.000Z",
    imageUrl: `${SITE_DM}/06_guilu-jiao-600g-dm.jpg?v=408.7`,
    instagramCaption: [
      "龜鹿膠一斤裝，總重 600g，每盒 32 塊。",
      "",
      "每塊約 18.75g，可加入約 300～500 ml 熱水沖泡。與龜鹿湯塊內容物及製程相同，主要差別在包裝與規格。",
      "",
      "常溫置於陰涼處，或保存於 5°C 以下冷藏；實際以產品標示為準。",
      "",
      "#仙加味 #龜鹿膠 #600g #家庭規格 #熱水沖泡",
    ].join("\n"),
    facebookCaption: [
      "龜鹿膠一斤裝，總重 600g，每盒 32 塊，每塊約 18.75g。",
      "",
      "可加入約 300～500 ml 熱水沖泡。龜鹿膠與龜鹿湯塊的內容物及製程相同，主要差別在包裝與規格。保存可常溫置於陰涼處，或保存於 5°C 以下冷藏；實際請以產品標示為準。",
      "",
      "#仙加味 #龜鹿膠 #家庭規格",
    ].join("\n"),
  },
  {
    id: "social-v2-care-rainy-day-20260826",
    sequenceRole: "care",
    category: "氣候關心",
    title: "下雨天在家，也別忘了留一點暖暖的時間",
    scheduledAt: "2026-08-26T02:00:00.000Z",
    imageUrl: `${TS_MASCOT}/welcome.jpg?v=401.6-20260714`,
    instagramCaption: [
      "下雨天待在家，可以替自己留一點慢下來的時間。",
      "",
      "泡一杯溫熱飲品、簡單整理餐桌，或和家人一起坐下來聊聊天，讓日常多一點溫度。",
      "",
      "天氣有變化，生活節奏也可以慢慢調整。",
      "",
      "#仙加味 #仙加味小老闆 #日常關心 #下雨天 #溫暖時光",
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

function cancelObsolete(store, nowIso) {
  let changed = 0;
  store.posts = (store.posts || []).map((post) => {
    const obsolete = OBSOLETE_CAMPAIGNS.has(post.campaignId) || /^approved-mascot-original-/.test(String(post.id || ""));
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
      sourceImageFile: item.imageUrl.split("/").pop().split("?")[0],
      publishInstagram: true,
      publishFacebook: true,
      assetLocked: false,
      status: "draft",
      result: {},
      lastError: "",
      history: [{
        id: `batch-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
        action: "建立新版待審貼文",
        detail: "產品貼文使用官網正式 DM；關心貼文使用固定 Q 版小老闆正式素材",
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
    carePosts: POSTS.filter((post) => post.sequenceRole === "care").length,
    productPosts: POSTS.filter((post) => post.sequenceRole !== "care").length,
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
  CAMPAIGN_ID,
  POSTS,
  cancelObsolete,
  upsertBatch,
  cleanupObsolete,
  install,
};
