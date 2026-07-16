"use strict";

const { CARDS } = require("./knowledge-card-server");

const VERSION = "1.3.0";
const APP = "https://ts-line.onrender.com";
const IMAGE_VERSION = "8";
const IMAGE_PATH_VERSION = "v8";
const CAMPAIGN_ID = "xjw-knowledge-202607-v1";
const TAGS = "#仙加味 #仙加味小老闆 #龜鹿 #漢方生活 #日常補養 #補養是一種節奏";
const CTA = "有產品、保存或使用方式的問題，可私訊或加入官方 LINE：@762jybnm。";

function ig(headline, body, tags = TAGS) {
  return [headline, "", body, "", "仙加味小老闆幫你整理", "補養，是一種節奏。", "", tags].join("\n");
}

function fb(headline, body, cta = CTA, tags = TAGS) {
  return [headline, "", body, "", "仙加味小老闆幫你整理", "補養，是一種節奏。", "", cta, "", tags].join("\n");
}

const PATCHES = {
  sediment: {
    knowledgeTopic: "沖泡沉澱的確認步驟",
    title: "小老闆知識 03｜杯底有少量沉澱怎麼看",
    headline: "沖泡後杯底看到少量沉澱，先做哪幾個確認？",
    igBody: "先攪拌或搖勻，確認氣味、包裝與保存狀況。沉澱不能單靠外觀判斷；有疑問可保留完整包裝並拍照詢問。",
    fbBody: "沖泡後若杯底看到少量沉澱，可先攪拌或搖勻，再確認產品氣味、包裝是否完整，以及之前是否依標示保存。不要只靠沉澱外觀判斷品質；仍有疑問時，保留完整包裝並拍照詢問。",
    tags: `${TAGS} #常見問題 #沖泡觀察`,
  },
  color: {
    knowledgeTopic: "顏色深淺不能單獨判斷",
    title: "小老闆知識 04｜顏色深淺能判斷品質嗎",
    headline: "顏色比較深，就一定代表原料比較多或品質比較好嗎？",
    igBody: "顏色會受到原料、配料、光線、保存狀況與製作方式影響，不能只用深淺判斷。比較時仍要看完整成分、規格與保存方式。",
    fbBody: "產品顏色可能受到原料、其他配料、拍攝光線、保存狀況及製作方式影響。顏色深淺不能單獨代表原料比例或品質；選擇產品時，仍應回到完整成分、規格、每次份量與保存方式。",
    tags: `${TAGS} #選購觀念 #產品資訊`,
  },
  "batch-info": {
    knowledgeTopic: "收到商品先確認包裝規格與期限",
    title: "小老闆知識 07｜收到商品先確認哪些資訊",
    headline: "收到商品後，先確認哪些資訊比較安心？",
    igBody: "先確認包裝是否完整，再看產品名稱、規格、有效日期與保存方式。資料看清楚，後續使用會更安心。",
    fbBody: "收到產品後，可先確認包裝是否完整、產品名稱與規格是否正確，再查看有效日期與保存方式。外盒可先保留一段時間；若對內容或運送狀況有疑問，拍照聯絡客服會比較容易確認。",
    tags: `${TAGS} #收貨確認 #保存方式`,
  },
  "support-photos": {
    knowledgeTopic: "客服確認需要的三類照片",
    title: "小老闆知識 08｜詢問產品問題先拍這三張",
    headline: "向客服詢問產品狀況，拍哪三張照片最有幫助？",
    igBody: "建議拍完整包裝正反面、產品名稱與有效日期，以及實際內容與目前保存狀況。照片清楚完整，客服會更容易確認。",
    fbBody: "詢問產品狀況時，建議準備三類照片：完整包裝正反面、產品名稱與有效日期、實際內容物與目前保存狀況。照片盡量清楚並保留整體比例，比只拍局部更容易確認。",
    tags: `${TAGS} #客服提醒 #產品確認`,
  },
  "fair-compare": {
    knowledgeTopic: "依需求選擇適合自己的產品",
    title: "小老闆知識 18｜比較產品前先了解自己的需求",
    headline: "比較產品時，先從自己的需求與使用情境開始。",
    igBody: "每種型態都有適合的情境。先看成分、規格與使用方式，再依生活節奏選擇能融入日常的產品。",
    fbBody: "龜鹿膏、龜鹿飲、龜鹿湯塊、龜鹿膠與鹿茸粉，各有不同的使用方式。選擇時，先確認自己偏好的型態、使用時間與日常習慣，再看成分與規格，會比單純比較外觀更實用。",
    cta: "想了解仙加味各產品差異，可直接詢問規格、成分與使用方式。",
    tags: `${TAGS} #怎麼選 #日常安排`,
  },
};

function applyKnowledgeCardCopyFix() {
  Object.assign(CARDS.sediment, {
    bullets: ["先攪拌或搖勻", "確認氣味與保存狀況", "有疑問保留包裝再詢問"],
  });
  Object.assign(CARDS.color, {
    bullets: ["不能只看顏色", "要看成分與規格", "保存與製作方式也要確認"],
  });
  Object.assign(CARDS["batch-info"], {
    eyebrow: "收貨篇",
    title: ["收到商品後", "先確認哪些資訊？"],
    bullets: ["先看包裝是否完整", "確認品名規格與期限", "依標示方式妥善保存"],
    mascot: "faq",
  });
  Object.assign(CARDS["support-photos"], {
    bullets: ["完整包裝正反面", "產品名稱與有效日期", "實際內容與保存狀況"],
  });
  Object.assign(CARDS["fair-compare"], {
    eyebrow: "選擇篇",
    title: ["比較產品前", "先了解自己的需求"],
    bullets: ["先看成分與規格", "選擇能融入日常的型態", "依自己的使用習慣決定"],
    mascot: "choose",
  });
  return { version: VERSION, updatedCards: Object.keys(PATCHES).length };
}

function slugFrom(post) {
  const match = String(post?.imageUrl || "").match(/\/knowledge\/(?:v\d+\/)?([^/?]+)\.png/i);
  return match ? match[1] : "";
}

function newImageUrl(slug) {
  return `${APP}/social-assets/knowledge/${IMAGE_PATH_VERSION}/${slug}.png`;
}

function applySocialCopyFix(readStore, writeStore) {
  const store = readStore();
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  let updated = 0;
  let imagesRemoved = 0;
  let imagesRebound = 0;

  for (const post of store.posts) {
    if (post.campaignId !== CAMPAIGN_ID) continue;
    if (["published", "cancelled"].includes(post.status)) continue;
    const slug = slugFrom(post);
    if (!slug || !Object.prototype.hasOwnProperty.call(CARDS, slug)) continue;

    const oldImageUrl = String(post.imageUrl || "");
    const replacementImageUrl = newImageUrl(slug);
    if (oldImageUrl !== replacementImageUrl) {
      post.imageUrl = "";
      imagesRemoved += 1;
      post.imageUrl = replacementImageUrl;
      imagesRebound += 1;
    }

    const patch = PATCHES[slug];
    const next = {};
    if (patch) {
      Object.assign(next, {
        knowledgeTopic: patch.knowledgeTopic,
        title: patch.title,
        instagramCaption: ig(patch.headline, patch.igBody, patch.tags),
        facebookCaption: fb(patch.headline, patch.fbBody, patch.cta || CTA, patch.tags),
      });
    }

    let changed = oldImageUrl !== replacementImageUrl;
    for (const [key, value] of Object.entries(next)) {
      if (post[key] !== value) {
        post[key] = value;
        changed = true;
      }
    }
    if (changed) {
      post.updatedAt = new Date().toISOString();
      updated += 1;
    }
  }

  if (updated) writeStore(store);
  return {
    version: VERSION,
    updated,
    imagesRemoved,
    imagesRebound,
    total: store.posts.length,
    imageVersion: IMAGE_VERSION,
    imagePathVersion: IMAGE_PATH_VERSION,
  };
}

module.exports = {
  VERSION,
  IMAGE_VERSION,
  IMAGE_PATH_VERSION,
  PATCHES,
  applyKnowledgeCardCopyFix,
  applySocialCopyFix,
};