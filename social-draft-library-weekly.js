"use strict";

const {
  CAMPAIGN_ID,
  POSTS: EXISTING_POSTS,
} = require("./social-draft-library-extended");

const SITE = "https://ts15825868.github.io/xianjiawei/";
const START_AT = "2026-07-17T20:00:00+08:00";
const BRAND_TAGS = "#仙加味 #龜鹿 #漢方生活 #日常補養 #補養是一種節奏";

const IMAGES = {
  gao: `${SITE}images/dm-final/01_guilu-gao-100g-dm.jpg?v=408.7`,
  drink30: `${SITE}images/dm-final/02_guilu-drink-30cc-dm.jpg?v=408.7`,
  drink180: `${SITE}images/dm-final/03_guilu-drink-180cc-dm.jpg?v=408.7`,
  powder: `${SITE}images/dm-final/04_luerong-fen-75g-dm.jpg?v=408.7`,
  soup: `${SITE}images/dm-final/05_guilu-tangkuai-75g-dm.jpg?v=408.7`,
  jiao: `${SITE}images/dm-final/06_guilu-jiao-600g-dm.jpg?v=408.7`,
};

function igCaption(headline, body, tags = BRAND_TAGS) {
  return [headline, "", body, "", "仙加味・龜鹿", "補養，是一種節奏。", "", tags].join("\n");
}

function fbCaption(
  headline,
  body,
  cta = "想了解產品、成分或使用方式，可直接私訊或加入官方 LINE：@762jybnm。",
  tags = BRAND_TAGS
) {
  return [headline, "", body, "", "仙加味・龜鹿", "補養，是一種節奏。", "", cta, "", tags].join("\n");
}

// 每兩週 3 篇：第一週週五 1 篇；第二週週三、週五 2 篇。
function weeklySchedule(index) {
  const cycle = Math.floor(index / 3);
  const slot = index % 3;
  const dayOffsets = [0, 5, 7];
  const date = new Date(START_AT);
  date.setUTCDate(date.getUTCDate() + cycle * 14 + dayOffsets[slot]);
  return date.toISOString();
}

const MORE_CONTENT = [
  {
    title: "長期草稿 43｜收到產品後先確認什麼",
    imageUrl: IMAGES.gao,
    headline: "收到產品後，先看包裝、規格與保存標示。",
    ig: "確認外包裝完整、規格正確，再依產品標示保存；開封後也要留意密封與取用方式。",
    fb: "收到產品時，可以先確認外包裝是否完整、規格是否正確，以及保存方式。龜鹿膏開封後要密封冷藏並用乾燥湯匙取用；飲品開封後則應儘速飲用完畢。",
  },
  {
    title: "長期草稿 44｜膏、飲、湯塊怎麼依場合選",
    imageUrl: IMAGES.drink30,
    headline: "同一個人，也可以依不同場合選不同型態。",
    ig: "在家可用龜鹿膏或湯塊；外出可選小瓶龜鹿飲；料理時則可用湯塊或龜鹿膠。",
    fb: "產品不一定只能固定選一種。平常在家可安排龜鹿膏或湯塊；外出、工作空檔可選小瓶龜鹿飲；準備雞湯或排骨湯時，則可用湯塊或龜鹿膠。依場合選擇，會更容易持續。",
  },
  {
    title: "長期草稿 45｜保溫壺沖泡小提醒",
    imageUrl: IMAGES.soup,
    headline: "用保溫壺沖泡，先確認壺內乾淨、沒有其他飲品味道。",
    ig: "加入湯塊與熱水後悶泡，飲用前搖勻或攪拌，濃淡可再依口味調整。",
    fb: "使用保溫壺沖泡龜鹿湯塊前，先確認壺內乾淨，避免咖啡、茶或其他飲品殘留影響味道。加入熱水悶泡後，飲用前可搖勻或攪拌，再依口味增加熱水。",
    tags: `${BRAND_TAGS} #龜鹿湯塊 #保溫壺`,
  },
  {
    title: "長期草稿 46｜為什麼份量要依習慣調整",
    imageUrl: IMAGES.gao,
    headline: "日常安排沒有必要一次追求很多。",
    ig: "可以先從少量開始，觀察口感與生活作息，再慢慢找到自己容易持續的份量。",
    fb: "每個人的飲食習慣、作息與口味不同，日常安排不需要一次追求很多。先從較少份量開始，確認自己能接受的口感與使用方式，再慢慢固定下來，通常更實際。",
  },
  {
    title: "長期草稿 47｜龜鹿膏與熱飲怎麼搭",
    imageUrl: IMAGES.gao,
    headline: "龜鹿膏除了直接取用，也能調成一杯溫熱飲品。",
    ig: "取適量加入約 100～300mL 熱水化開，水量可依喜歡的濃淡調整。",
    fb: "取適量龜鹿膏加入約 100～300mL 熱水化開，就能調成溫熱飲品。喜歡味道淡一些，可以增加水量；想保留較濃口感，則可從較少水量開始。",
    tags: `${BRAND_TAGS} #龜鹿膏 #溫熱飲用`,
  },
  {
    title: "長期草稿 48｜家庭共用怎麼選規格",
    imageUrl: IMAGES.jiao,
    headline: "家庭共用時，規格與保存習慣同樣重要。",
    ig: "使用頻率不高可先選小規格；固定多人使用，再了解龜鹿膠一斤裝。",
    fb: "家庭共用前，可以先估算實際使用頻率。偶爾安排或第一次接觸，可從小規格開始；家中多人固定使用、也熟悉沖泡與料理方式時，再了解龜鹿膠一斤裝。",
  },
  {
    title: "長期草稿 49｜開封日期可以怎麼記",
    imageUrl: IMAGES.gao,
    headline: "在包裝上記下開封日期，是很實用的小習慣。",
    ig: "開封後寫上日期，搭配密封、冷藏與乾燥湯匙取用，更容易掌握使用狀況。",
    fb: "龜鹿膏或其他需要開封後保存的產品，可以在包裝底部或標籤旁記下開封日期。每次取用後立即密封，搭配正確保存方式，日常管理會更清楚。",
    tags: `${BRAND_TAGS} #保存方式`,
  },
  {
    title: "長期草稿 50｜工作忙時怎麼簡化流程",
    imageUrl: IMAGES.drink30,
    headline: "忙的時候，把步驟減少，反而更容易維持。",
    ig: "可以事先準備杯子、保溫壺或即飲小瓶，選一個固定時段，不必每天重新決定。",
    fb: "工作忙碌時，最容易中斷的通常不是產品，而是流程太多。可以事先準備固定杯子或保溫壺，也可以選即飲小瓶，再把時間固定在上午或下午的某個空檔。",
  },
  {
    title: "長期草稿 51｜湯塊與龜鹿膠的規格差別",
    imageUrl: IMAGES.soup,
    headline: "湯塊與龜鹿膠，可以先從規格與使用情境理解。",
    ig: "湯塊 75g 小盒適合沖泡、料理與初次了解；龜鹿膠 600g 適合家庭大規格安排。",
    fb: "龜鹿湯塊為 75g、8 塊裝，適合小盒裝、沖泡、保溫壺或料理；龜鹿膠為 600g 一斤裝，適合熟悉產品、家庭固定安排或多人使用。",
    tags: `${BRAND_TAGS} #龜鹿湯塊 #龜鹿膠`,
  },
  {
    title: "長期草稿 52｜產品資訊為什麼要一致",
    imageUrl: IMAGES.gao,
    headline: "網站、包裝與客服說明一致，選擇才會更安心。",
    ig: "仙加味會持續整理規格、成分、使用方式與保存資訊，讓需要時能快速確認。",
    fb: "產品資訊不應該在不同地方各說各話。仙加味會持續整理網站、LINE 與產品說明中的規格、成分、使用方式及保存資訊，讓大家詢問與使用時都能找到一致內容。",
  },
  {
    title: "長期草稿 53｜鹿茸粉第一次怎麼開始",
    imageUrl: IMAGES.powder,
    headline: "第一次搭配鹿茸粉，可以先從少量與簡單飲品開始。",
    ig: "先加入溫開水、牛奶或豆漿，攪拌均勻，確認口感後再調整份量。",
    fb: "第一次使用鹿茸粉，可以先從少量開始，搭配平常熟悉的溫開水、牛奶或豆漿。攪拌均勻、確認口感後，再依自己的飲食習慣調整。",
    tags: `${BRAND_TAGS} #鹿茸粉`,
  },
  {
    title: "長期草稿 54｜料理前先決定主角",
    imageUrl: IMAGES.soup,
    headline: "燉湯時，先決定雞肉、排骨或其他主要食材，再調整搭配。",
    ig: "龜鹿湯塊可與家常湯品搭配，紅棗、枸杞等食材則依個人口味添加。",
    fb: "準備龜鹿湯品時，可以先決定雞肉、排骨或其他主要食材，再依鍋量加入湯塊。紅棗、枸杞等配料可依家中口味添加，不需要一次放得很複雜。",
    tags: `${BRAND_TAGS} #料理搭配 #龜鹿湯塊`,
  },
  {
    title: "長期草稿 55｜外出攜帶的小細節",
    imageUrl: IMAGES.drink30,
    headline: "外出攜帶，除了方便，也要注意避免高溫與日曬。",
    ig: "小瓶龜鹿飲適合攜帶，但不要長時間留在高溫車內；開瓶後請儘速飲用。",
    fb: "30cc 小瓶龜鹿飲方便放進包包，但仍要避免長時間高溫與日光直射，尤其不要整天留在車內。開瓶後請儘速飲用完畢。",
    tags: `${BRAND_TAGS} #龜鹿飲 #外出攜帶`,
  },
  {
    title: "長期草稿 56｜補養不是一次性的決定",
    imageUrl: IMAGES.gao,
    headline: "真正適合的安排，通常是生活中做得到的安排。",
    ig: "先選容易使用的型態、記得住的時間與能接受的份量，再慢慢固定。",
    fb: "日常補養不是買回家就結束，也不是一次安排很多。選擇容易使用的產品型態、記得住的時間與能接受的份量，才比較有機會真正放進生活。",
  },
  {
    title: "長期草稿 57｜詢問產品時可以準備三件事",
    imageUrl: IMAGES.gao,
    headline: "想更快找到適合的型態，可以先告訴我們三件事。",
    ig: "平常在家或外出、偏好即飲或沖泡、想要小規格或家庭規格。",
    fb: "詢問產品時，可以先告訴我們：主要在家還是外出使用、偏好即飲／熱水沖泡／燉湯，以及希望小規格還是家庭規格。這三項資訊就能幫助我們更快整理差異。",
  },
  {
    title: "長期草稿 58｜一杯水量怎麼調整",
    imageUrl: IMAGES.gao,
    headline: "水量不是考試答案，依口味調整就好。",
    ig: "龜鹿膏可從約 100～300mL、湯塊可從約 300～500mL 熱水開始，再調整濃淡。",
    fb: "沖泡時不需要把水量當成唯一答案。龜鹿膏可從約 100～300mL 熱水開始；湯塊可從約 300～500mL 開始。覺得味道濃就增加熱水，找到自己容易入口的比例即可。",
  },
  {
    title: "長期草稿 59｜購買前先確認保存空間",
    imageUrl: IMAGES.jiao,
    headline: "選規格前，也要想想家裡的保存空間。",
    ig: "小罐、小盒較容易安排；家庭大規格則要確認陰涼處或冷藏空間是否足夠。",
    fb: "購買大規格前，可以先確認家中是否有合適的陰涼保存處或冷藏空間。小罐、小盒較容易安排；家庭大規格適合固定使用，但保存與取用也要事先規劃。",
  },
  {
    title: "長期草稿 60｜每週慢慢整理一個問題",
    imageUrl: IMAGES.gao,
    headline: "一週一到兩篇，慢慢把常見問題說清楚。",
    ig: "仙加味會固定在週三或週五晚上，分享產品差異、使用方式、保存與料理內容。",
    fb: "仙加味社群會維持一週 1～2 篇，以週三、週五晚上為主。內容會輪流整理產品差異、使用方式、保存、料理與常見問題，不用每天被推銷，需要時再回來查找即可。",
    cta: "有想先看的主題，可以直接私訊告訴我們。",
  },
];

const MORE_POSTS = MORE_CONTENT.map((item, index) => {
  const number = EXISTING_POSTS.length + index + 1;
  return {
    campaignKey: `${CAMPAIGN_ID}-${String(number).padStart(2, "0")}`,
    campaignDay: number,
    title: item.title,
    imageUrl: item.imageUrl,
    instagramCaption: igCaption(item.headline, item.ig, item.tags || BRAND_TAGS),
    facebookCaption: fbCaption(item.headline, item.fb, item.cta, item.tags || BRAND_TAGS),
    publishInstagram: true,
    publishFacebook: true,
  };
});

const POSTS = [...EXISTING_POSTS, ...MORE_POSTS].map((item, index) => ({
  ...item,
  scheduledAt: weeklySchedule(index),
}));

function seedSocialDraftLibraryWeekly(readStore, writeStore) {
  const store = readStore();
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  const byKey = new Map(store.posts.map((post) => [post.campaignKey, post]));
  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;
  let preserved = 0;

  for (const item of POSTS) {
    const existing = byKey.get(item.campaignKey);
    if (!existing) {
      store.posts.push({
        id: `post-${item.campaignKey}`,
        campaignId: CAMPAIGN_ID,
        ...item,
        status: "draft",
        result: {},
        platformStatus: { instagram: "待處理", facebook: "待處理" },
        lastError: "",
        createdAt: now,
        updatedAt: now,
      });
      added += 1;
      continue;
    }

    if (["published", "cancelled"].includes(existing.status)) {
      preserved += 1;
      continue;
    }

    Object.assign(existing, {
      campaignId: CAMPAIGN_ID,
      campaignDay: item.campaignDay,
      title: item.title,
      imageUrl: item.imageUrl,
      instagramCaption: item.instagramCaption,
      facebookCaption: item.facebookCaption,
      scheduledAt: item.scheduledAt,
      publishInstagram: true,
      publishFacebook: true,
      status: "draft",
      result: {},
      platformStatus: { instagram: "待處理", facebook: "待處理" },
      lastError: "",
      updatedAt: now,
    });
    updated += 1;
  }

  if (added || updated) writeStore(store);
  return {
    campaignId: CAMPAIGN_ID,
    cadence: "每兩週3篇：第一週週五；第二週週三、週五；晚上8:00",
    timezone: "Asia/Taipei",
    added,
    updated,
    preserved,
    total: POSTS.length,
    firstAt: POSTS[0]?.scheduledAt,
    lastAt: POSTS.at(-1)?.scheduledAt,
  };
}

module.exports = {
  CAMPAIGN_ID,
  POSTS,
  weeklySchedule,
  seedSocialDraftLibraryWeekly,
};
