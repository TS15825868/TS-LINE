"use strict";

const { CAMPAIGN_ID, POSTS: BASE_POSTS } = require("./social-draft-library");

const SITE = "https://ts15825868.github.io/xianjiawei/";
const START_AT = "2026-07-20T20:30:00+08:00";
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

function fbCaption(headline, body, cta = "想了解產品、成分或使用方式，可直接私訊或加入官方 LINE：@762jybnm。", tags = BRAND_TAGS) {
  return [headline, "", body, "", "仙加味・龜鹿", "補養，是一種節奏。", "", cta, "", tags].join("\n");
}

// 每兩週 3 篇：第一週週一、週四；第二週週三。
function weeklySchedule(index) {
  const cycle = Math.floor(index / 3);
  const slot = index % 3;
  const dayOffsets = [0, 3, 9];
  const date = new Date(START_AT);
  date.setUTCDate(date.getUTCDate() + cycle * 14 + dayOffsets[slot]);
  return date.toISOString();
}

const EXTRA_CONTENT = [
  {
    title: "長期草稿 31｜看標示先看這四件事",
    imageUrl: IMAGES.gao,
    headline: "看產品標示，不必只看正面名稱。",
    ig: "可以先看成分、規格、保存方式與食用方式，確認是否符合自己的使用情境。",
    fb: "選擇龜鹿產品時，可以先從四個地方開始：實際成分、產品規格、保存方式，以及平常要怎麼使用。比起只看包裝正面或產品外型，這些資訊更能幫助自己做選擇。",
  },
  {
    title: "長期草稿 32｜辦公室怎麼安排比較方便",
    imageUrl: IMAGES.drink30,
    headline: "辦公室裡，方便比複雜更容易持續。",
    ig: "偏好即飲可選龜鹿飲；有熱水可用湯塊或龜鹿膏；依工作環境選擇即可。",
    fb: "在辦公室安排時，可以先看環境：想快速即飲，可了解龜鹿飲；有熱水與杯子，可用龜鹿膏或湯塊；有保溫壺，也能把湯塊放進去悶泡。適合工作流程，才比較容易持續。",
  },
  {
    title: "長期草稿 33｜早上與下午怎麼選時間",
    imageUrl: IMAGES.gao,
    headline: "不用追求唯一時間，選自己記得住的時段。",
    ig: "可安排在早餐後、上午工作空檔或下午，避開太接近睡前即可。",
    fb: "仙加味通常建議把日常安排放在早上或下午。有人習慣早餐後，有人選上午工作空檔，也有人放在下午。重點是選一個自己容易記得、也不會太接近睡前的時段。",
  },
  {
    title: "長期草稿 34｜天氣熱時可以怎麼調整",
    imageUrl: IMAGES.drink30,
    headline: "天氣熱，不代表一定要完全停止日常安排。",
    ig: "可以從少量開始、增加水量，或安排在早上與下午，依自己的飲食習慣調整。",
    fb: "天氣較熱時，可以先從少量開始，使用熱水化開時增加水量，也可以安排在早上或下午。產品型態不能直接代表季節，仍要回到原料、份量與自己的日常狀況。",
  },
  {
    title: "長期草稿 35｜不是越濃越好",
    imageUrl: IMAGES.soup,
    headline: "口感濃，不等於一定更適合自己。",
    ig: "沖泡濃淡可以依口味調整，先找到容易入口、能持續的比例。",
    fb: "龜鹿膏、湯塊或龜鹿膠用熱水化開時，不需要刻意追求很濃。每個人的口味與習慣不同，可以從較少份量或較多水量開始，再慢慢調整到自己容易接受的濃淡。",
  },
  {
    title: "長期草稿 36｜送禮前先想使用情境",
    imageUrl: IMAGES.gao,
    headline: "送龜鹿產品，不一定只看包裝大小。",
    ig: "可先想對方偏好直接取用、即飲、沖泡、料理，或家庭大規格。",
    fb: "準備送禮時，可以先想對方平常的生活方式：喜歡固定小匙取用，可了解龜鹿膏；常外出可選龜鹿飲；喜歡燉湯可選湯塊；家庭固定使用則可了解龜鹿膠。",
  },
  {
    title: "長期草稿 37｜第一次詢問可以先說什麼",
    imageUrl: IMAGES.drink30,
    headline: "不知道怎麼問，也可以從生活方式開始說。",
    ig: "告訴我們平常在家或外出、偏好即飲或料理、希望小規格或家庭規格即可。",
    fb: "第一次詢問不需要先記住所有產品。可以直接告訴我們：主要在家還是外出使用、偏好即飲或熱水沖泡、會不會燉湯，以及想要小規格還是家庭大規格，我們會協助整理。",
  },
  {
    title: "長期草稿 38｜龜鹿膏罐內取用提醒",
    imageUrl: IMAGES.gao,
    headline: "乾淨、乾燥的湯匙，是開封後的重要小習慣。",
    ig: "取用龜鹿膏時避免水氣進入，取用後立即密封並依標示保存。",
    fb: "龜鹿膏開封後，每次使用乾淨、乾燥的湯匙取用，避免水氣或其他食物殘留進入罐內。取用後立即密封並依產品標示保存，能讓日常取用更穩定。",
    tags: `${BRAND_TAGS} #龜鹿膏 #保存方式`,
  },
  {
    title: "長期草稿 39｜湯塊料理水量怎麼抓",
    imageUrl: IMAGES.soup,
    headline: "湯塊料理，不需要只記一個固定水量。",
    ig: "沖泡可先從約 300～500mL 熱水開始；燉湯則依鍋量與家中口味調整。",
    fb: "龜鹿湯塊直接沖泡時，可先從約 300～500mL 熱水開始；加入雞湯或排骨湯時，則依鍋量、食材與家中口味調整。先少量加入，再視濃淡調整即可。",
    tags: `${BRAND_TAGS} #龜鹿湯塊 #料理搭配`,
  },
  {
    title: "長期草稿 40｜鹿茸粉的飲品搭配",
    imageUrl: IMAGES.powder,
    headline: "鹿茸粉不只可以加溫開水。",
    ig: "也可依習慣加入牛奶、豆漿或其他溫熱飲品，攪拌均勻後飲用。",
    fb: "鹿茸粉可依個人需求取適量，除了溫開水，也能加入牛奶、豆漿或其他溫熱飲品。第一次搭配時可以先從少量開始，確認口感後再調整。",
    tags: `${BRAND_TAGS} #鹿茸粉`,
  },
  {
    title: "長期草稿 41｜為什麼不只用外型比較產品",
    imageUrl: IMAGES.jiao,
    headline: "同樣是膏狀或塊狀，實際內容仍可能不同。",
    ig: "比較時應回到成分、配料、規格、每次份量與使用方式。",
    fb: "產品做成膏狀、液態或塊狀，只是呈現與使用方式不同。外型、顏色或柔軟度不能單獨代表原料比例。比較產品時，仍應回到成分、配料、規格與每次使用方式。",
  },
  {
    title: "長期草稿 42｜一週一到兩次認識仙加味",
    imageUrl: IMAGES.gao,
    headline: "不用每天被推銷，慢慢認識就好。",
    ig: "我們會用一週 1～2 篇的節奏，整理產品、使用方式、料理與常見問題。",
    fb: "仙加味的社群會維持一週 1～2 篇，不用每天重複推銷。我們會輪流整理產品差異、日常使用、料理方式、保存與常見問題，讓需要時能找到清楚資訊。",
    cta: "有想先了解的主題，也可以直接私訊告訴我們。",
  },
];

const EXTRA_POSTS = EXTRA_CONTENT.map((item, index) => {
  const number = BASE_POSTS.length + index + 1;
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

const POSTS = [...BASE_POSTS, ...EXTRA_POSTS].map((item, index) => ({
  ...item,
  scheduledAt: weeklySchedule(index),
}));

function seedSocialDraftLibraryExtended(readStore, writeStore) {
  const store = readStore();
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  const byKey = new Map(store.posts.map((post) => [post.campaignKey, post]));
  const createdAt = new Date().toISOString();
  let added = 0;
  let updated = 0;

  for (const item of POSTS) {
    const existing = byKey.get(item.campaignKey);
    if (!existing) {
      store.posts.push({
        id: `post-${item.campaignKey}`,
        campaignId: CAMPAIGN_ID,
        ...item,
        status: "draft",
        result: {},
        lastError: "",
        createdAt,
        updatedAt: createdAt,
      });
      added += 1;
      continue;
    }

    if (!["published", "cancelled"].includes(existing.status)) {
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
        updatedAt: createdAt,
      });
      updated += 1;
    }
  }

  if (added || updated) writeStore(store);
  return {
    campaignId: CAMPAIGN_ID,
    cadence: "每兩週3篇（每週1～2篇）",
    added,
    updated,
    total: POSTS.length,
    firstAt: POSTS[0]?.scheduledAt,
    lastAt: POSTS.at(-1)?.scheduledAt,
  };
}

module.exports = {
  CAMPAIGN_ID,
  POSTS,
  weeklySchedule,
  seedSocialDraftLibraryExtended,
};
