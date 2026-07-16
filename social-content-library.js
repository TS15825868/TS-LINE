"use strict";

const { POSTS: BASE_POSTS, weeklySchedule } = require("./social-draft-library-weekly");

const CAMPAIGN_ID = "xjw-knowledge-202607-v1";
const APP = "https://ts-line.onrender.com";
const IMAGE_VERSION = "6";
const TAGS = "#仙加味 #仙加味小老闆 #龜鹿 #漢方生活 #日常補養 #補養是一種節奏";
const CTA = "有產品、保存或使用方式的問題，可私訊或加入官方 LINE：@762jybnm。";

const ROWS = [
  ["hot-water", "沖泡水溫與持續煮沸", "小老闆知識 01｜沖泡一定要用滾水嗎", "沖泡龜鹿膏、湯塊或龜鹿膠，一定要使用持續滾沸的水嗎？", "使用足夠溫熱、能均勻化開的熱水即可，不必讓產品持續煮滾。先攪拌均勻，再依口味調整水量。", "沖泡的重點是讓內容均勻化開，不需要長時間持續煮沸。可先加入適量熱水攪拌，確認化開後，再依喜歡的濃淡增加水量。", `${TAGS} #沖泡方式`],
  ["cold-texture", "冷藏後質地與乾燥取用", "小老闆知識 02｜冷藏後龜鹿膏變稠怎麼取用", "龜鹿膏冷藏後質地變得較稠，應該怎麼取用？", "使用乾淨、乾燥的湯匙先取需要的份量，再放入杯中用溫熱水慢慢化開，不要把水氣帶回罐內。", "龜鹿膏冷藏後質地可能較稠。取用時，先使用乾淨、乾燥的湯匙取出需要的份量，再放入杯中以溫熱水慢慢化開，並避免把沾水的湯匙放回罐內。", `${TAGS} #龜鹿膏 #取用方式`],
  ["sediment", "沖泡沉澱的確認步驟", "小老闆知識 03｜杯底有少量沉澱怎麼看", "沖泡後杯底看到少量沉澱，先做哪幾個確認？", "先攪拌或搖勻，確認氣味、包裝與保存狀況。沉澱不能只靠外觀判斷；有疑問可保留完整包裝並拍照詢問。", "沖泡後若杯底看到少量沉澱，可先攪拌或搖勻，再確認產品氣味、包裝是否完整，以及之前是否依標示保存。不要只靠外觀判斷；仍有疑問時，可保留完整包裝並拍照詢問。", `${TAGS} #常見問題 #沖泡觀察`],
  ["color", "顏色深淺不能單獨判斷", "小老闆知識 04｜顏色深淺能判斷內容嗎", "顏色比較深，就一定代表原料比較多嗎？", "顏色會受到原料、配料、光線、保存狀況與製作方式影響，不能只用深淺判斷。比較時仍要看完整成分與規格。", "產品顏色可能受到原料、其他配料、拍攝光線、保存狀況及製作方式影響。顏色深淺不能單獨代表內容比例；選擇產品時，仍應回到完整成分、規格與使用方式。", `${TAGS} #選購觀念 #產品資訊`],
  ["serving", "總重量與單次份量分開理解", "小老闆知識 05｜看總重量也要看每次份量", "產品總重量，和每次實際取用的份量，是同一件事嗎？", "總重量是整包、整盒或整罐規格；每次份量則是日常怎麼安排。兩個數字要分開看，才不會只用包裝大小比較。", "總重量代表整罐、整盒或整包的規格；每次取用份量則關係到日常使用方式。選擇產品時，可以同時確認總容量、分裝數量與每次怎麼使用。", `${TAGS} #產品標示 #規格`],
  ["one-format", "同日不必使用所有型態", "小老闆知識 06｜同一天不一定要安排多種型態", "家裡有膏、飲和湯塊，同一天一定都要安排嗎？", "不必為了種類多而全部使用。依當天是在家、外出、沖泡或料理，選一種方便的型態即可。", "產品型態是為了配合不同使用情境，不代表同一天必須全部安排。外出、在家沖泡或準備料理時，可依當天情境選擇一種方便的型態。", `${TAGS} #怎麼選 #日常安排`],
  ["batch-info", "收到商品先確認包裝規格與期限", "小老闆知識 07｜收到商品先確認哪些資訊", "收到商品後，先確認哪些資訊比較安心？", "先確認包裝是否完整，再看產品名稱、規格、有效日期與保存方式。資料看清楚，後續使用會更安心。", "收到產品後，可先確認包裝是否完整、產品名稱與規格是否正確，再查看有效日期與保存方式。外盒可先保留一段時間；如有疑問，拍照聯絡客服會比較容易確認。", `${TAGS} #收貨確認 #保存方式`],
  ["support-photos", "客服確認需要的三類照片", "小老闆知識 08｜詢問產品問題先拍這三張", "向客服詢問產品狀況，拍哪三張照片最有幫助？", "建議拍完整包裝正反面、產品名稱與有效日期，以及實際內容與目前保存狀況。照片清楚完整，客服會更容易確認。", "詢問產品狀況時，建議準備三類照片：完整包裝正反面、產品名稱與有效日期、實際內容物與目前保存狀況。照片盡量清楚並保留整體比例。", `${TAGS} #客服提醒 #產品確認`],
  ["delivery-check", "宅配外箱異常留存資訊", "小老闆知識 09｜宅配外箱破損先怎麼處理", "宅配外箱有壓痕、滲漏或破損，第一步怎麼做？", "先拍外箱六面、物流標籤與內包裝，再確認是否有滲漏或品項受損，保留訂單資料聯絡客服。", "宅配外箱若有明顯壓痕、滲漏或破損，先不要把外箱與物流標籤丟掉。建議拍下外箱六面、物流標籤、內包裝與受影響品項，並保留訂單資料聯絡客服。", `${TAGS} #宅配異常 #客服提醒`],
  ["clean-cup", "容器殘留氣味影響口感", "小老闆知識 10｜杯子殘留味道會影響口感", "同一款產品，為什麼換一個杯子喝起來不一樣？", "咖啡、茶、牛奶或清潔劑殘留，都可能改變氣味與口感。沖泡前先把杯子與保溫壺洗乾淨。", "杯子或保溫壺若殘留咖啡、茶、牛奶或清潔劑氣味，可能讓沖泡後的味道產生差異。沖泡前先確認容器乾淨，再調整水量會比較準確。", `${TAGS} #沖泡細節 #保溫壺`],
  ["soup-balance", "燉湯完成後再調整濃淡", "小老闆知識 11｜燉湯完成後再調整濃淡", "龜鹿湯品一開始就要把所有份量決定好嗎？", "可以先依鍋量少量加入，完成後再試味道、調整熱水或其他食材，不用一次放得很複雜。", "燉湯時可以先看整鍋水量與主要食材，少量加入龜鹿湯塊或龜鹿膠，料理完成後再試味道。覺得濃可增加熱水；覺得淡再依家中習慣調整。", `${TAGS} #料理搭配 #龜鹿湯塊`],
  ["similar-name", "相近品名仍須逐項看內容", "小老闆知識 12｜名稱相近內容仍要逐項看", "產品名稱看起來很像，內容就一定相同嗎？", "名稱相近不代表完整成分、其他配料、規格與使用方式相同。選擇前要逐項看完整標示。", "市場上產品名稱可能很接近，但完整成分、是否加入其他配料、每份規格與使用方式仍可能不同。不要只看品名就判斷相同或不同。", `${TAGS} #產品標示 #選購觀念`],
  ["units", "公克與容量單位不可直接互換", "小老闆知識 13｜g與cc不能只看數字比較", "100g 和 100cc 看起來都是 100，代表的其實一樣嗎？", "g 是重量，cc 是容量。膏、飲、湯塊型態不同，不能只用數字大小直接換算或比較。", "產品標示中的 g 代表重量，cc 代表容量。龜鹿膏、龜鹿飲與湯塊的型態不同，數字相同也不代表份量或使用方式相同。比較前要先確認單位。", `${TAGS} #規格單位 #產品比較`],
  ["pieces-weight", "片數與總重量是兩項資訊", "小老闆知識 14｜片數多不代表總重量比較多", "同樣是塊狀產品，片數比較多就一定代表內容比較多嗎？", "片數是切分方式，總重量是整盒或整包規格。兩個數字要一起看，不能只看幾片。", "塊狀產品切得較小，片數可能較多；切得較大，片數可能較少。片數本身不能代表總重量。比較時應同時確認總重量、片數與每片約重。", `${TAGS} #片數 #總重量`],
  ["taiwan-catty", "台灣一台斤換算六百公克", "小老闆知識 15｜一台斤是多少公克", "看到一斤裝時，先確認是不是台灣常用的台斤。", "在台灣，一台斤通常以 600g 計算。看大規格產品時，可把斤數與公克標示一起確認。", "台灣日常所說的一台斤，通常等於 600g。仙加味龜鹿膠一斤裝即為 600g。比較不同規格時，建議以包裝上的公克數為準。", `${TAGS} #台斤 #規格換算`],
  ["dissolve-speed", "化開速度受多項條件影響", "小老闆知識 16｜化開快慢不能單獨判斷內容", "同一款湯塊，有時化得快、有時比較慢，可能差在哪裡？", "水溫、塊的大小、容器與攪拌方式都會影響化開速度，不能只用快慢判斷內容。", "塊狀產品的化開速度，會受到水溫、每塊大小、是否先切小、容器形狀及攪拌方式影響。先把沖泡條件調整一致，再觀察會比較準確。", `${TAGS} #沖泡方式 #化開速度`],
  ["taste-strength", "味道濃淡不能代表原料多寡", "小老闆知識 17｜味道濃淡不能代表原料多寡", "喝起來味道比較重，就能直接判斷原料比較多嗎？", "味道會受到配料、水量、溫度與個人口感影響。比較內容仍要回到成分與規格。", "產品味道會受到原料、其他配料、沖泡水量、飲用溫度與個人口感影響。味道較重或較淡，都不能單獨代表原料多寡。", `${TAGS} #口感 #選購觀念`],
  ["fair-compare", "依需求選擇適合自己的產品", "小老闆知識 18｜比較產品前先了解自己的需求", "比較產品時，先從自己的需求與使用情境開始。", "每種型態都有不同的使用情境。先看成分、規格與使用方式，再依生活節奏選擇能融入日常的產品。", "龜鹿膏、龜鹿飲、龜鹿湯塊、龜鹿膠與鹿茸粉，各有不同的使用方式。選擇時，先確認偏好的型態、使用時間與日常習慣，再看成分與規格。", `${TAGS} #怎麼選 #日常安排`, "想了解仙加味各產品差異，可直接詢問規格、成分與使用方式。"],
  ["ad-vs-label", "廣告圖片不能取代完整產品標示", "小老闆知識 19｜廣告圖不是完整產品標示", "社群圖片看起來很清楚，為什麼還是要回到包裝標示？", "廣告圖負責整理重點，完整成分、規格、保存與期限仍以實際包裝標示為準。", "社群圖片適合快速整理重點，但不會取代產品包裝上的完整資訊。購買或使用前，仍應確認實際包裝上的品名、成分、規格、保存方式與有效日期。", `${TAGS} #產品標示 #廣告資訊`],
  ["spoon-material", "取用工具乾淨乾燥更重要", "小老闆知識 20｜取用重點是乾淨與乾燥", "龜鹿膏一定要用特定材質的湯匙取用嗎？", "比湯匙材質更重要的是乾淨、乾燥、不沾其他食物，取用後立即密封保存。", "取用龜鹿膏時，不必只糾結木匙或金屬匙。更重要的是湯匙乾淨、乾燥，沒有沾到其他食物或水氣；取出需要的份量後，立即密封並依標示保存。", `${TAGS} #取用方式 #保存細節`],
];

function image(slug) {
  return `${APP}/social-assets/knowledge/${slug}.png?v=${IMAGE_VERSION}`;
}

function ig(headline, body, tags) {
  return [headline, "", body, "", "仙加味小老闆幫你整理", "補養，是一種節奏。", "", tags || TAGS].join("\n");
}

function fb(headline, body, cta, tags) {
  return [headline, "", body, "", "仙加味小老闆幫你整理", "補養，是一種節奏。", "", cta || CTA, "", tags || TAGS].join("\n");
}

const KNOWLEDGE = ROWS.map((row, index) => {
  const [slug, topic, title, headline, igBody, fbBody, tags, cta] = row;
  return {
    campaignId: CAMPAIGN_ID,
    campaignKey: `${CAMPAIGN_ID}-${String(index + 1).padStart(2, "0")}`,
    campaignDay: index + 1,
    knowledgeTopic: topic,
    title,
    imageUrl: image(slug),
    instagramCaption: ig(headline, igBody, tags),
    facebookCaption: fb(headline, fbBody, cta, tags),
    publishInstagram: true,
    publishFacebook: true,
  };
});

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
  let knowledgeIndex = 0;
  base.forEach((item, index) => {
    result.push({ ...item });
    if ((index + 1) % 3 === 0 && knowledgeIndex < knowledge.length) {
      result.push({ ...knowledge[knowledgeIndex] });
      knowledgeIndex += 1;
    }
  });
  while (knowledgeIndex < knowledge.length) {
    result.push({ ...knowledge[knowledgeIndex] });
    knowledgeIndex += 1;
  }
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
      knowledgeTopic: item.knowledgeTopic || existing.knowledgeTopic,
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
  IMAGE_VERSION,
  KNOWLEDGE,
  POSTS,
  normalize,
  fingerprint,
  interleave,
  seedSocialContentLibrary,
};
