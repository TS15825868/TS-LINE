"use strict";

const CAMPAIGN_ID = "xjw-30day-202607-v2";
const SITE = "https://ts15825868.github.io/xianjiawei/";
const START_AT = "2026-07-20T20:30:00+08:00";

const IMAGES = {
  gao: `${SITE}images/dm-final/01_guilu-gao-100g-dm.jpg?v=408.7`,
  drink30: `${SITE}images/dm-final/02_guilu-drink-30cc-dm.jpg?v=408.7`,
  drink180: `${SITE}images/dm-final/03_guilu-drink-180cc-dm.jpg?v=408.7`,
  powder: `${SITE}images/dm-final/04_luerong-fen-75g-dm.jpg?v=408.7`,
  soup: `${SITE}images/dm-final/05_guilu-tangkuai-75g-dm.jpg?v=408.7`,
  jiao: `${SITE}images/dm-final/06_guilu-jiao-600g-dm.jpg?v=408.7`,
};

const BRAND_TAGS = "#仙加味 #龜鹿 #漢方生活 #日常補養 #補養是一種節奏";

function scheduleFor(index) {
  const date = new Date(START_AT);
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString();
}

function igCaption(headline, body, tags = BRAND_TAGS) {
  return [
    headline,
    "",
    body,
    "",
    "仙加味・龜鹿",
    "補養，是一種節奏。",
    "",
    tags,
  ].join("\n");
}

function fbCaption(headline, body, cta = "想了解產品、成分或使用方式，可直接私訊或加入官方 LINE 詢問。", tags = BRAND_TAGS) {
  return [
    headline,
    "",
    body,
    "",
    "仙加味・龜鹿",
    "補養，是一種節奏。",
    "",
    cta,
    "",
    tags,
  ].join("\n");
}

const CONTENT = [
  {
    title: "30天草稿 01｜補養，是一種可以慢慢建立的節奏",
    image: "gao",
    headline: "補養，不一定要等到很累才開始。",
    ig: "從日常作息、飲食習慣與適合自己的份量開始，慢慢建立能持續的安排。",
    fb: "日常補養不是一次吃很多，也不是臨時想到才安排。從自己容易持續的時間、份量與產品型態開始，慢慢形成固定節奏，通常比追求複雜更實在。",
  },
  {
    title: "30天草稿 02｜龜鹿產品怎麼選",
    image: "gao",
    headline: "龜鹿膏、龜鹿飲、湯塊與龜鹿膠，差別在哪裡？",
    ig: "膏適合固定取用；飲適合即飲；湯塊適合沖泡與料理；龜鹿膠適合家庭大規格安排。",
    fb: "不同產品不是誰比較好，而是使用情境不同。龜鹿膏適合小匙取用或熱水化開；龜鹿飲適合方便即飲；湯塊適合沖泡、保溫壺與燉湯；龜鹿膠則是家庭大規格。先想清楚自己平常會怎麼用，更容易選對。",
  },
  {
    title: "30天草稿 03｜龜鹿膏日常使用方式",
    image: "gao",
    headline: "龜鹿膏，可以直接取用，也可以熱水化開。",
    ig: "每次取 1～2 小匙，可依個人習慣直接食用，或加入約 100～300mL 熱水化開。",
    fb: "仙加味龜鹿膏為 100g 小罐設計。每次可取 1～2 小匙，直接取用，或加入約 100～300mL 熱水化開，調整到適合入口的溫度。可依自己的作息安排在早上或下午。",
    tags: `${BRAND_TAGS} #龜鹿膏`,
  },
  {
    title: "30天草稿 04｜30cc龜鹿飲的方便",
    image: "drink30",
    headline: "忙碌的日子，也能留下一個簡單的安排。",
    ig: "30cc 玻璃小瓶，開瓶即可飲用，也可依個人習慣溫熱後飲用。",
    fb: "龜鹿飲 30cc 玻璃小瓶，適合外出攜帶、工作空檔或想快速安排的人。開瓶即可飲用，也可依個人習慣稍微溫熱後飲用。",
    tags: `${BRAND_TAGS} #龜鹿飲`,
  },
  {
    title: "30天草稿 05｜180cc龜鹿飲的居家安排",
    image: "drink180",
    headline: "偏好一次較完整份量，可以選擇 180cc 鋁袋。",
    ig: "適合居家、工作空檔，或偏好一次飲用較完整份量的人。",
    fb: "龜鹿飲 180cc 鋁袋，撕開即可飲用，也可依習慣溫熱。適合居家安排、工作空檔，或想一次準備較完整飲用份量的人。",
    tags: `${BRAND_TAGS} #龜鹿飲`,
  },
  {
    title: "30天草稿 06｜湯塊熱水沖泡",
    image: "soup",
    headline: "一塊龜鹿湯塊，加熱水也能很簡單。",
    ig: "取 1 塊加入約 300～500mL 熱水，可直接沖泡，也可放入保溫壺悶泡。",
    fb: "龜鹿湯塊不一定只能燉湯。取 1 塊加入約 300～500mL 熱水，可直接沖泡，也可放進保溫壺悶泡，依個人口味調整濃淡。",
    tags: `${BRAND_TAGS} #龜鹿湯塊`,
  },
  {
    title: "30天草稿 07｜湯塊加入家常料理",
    image: "soup",
    headline: "把龜鹿湯塊放進家常湯品，也是一種日常安排。",
    ig: "可搭配雞湯、排骨湯，也可依口味加入紅棗、枸杞等食材。",
    fb: "龜鹿湯塊可加入雞湯、排骨湯等家常湯品一起燉煮，也能依個人口味搭配紅棗、枸杞等食材。把補養放回餐桌，不需要另外準備複雜流程。",
    tags: `${BRAND_TAGS} #龜鹿湯塊 #料理搭配`,
  },
  {
    title: "30天草稿 08｜龜鹿膠家庭大規格",
    image: "jiao",
    headline: "熟悉龜鹿產品、需要家庭大規格，可以了解龜鹿膠。",
    ig: "600g 一斤裝，適合固定備用、家庭安排、熱水化開或燉湯。",
    fb: "龜鹿膠為 600g 一斤裝、32 塊設計，每塊約 18.75g。適合熟悉龜鹿產品、偏好家庭大規格、固定備用，或想用於熱水化開與燉湯的人。",
    tags: `${BRAND_TAGS} #龜鹿膠`,
  },
  {
    title: "30天草稿 09｜鹿茸粉怎麼搭",
    image: "powder",
    headline: "鹿茸粉的優點，是可以依自己的飲用習慣安排。",
    ig: "取適量加入溫開水、牛奶、豆漿或其他飲品，攪拌均勻後飲用。",
    fb: "鹿茸粉可依個人需求取適量，加入溫開水、牛奶、豆漿或其他飲品中攪拌均勻。第一次接觸時，可先從少量開始，再依自己的飲食習慣調整。",
    tags: `${BRAND_TAGS} #鹿茸粉`,
  },
  {
    title: "30天草稿 10｜看產品先看原料與內容",
    image: "jiao",
    headline: "選擇龜鹿產品，不要只看外型。",
    ig: "真正值得了解的是：用了哪些原料、是否有其他配料、規格與每次使用方式。",
    fb: "膏、飲、湯塊與膠只是不同呈現方式。選擇前，更值得了解的是實際使用哪些原料、是否加入其他配料、每份規格，以及平常要怎麼安排。",
  },
  {
    title: "30天草稿 11｜龜鹿膏只能冬天吃嗎",
    image: "gao",
    headline: "龜鹿膏只能冬天吃嗎？",
    ig: "產品型態不能直接代表季節。更重要的是原料、配料比例、每次份量與自己的飲食習慣。",
    fb: "仙加味不會只用產品型態判斷季節。天氣較熱時，可以從少量開始，安排在早上或下午；天氣較冷時，也可依平常習慣安排。重點仍是看清楚成分、份量與自己的生活節奏。",
    tags: `${BRAND_TAGS} #龜鹿膏`,
  },
  {
    title: "30天草稿 12｜為什麼建議早上或下午",
    image: "gao",
    headline: "固定安排，比臨時想到更容易持續。",
    ig: "可依日常作息安排在早上或下午，避開太接近睡前，也比較容易記得。",
    fb: "仙加味建議把龜鹿膏等日常安排放在早上或下午，不是要把時間規定得很死，而是比較容易融入用餐、工作與休息節奏，也能避免太接近睡前。",
  },
  {
    title: "30天草稿 13｜溫熱飲用的日常感",
    image: "drink30",
    headline: "有些日常，就是留一杯溫熱給自己。",
    ig: "龜鹿飲可直接飲用，也可依習慣溫熱後飲用。",
    fb: "忙碌時不一定要把補養安排得很複雜。龜鹿飲可以直接飲用，也能依個人習慣稍微溫熱，讓日常多一個容易做到的小節奏。",
    tags: `${BRAND_TAGS} #龜鹿飲`,
  },
  {
    title: "30天草稿 14｜第一次接觸從少量開始",
    image: "gao",
    headline: "第一次接觸，不需要一次安排很多。",
    ig: "先從少量開始，觀察自己的飲食習慣與接受度，再調整適合的份量。",
    fb: "每個人的作息、飲食與接受度不同。第一次接觸龜鹿產品時，可以先從少量開始，找到自己容易持續、也方便安排的使用方式。",
  },
  {
    title: "30天草稿 15｜龜鹿膏與龜鹿飲差別",
    image: "gao",
    headline: "龜鹿膏與龜鹿飲，主要差在使用情境。",
    ig: "膏適合固定取用與熱水化開；飲適合開瓶即飲與外出攜帶。",
    fb: "龜鹿膏與龜鹿飲的成分方向相近，但型態不同。膏適合喜歡小匙取用、固定安排的人；飲適合外出、工作空檔或偏好開瓶即飲的人。",
  },
  {
    title: "30天草稿 16｜湯塊與龜鹿膠差別",
    image: "soup",
    headline: "龜鹿湯塊與龜鹿膠，差在包裝與規格。",
    ig: "湯塊是 75g 小盒裝；龜鹿膠是 600g 一斤家庭大規格。兩者都可沖泡或加入湯品。",
    fb: "龜鹿湯塊為 75g、8 塊小盒裝，適合方便沖泡與料理；龜鹿膠為 600g 一斤裝，適合家庭固定備用。兩者都能用熱水化開，也可加入雞湯或排骨湯。",
  },
  {
    title: "30天草稿 17｜日常補養不是衝刺",
    image: "gao",
    headline: "日常補養，不是短時間的衝刺。",
    ig: "找到適合自己的產品型態、份量與時間，慢慢固定下來。",
    fb: "與其一次安排很多，不如先找到自己每天或每週容易做到的方式。產品型態、份量與時間都可以依生活調整，能夠持續才是比較實在的選擇。",
  },
  {
    title: "30天草稿 18｜外出時怎麼選",
    image: "drink30",
    headline: "外出、上班或需要隨身攜帶，可以從龜鹿飲開始了解。",
    ig: "30cc 玻璃小瓶輕巧即飲；180cc 鋁袋適合偏好較完整飲用份量的人。",
    fb: "外出安排最重要的是方便。30cc 玻璃小瓶適合輕巧攜帶；180cc 鋁袋適合偏好一次較完整份量的人。可依自己的包包空間與飲用習慣選擇。",
    tags: `${BRAND_TAGS} #龜鹿飲`,
  },
  {
    title: "30天草稿 19｜家庭共用怎麼選",
    image: "jiao",
    headline: "家庭固定備用，可以從大規格與料理方式來選。",
    ig: "龜鹿膠適合家庭大規格；龜鹿湯塊則適合小盒分次沖泡或燉湯。",
    fb: "家庭共用時，可以先考慮使用頻率與料理方式。龜鹿膠是一斤大規格，適合固定備用；龜鹿湯塊是 75g 小盒裝，適合分次沖泡、保溫壺或燉湯。",
  },
  {
    title: "30天草稿 20｜保溫壺沖泡",
    image: "soup",
    headline: "保溫壺，也能成為龜鹿湯塊的簡單用法。",
    ig: "取 1 塊加入熱水，放入保溫壺悶泡，依個人口味調整水量。",
    fb: "不方便開火時，可取 1 塊龜鹿湯塊加入約 300～500mL 熱水，放進保溫壺悶泡。水量可依個人口味調整，讓使用方式更貼近日常。",
    tags: `${BRAND_TAGS} #龜鹿湯塊`,
  },
  {
    title: "30天草稿 21｜龜鹿雞湯",
    image: "soup",
    headline: "今晚，來一鍋熱熱的龜鹿雞湯。",
    ig: "雞肉、龜鹿湯塊與適量紅棗枸杞，一起慢慢燉煮。",
    fb: "準備雞肉、龜鹿湯塊，可依口味加入紅棗與枸杞，加入適量清水一起燉煮。鹹淡與食材可依家中習慣調整，把龜鹿產品自然放進一餐。",
    tags: `${BRAND_TAGS} #龜鹿湯塊 #雞湯`,
  },
  {
    title: "30天草稿 22｜龜鹿排骨湯",
    image: "soup",
    headline: "家常排骨湯，也可以加入龜鹿湯塊。",
    ig: "搭配排骨、薑片與喜歡的食材，依照平常燉湯方式料理即可。",
    fb: "龜鹿湯塊可加入排骨湯一起燉煮。搭配薑片、紅棗、枸杞或家中習慣的食材，依平常的湯品料理方式調整即可。",
    tags: `${BRAND_TAGS} #龜鹿湯塊 #排骨湯`,
  },
  {
    title: "30天草稿 23｜產品保存方式",
    image: "gao",
    headline: "產品保存做對，日常取用才更安心。",
    ig: "未開封置於陰涼乾燥處，避免高溫與日光直射；開封後依產品標示妥善保存。",
    fb: "未開封產品請置於陰涼乾燥處，避免高溫與日光直射。龜鹿膏開封後請密封冷藏並使用乾淨湯匙；飲品開封後請儘速飲用；湯塊、龜鹿膠與鹿茸粉也應保持乾燥並妥善密封。",
  },
  {
    title: "30天草稿 24｜開封後的小提醒",
    image: "gao",
    headline: "每次取用前，多一個小動作，保存更穩定。",
    ig: "使用乾淨、乾燥的湯匙取用龜鹿膏，取用後立即密封冷藏。",
    fb: "龜鹿膏開封後，建議使用乾淨、乾燥的湯匙取用，避免水氣或食物殘留進入罐內。每次取用後立即密封冷藏，並依產品標示期限食用。",
    tags: `${BRAND_TAGS} #龜鹿膏 #保存方式`,
  },
  {
    title: "30天草稿 25｜口感濃淡可以調整",
    image: "gao",
    headline: "覺得味道太濃，可以從水量與份量調整。",
    ig: "龜鹿膏、湯塊或龜鹿膠加入熱水時，可依自己的口味增加水量。",
    fb: "每個人對味道的接受度不同。龜鹿膏、湯塊或龜鹿膠用熱水化開時，可以先從少量產品開始，再依個人口味增加水量，不需要勉強喝得過濃。",
  },
  {
    title: "30天草稿 26｜熱水化開有泡沫正常嗎",
    image: "jiao",
    headline: "熱水化開時出現少量泡沫，不一定代表產品異常。",
    ig: "攪拌、倒水速度、蛋白質與膠質成分都可能讓表面暫時出現泡沫。可先靜置觀察。",
    fb: "龜鹿膠或湯塊遇熱水化開時，攪拌方式、倒水速度，以及原料中的蛋白質與膠質成分，都可能讓表面暫時出現泡沫。可先靜置觀察；若同時出現明顯異味、包裝膨脹或保存異常，則先停止使用並向店家確認。",
    tags: `${BRAND_TAGS} #龜鹿膠 #常見問題`,
  },
  {
    title: "30天草稿 27｜成分透明比話術重要",
    image: "gao",
    headline: "我們更希望把成分與使用方式說清楚。",
    ig: "看得懂原料、規格、使用方式與保存方法，才比較容易做出適合自己的選擇。",
    fb: "仙加味不以誇大的說法取代產品資訊。我們希望把成分、規格、使用方式與保存方法整理清楚，讓每個人能依自己的日常情境做選擇。",
  },
  {
    title: "30天草稿 28｜外型不能代表原料比例",
    image: "jiao",
    headline: "產品做成膏、飲或塊狀，不代表原料比例高低。",
    ig: "產品型態只是呈現方式，不能只靠柔軟、濃稠或顏色判斷實際內容。",
    fb: "膏狀、液態或塊狀，是為了不同使用情境而設計。柔軟、濃稠、顏色深淺或入口方式，都不能單獨代表原料比例。選擇時仍應回到成分、規格與實際內容。",
  },
  {
    title: "30天草稿 29｜不知道怎麼選可以先說使用情境",
    image: "drink30",
    headline: "不知道怎麼選，不用先記住所有產品差別。",
    ig: "告訴我們你偏好直接吃、即飲、沖泡、燉湯，或家庭大規格，就能先縮小選擇。",
    fb: "詢問產品時，可以直接告訴我們：平常想直接取用、開瓶即飲、用熱水沖泡、加入湯品，還是需要家庭大規格。從使用情境開始，比只看產品名稱更容易選擇。",
    cta: "可直接加入仙加味官方 LINE：@762jybnm，留下想了解的產品與使用方式。",
  },
  {
    title: "30天草稿 30｜全系列整理",
    image: "gao",
    headline: "仙加味・龜鹿全系列，找到適合自己的日常方式。",
    ig: "龜鹿膏固定取用、龜鹿飲方便即飲、湯塊沖泡料理、龜鹿膠家庭大規格、鹿茸粉彈性搭配。",
    fb: "仙加味目前以不同型態整理龜鹿與鹿茸產品：龜鹿膏適合固定取用；龜鹿飲適合方便即飲；湯塊適合沖泡與料理；龜鹿膠適合家庭大規格；鹿茸粉則可依飲品彈性搭配。沒有唯一答案，重點是找到適合自己的節奏。",
    cta: "想比較產品差異，可直接私訊或加入官方 LINE：@762jybnm。",
  },
];

const POSTS = CONTENT.map((item, index) => ({
  campaignKey: `${CAMPAIGN_ID}-${String(index + 1).padStart(2, "0")}`,
  campaignDay: index + 1,
  title: item.title,
  imageUrl: IMAGES[item.image],
  instagramCaption: igCaption(item.headline, item.ig, item.tags || BRAND_TAGS),
  facebookCaption: fbCaption(item.headline, item.fb, item.cta, item.tags || BRAND_TAGS),
  scheduledAt: scheduleFor(index),
  publishInstagram: true,
  publishFacebook: true,
}));

function seedSocialDraftLibrary(readStore, writeStore) {
  const store = readStore();
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  const existing = new Set(store.posts.map((post) => post.campaignKey).filter(Boolean));
  const createdAt = new Date().toISOString();
  let added = 0;

  for (const item of POSTS) {
    if (existing.has(item.campaignKey)) continue;
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
  }

  if (added) writeStore(store);
  return { campaignId: CAMPAIGN_ID, added, total: POSTS.length };
}

module.exports = {
  CAMPAIGN_ID,
  POSTS,
  seedSocialDraftLibrary,
};
