"use strict";

const { POSTS: BASE_POSTS, weeklySchedule } = require("./social-draft-library-weekly");

const CAMPAIGN_ID = "xjw-knowledge-202607-v1";
const APP = "https://ts-line.onrender.com";
const TAGS = "#仙加味 #仙加味小老闆 #龜鹿 #漢方生活 #日常補養 #補養是一種節奏";

function image(slug) {
  return `${APP}/social-assets/knowledge/${slug}.png?v=1`;
}

function ig(headline, body, tags = TAGS) {
  return [headline, "", body, "", "仙加味小老闆幫你整理", "補養，是一種節奏。", "", tags].join("\n");
}

function fb(headline, body, cta = "有產品、保存或使用方式的問題，可私訊或加入官方 LINE：@762jybnm。", tags = TAGS) {
  return [headline, "", body, "", "仙加味小老闆幫你整理", "補養，是一種節奏。", "", cta, "", tags].join("\n");
}

const KNOWLEDGE = [
  {
    slug: "hot-water",
    title: "小老闆知識 01｜沖泡一定要用滾水嗎",
    headline: "沖泡龜鹿膏、湯塊或龜鹿膠，一定要用持續滾沸的水嗎？",
    ig: "使用足夠溫熱、能均勻化開的熱水即可，不必讓產品持續煮滾。先攪拌均勻，再依口味增加水量。",
    fb: "沖泡的重點是讓內容均勻化開，不需要把產品長時間放在滾水中持續煮沸。可先加入適量熱水攪拌，確認化開後，再依喜歡的濃淡增加水量。",
    tags: `${TAGS} #沖泡方式`,
  },
  {
    slug: "cold-texture",
    title: "小老闆知識 02｜冷藏後龜鹿膏變稠怎麼取用",
    headline: "龜鹿膏冷藏後質地變得較稠，是不是不能用了？",
    ig: "冷藏後質地較稠時，可用乾燥湯匙先取需要的份量，再加入溫熱水慢慢化開，不要把水氣帶回罐內。",
    fb: "龜鹿膏冷藏後質地變得較稠，取用時可先使用乾淨、乾燥的湯匙取出需要的份量，再放入杯中用溫熱水化開。不要直接把沾水的湯匙放回罐內。",
    tags: `${TAGS} #龜鹿膏 #取用方式`,
  },
  {
    slug: "sediment",
    title: "小老闆知識 03｜杯底有少量沉澱怎麼看",
    headline: "沖泡後杯底看到少量沉澱，先做哪幾個確認？",
    ig: "先攪拌或搖勻，確認氣味、包裝與保存狀況。沉澱不能單靠外觀判斷；有疑問可保留包裝並拍照詢問。",
    fb: "沖泡後若杯底看到少量沉澱，可先攪拌或搖勻，再確認產品氣味、包裝是否完整，以及之前是否依標示保存。不要只靠沉澱外觀判斷品質；仍有疑問時，保留包裝與批號並拍照詢問。",
    tags: `${TAGS} #常見問題 #沖泡觀察`,
  },
  {
    slug: "color",
    title: "小老闆知識 04｜顏色深淺能判斷品質嗎",
    headline: "顏色比較深，就一定代表原料比較多或品質比較好嗎？",
    ig: "顏色會受到原料、配料、批次、光線與製作方式影響，不能只用深淺判斷。比較時仍要看完整成分、規格與保存。",
    fb: "產品顏色可能受到原料、其他配料、批次差異、拍攝光線及製作方式影響。顏色深淺不能單獨代表原料比例或品質；比較產品時，仍應回到完整成分、規格、每次份量與保存方式。",
    tags: `${TAGS} #選購觀念 #產品比較`,
  },
  {
    slug: "serving",
    title: "小老闆知識 05｜看總重量也要看每次份量",
    headline: "產品總重量，和每次實際取用的份量，是同一件事嗎？",
    ig: "總重量是整包或整罐規格；每次份量則是日常怎麼安排。兩個數字要分開看，才不會只用包裝大小比較。",
    fb: "總重量代表整罐、整盒或整包的規格；每次取用份量則關係到日常使用方式。選擇產品時，可以同時確認總容量、分裝數量與每次怎麼使用，不要只看包裝大或小。",
    tags: `${TAGS} #產品標示 #規格`,
  },
  {
    slug: "one-format",
    title: "小老闆知識 06｜同一天不一定要安排多種型態",
    headline: "家裡有膏、飲和湯塊，同一天一定都要安排嗎？",
    ig: "不必為了種類多而全部使用。依當天是在家、外出、沖泡或料理，選一種方便的型態即可。",
    fb: "產品型態是為了配合不同使用情境，不代表同一天必須全部安排。外出可以選即飲；在家可以取用龜鹿膏；準備料理時再使用湯塊。把流程簡化，反而比較容易持續。",
    tags: `${TAGS} #怎麼選 #日常安排`,
  },
  {
    slug: "batch-info",
    title: "小老闆知識 07｜批號與保存資訊先留好",
    headline: "產品開封前，為什麼建議先拍下批號與保存標示？",
    ig: "外盒與標示先不要急著丟，拍下批號、期限與保存方式；日後有問題時，會更容易確認。",
    fb: "收到產品後，可以先拍下外盒上的品名、批號、期限與保存方式。外盒不要在第一次開封時就立刻丟掉；之後若要詢問保存、內容或運送狀況，資料會更完整。",
    tags: `${TAGS} #收貨確認 #保存方式`,
  },
  {
    slug: "support-photos",
    title: "小老闆知識 08｜詢問產品問題先拍這三張",
    headline: "向客服詢問產品狀況，拍哪三張照片最有幫助？",
    ig: "建議拍完整包裝、批號期限，以及實際內容與保存環境。不要只拍局部，客服會更容易判斷。",
    fb: "詢問產品狀況時，建議準備三類照片：完整包裝正反面、批號與有效日期、實際內容物與目前保存狀況。照片盡量清楚並保留整體比例，比只拍局部更容易確認。",
    tags: `${TAGS} #客服提醒 #產品確認`,
  },
  {
    slug: "delivery-check",
    title: "小老闆知識 09｜宅配收到後先做三個確認",
    headline: "宅配到貨後，不要急著拆完就把包裝丟掉。",
    ig: "先看外箱有沒有破損、產品規格是否正確，再依標示放到合適的保存位置。",
    fb: "宅配收到後，可以先確認外箱與內包裝是否完整、品名與規格是否正確，再依產品標示放到陰涼處或冷藏保存。若有滲漏、破損或品項不符，先拍照保留狀況。",
    tags: `${TAGS} #宅配收貨 #保存方式`,
  },
  {
    slug: "clean-cup",
    title: "小老闆知識 10｜杯子殘留味道會影響口感",
    headline: "同一款產品，為什麼換一個杯子喝起來不一樣？",
    ig: "咖啡、茶、牛奶或清潔劑殘留，都可能改變氣味與口感。沖泡前先把杯子與保溫壺洗乾淨。",
    fb: "杯子或保溫壺若殘留咖啡、茶、牛奶或清潔劑氣味，可能讓沖泡後的味道產生差異。沖泡前先確認容器乾淨、沒有其他飲品味道，再調整水量會比較準確。",
    tags: `${TAGS} #沖泡細節 #保溫壺`,
  },
  {
    slug: "soup-balance",
    title: "小老闆知識 11｜燉湯完成後再調整濃淡",
    headline: "龜鹿湯品一開始就要把所有份量決定好嗎？",
    ig: "可以先依鍋量少量加入，完成後再試味道、調整熱水或其他食材，不用一次放得很複雜。",
    fb: "燉湯時可以先看整鍋水量與主要食材，少量加入龜鹿湯塊或龜鹿膠，料理完成後再試味道。覺得濃可增加熱水；覺得淡再依家中習慣調整，不必一開始就放很多配料。",
    tags: `${TAGS} #料理搭配 #龜鹿湯塊`,
  },
  {
    slug: "similar-name",
    title: "小老闆知識 12｜名稱相近配方仍要逐項看",
    headline: "產品名稱看起來很像，內容就一定相同嗎？",
    ig: "名稱相近不代表完整配方、配料比例、規格與使用方式相同。選擇前要逐項看完整標示。",
    fb: "市場上產品名稱可能很接近，但完整成分、是否加入其他配料、每份規格與使用方式仍可能不同。不要只看品名就判斷相同或不同，應逐項閱讀標示與實際內容。",
    tags: `${TAGS} #產品標示 #選購觀念`,
  },
].map((item, index) => ({
  campaignId: CAMPAIGN_ID,
  campaignKey: `${CAMPAIGN_ID}-${String(index + 1).padStart(2, "0")}`,
  campaignDay: index + 1,
  title: item.title,
  imageUrl: image(item.slug),
  instagramCaption: ig(item.headline, item.ig, item.tags),
  facebookCaption: fb(item.headline, item.fb, undefined, item.tags),
  publishInstagram: true,
  publishFacebook: true,
}));

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/(?:30天草稿|長期草稿|小老闆知識)\s*\d+\s*[｜|]/g, "")
    .replace(/[\s，。！？、：；（）()｜|／/・#@\-]/g, "");
}

function fingerprint(post) {
  return normalize(`${post.title}\n${post.instagramCaption}\n${post.facebookCaption}`);
}

function interleave(base, knowledge) {
  const result = [];
  let k = 0;
  base.forEach((item, index) => {
    result.push({ ...item });
    if ((index + 1) % 5 === 0 && k < knowledge.length) result.push({ ...knowledge[k++] });
  });
  while (k < knowledge.length) result.push({ ...knowledge[k++] });
  return result.map((item, index) => ({ ...item, scheduledAt: weeklySchedule(index) }));
}

const POSTS = interleave(BASE_POSTS, KNOWLEDGE);

function seedSocialContentLibrary(readStore, writeStore) {
  const store = readStore();
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  const byKey = new Map(store.posts.map((post) => [post.campaignKey, post]));
  const existingFingerprints = new Set(store.posts.map(fingerprint).filter((value) => value.length > 80));
  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;
  let skippedDuplicate = 0;
  let preserved = 0;

  for (const item of POSTS) {
    const existing = byKey.get(item.campaignKey);
    if (!existing) {
      const fp = fingerprint(item);
      if (existingFingerprints.has(fp)) {
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
      existingFingerprints.add(fp);
      added += 1;
      continue;
    }

    if (["published", "cancelled", "failed", "partial", "publishing"].includes(existing.status)) {
      preserved += 1;
      continue;
    }

    Object.assign(existing, {
      campaignId: item.campaignId || existing.campaignId,
      campaignDay: item.campaignDay,
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
    campaignId: CAMPAIGN_ID,
    cadence: "每兩週3篇：第一週週五；第二週週三、週五；晚上8:00",
    timezone: "Asia/Taipei",
    added,
    updated,
    skippedDuplicate,
    preserved,
    total: POSTS.length,
    knowledgeTotal: KNOWLEDGE.length,
    firstAt: POSTS[0]?.scheduledAt,
    lastAt: POSTS.at(-1)?.scheduledAt,
  };
}

module.exports = {
  CAMPAIGN_ID,
  KNOWLEDGE,
  POSTS,
  normalize,
  fingerprint,
  interleave,
  seedSocialContentLibrary,
};
