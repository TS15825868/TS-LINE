"use strict";

const POSTS = [
  {
    id: "first-batch-v2-care-work-rest-20260729",
    topicKey: "care-work-rest",
    sequenceRole: "care",
    category: "日常關心",
    title: "工作再忙，也別忘了休息一下",
    scheduledAt: "2026-07-24T02:00:00.000Z",
    manualScheduleOverride: true,
    imageName: "care-work-rest.jpg",
    sourceImageFile: "634CBEF9-5A29-44EE-BFFC-AA5DDB8C049B.PNG",
    correctedClearRepublish: true,
    qBossMascotLocked: true,
    deerPartnerPresent: true,
    turtlePartnerPresent: true,
    instagramCaption: [
      "工作一忙，很容易連喝水和休息都忘了。",
      "",
      "久坐一段時間，可以起身伸展一下；手邊放杯水，也替忙碌中的自己留一點喘息時間。",
      "",
      "照顧自己，不必一次改變很多。從一個簡單的小習慣開始，把日常節奏慢慢放穩。",
      "",
      "#仙加味 #仙加味小老闆 #日常關心 #工作日常 #記得休息",
    ].join("\n"),
    facebookCaption: [
      "工作再忙，也別忘了休息一下。",
      "",
      "久坐後起身伸展、記得補充水分，也替自己留一點喘息時間。照顧日常，不必一次改變很多，從一個簡單的小動作開始就很好。",
      "",
      "#仙加味 #日常關心 #記得休息",
    ].join("\n"),
  },
  {
    id: "first-batch-v3-product-guilu-gao-20260729",
    topicKey: "product-guilu-gao-100g",
    sequenceRole: "product",
    category: "產品介紹",
    title: "龜鹿膏100g｜依日常節奏慢慢安排",
    scheduledAt: "2026-07-29T02:00:00.000Z",
    imageName: "product-guilu-gao-100g.jpg",
    sourceImageFile: "product-guilu-gao-100g.webp",
    qBossMascotLocked: true,
    deerPartnerPresent: true,
    turtlePartnerPresent: true,
    productPresentationLocked: true,
    productSpecLocked: true,
    instagramCaption: [
      "仙加味・龜鹿膏為膏狀型態，規格是100g／罐。",
      "",
      "可依產品標示取用，也可用熱水化開後調至適合入口的溫度。第一次安排不用急，先從自己容易記得、做得到的節奏開始。",
      "",
      "開罐後請依包裝標示冷藏保存。",
      "",
      "#仙加味 #龜鹿膏 #100g #使用小提醒 #日常補養",
    ].join("\n"),
    facebookCaption: [
      "龜鹿膏100g，可依自己的日常節奏安排。",
      "",
      "可依產品標示取用，也可用熱水化開後調至適合入口的溫度。把時間放在自己容易記得的時段，日常安排會更順手；開罐後請依包裝標示冷藏保存。",
      "",
      "#仙加味 #龜鹿膏 #100g",
    ].join("\n"),
  },
  {
    id: "first-batch-v3-care-family-20260731",
    topicKey: "care-family",
    sequenceRole: "care",
    category: "日常關心",
    title: "照顧自己，也別忘了關心家人",
    scheduledAt: "2026-07-31T02:00:00.000Z",
    imageName: "care-family.jpg",
    sourceImageFile: "care-family.avif",
    qBossMascotLocked: true,
    deerPartnerPresent: true,
    turtlePartnerPresent: true,
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
    id: "first-batch-v3-product-guilu-drink-combined-20260805",
    topicKey: "product-guilu-drink-30-180",
    sequenceRole: "product",
    category: "產品介紹",
    title: "龜鹿飲30cc／180cc｜依外出與居家情境選擇",
    scheduledAt: "2026-08-05T02:00:00.000Z",
    imageName: "product-guilu-drink-combined.jpg",
    sourceImageFile: "product-guilu-drink-30cc.webp + product-guilu-drink-180cc.webp",
    qBossMascotLocked: true,
    deerPartnerPresent: true,
    turtlePartnerPresent: true,
    productPresentationLocked: true,
    productSpecLocked: true,
    instagramCaption: [
      "龜鹿飲有兩種包裝：30cc玻璃小瓶與180cc鋁袋。",
      "",
      "30cc份量輕巧，適合外出攜帶或工作空檔；180cc適合居家或偏好一次安排完整份量。兩種皆可依個人習慣溫熱後飲用。",
      "",
      "開封後請儘速飲用完畢，保存與飲用方式以包裝標示為準。",
      "",
      "#仙加味 #龜鹿飲 #30cc #180cc #日常安排",
    ].join("\n"),
    facebookCaption: [
      "龜鹿飲可依生活情境選擇30cc玻璃小瓶或180cc鋁袋。",
      "",
      "30cc適合外出攜帶；180cc適合居家安排。兩種包裝都可依個人習慣溫熱後飲用，開封後請儘速飲用完畢。",
      "",
      "#仙加味 #龜鹿飲 #30cc #180cc",
    ].join("\n"),
  },
  {
    id: "first-batch-v3-care-temperature-gap",
    topicKey: "weather-temperature-gap",
    sequenceRole: "care",
    category: "氣候關心",
    title: "早晚溫差大，出門多帶一件薄外套",
    scheduledAt: "",
    imageName: "care-temperature-gap.jpg",
    sourceImageFile: "care-temperature-gap.avif",
    weatherTrigger: "temperature-gap",
    conditionalWeather: true,
    automationStandby: true,
    qBossMascotLocked: true,
    deerPartnerPresent: true,
    turtlePartnerPresent: true,
    instagramCaption: [
      "早晚或室內外溫差明顯時，出門可以多帶一件薄外套。",
      "",
      "依當下溫度調整穿著，忙碌的一天也記得留一點休息時間，讓日常更從容。",
      "",
      "慢慢照顧自己，日常更安心。",
      "",
      "#仙加味 #氣候關心 #溫差提醒 #照顧自己",
    ].join("\n"),
    facebookCaption: [
      "遇到早晚或室內外溫差較大時，出門可以多帶一件薄外套。",
      "",
      "依當下感受調整穿著，忙碌中也記得休息一下。小小的準備，就能讓一天的安排更從容。",
      "",
      "#仙加味 #溫差提醒 #氣候關心",
    ].join("\n"),
  },
  {
    id: "first-batch-v3-product-lurongfen-20260807",
    topicKey: "product-lurongfen-75g",
    sequenceRole: "product",
    category: "產品介紹",
    title: "鹿茸粉75g｜依自己的飲食習慣搭配",
    scheduledAt: "2026-08-07T02:00:00.000Z",
    imageName: "product-lurongfen-75g.jpg",
    sourceImageFile: "product-luerong-fen-75g.webp",
    qBossMascotLocked: true,
    deerPartnerPresent: true,
    turtlePartnerPresent: true,
    productPresentationLocked: true,
    productSpecLocked: true,
    instagramCaption: [
      "仙加味・鹿茸粉規格為75g／罐，成分為鹿茸。",
      "",
      "可取適量加入溫開水、牛奶、豆漿或其他飲品中攪拌均勻。初次安排可從少量開始，再依自己的飲食習慣調整。",
      "",
      "開封後請密封保存並儘早食用完畢。",
      "",
      "#仙加味 #鹿茸粉 #75g #飲品搭配 #使用小提醒",
    ].join("\n"),
    facebookCaption: [
      "鹿茸粉75g可依自己的飲食習慣，加入溫開水、牛奶、豆漿或其他飲品中攪拌均勻。",
      "",
      "初次安排可從少量開始；開封後請密封保存並儘早食用完畢，實際使用與保存仍以包裝標示為準。",
      "",
      "#仙加味 #鹿茸粉 #75g",
    ].join("\n"),
  },
  {
    id: "first-batch-v3-care-hot-hydration",
    topicKey: "weather-hot-hydration",
    sequenceRole: "care",
    category: "氣候關心",
    title: "天氣炎熱，記得分次補充水分",
    scheduledAt: "",
    imageName: "care-hot-hydration.jpg",
    sourceImageFile: "care-hydration.avif",
    weatherTrigger: "hot",
    conditionalWeather: true,
    automationStandby: true,
    qBossMascotLocked: true,
    deerPartnerPresent: true,
    turtlePartnerPresent: true,
    instagramCaption: [
      "天氣炎熱時，水瓶可以放在看得到、拿得到的地方。",
      "",
      "外出記得帶水，不必等到很渴才喝；忙碌中也替自己安排幾次補充水分與休息的時間。",
      "",
      "照顧自己，也照顧家人。",
      "",
      "#仙加味 #氣候關心 #炎熱提醒 #補充水分",
    ].join("\n"),
    facebookCaption: [
      "天氣熱的時候，記得把補充水分放進日常安排。",
      "",
      "外出帶水瓶、分次飲用，忙碌時也別忘了休息一下。這個簡單提醒，也可以分享給身邊的家人。",
      "",
      "#仙加味 #炎熱提醒 #補充水分",
    ].join("\n"),
  },
  {
    id: "first-batch-v3-product-tangkuai-20260812",
    topicKey: "product-tangkuai-75g",
    sequenceRole: "product",
    category: "產品介紹",
    title: "龜鹿湯塊75g｜8塊裝，沖泡料理都方便",
    scheduledAt: "2026-08-12T02:00:00.000Z",
    imageName: "product-guilu-tangkuai-75g.jpg",
    sourceImageFile: "product-guilu-tangkuai-75g.webp",
    qBossMascotLocked: true,
    deerPartnerPresent: true,
    turtlePartnerPresent: true,
    productPresentationLocked: true,
    productSpecLocked: true,
    instagramCaption: [
      "仙加味・龜鹿湯塊75g為每盒8塊裝，成分為龜板萃取物與鹿角萃取物。",
      "",
      "可依產品標示加入約300～500ml熱水沖泡，也能搭配雞湯、排骨湯等家常料理。",
      "",
      "保存與使用方式請以包裝標示為準。",
      "",
      "#仙加味 #龜鹿湯塊 #75g #8塊裝 #沖泡料理",
    ].join("\n"),
    facebookCaption: [
      "龜鹿湯塊75g為8塊裝，適合熱水沖泡或搭配家常料理。",
      "",
      "可依產品標示加入約300～500ml熱水，也能搭配雞湯、排骨湯。實際保存與使用方式請以包裝標示為準。",
      "",
      "#仙加味 #龜鹿湯塊 #75g",
    ].join("\n"),
  },
  {
    id: "first-batch-v3-care-rainy-day",
    topicKey: "weather-rainy-day",
    sequenceRole: "care",
    category: "氣候關心",
    title: "下雨天在家，也別忘了留一點暖暖的時間",
    scheduledAt: "",
    imageName: "care-rainy-day.jpg",
    sourceImageFile: "care-rainy-day.avif",
    weatherTrigger: "rain",
    conditionalWeather: true,
    automationStandby: true,
    qBossMascotLocked: true,
    deerPartnerPresent: true,
    turtlePartnerPresent: true,
    instagramCaption: [
      "下雨天待在家，可以替自己留一點慢下來的時間。",
      "",
      "泡一杯溫熱飲品、簡單整理餐桌，或和家人坐下來聊聊天，讓日常多一點溫度。",
      "",
      "天氣有變化，也記得照顧自己與身邊的人。",
      "",
      "#仙加味 #氣候關心 #下雨天 #溫暖時光",
    ].join("\n"),
    facebookCaption: [
      "下雨天在家，不妨替自己留一點暖暖的時間。",
      "",
      "泡杯溫熱飲品、把步調放慢，或陪家人聊聊天。照顧日常，有時就是從這些簡單的小事開始。",
      "",
      "#仙加味 #下雨天 #氣候關心",
    ].join("\n"),
  },
  {
    id: "first-batch-v3-product-guilu-jiao-20260814",
    topicKey: "product-guilu-jiao-600g",
    sequenceRole: "product",
    category: "產品介紹",
    title: "龜鹿膠600g｜32塊家庭規格，固定準備更從容",
    scheduledAt: "2026-08-14T02:00:00.000Z",
    imageName: "product-guilu-jiao-600g.jpg",
    sourceImageFile: "product-guilu-jiao-600g.webp",
    qBossMascotLocked: true,
    deerPartnerPresent: true,
    turtlePartnerPresent: true,
    productPresentationLocked: true,
    productSpecLocked: true,
    instagramCaption: [
      "仙加味・龜鹿膠規格為600g／盒，共32塊，每塊約18.75g。",
      "",
      "可依產品標示加入約300～500ml熱水化開，也能搭配家常料理。家庭規格適合先確認保存空間與使用節奏，再固定準備。",
      "",
      "#仙加味 #龜鹿膠 #600g #32塊裝 #家庭規格",
    ].join("\n"),
    facebookCaption: [
      "龜鹿膠600g為32塊家庭規格，每塊約18.75g。",
      "",
      "可依產品標示加入約300～500ml熱水化開，也能搭配家常料理。實際保存與使用方式請以包裝標示為準。",
      "",
      "#仙加味 #龜鹿膠 #600g",
    ].join("\n"),
  },
];

function normalizeForDuplicateCheck(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/#[^\s#]+/g, "")
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .toLowerCase();
}

function assertUnique(posts, key, label, normalizer = (value) => String(value || "")) {
  const seen = new Map();
  for (const post of posts) {
    const value = normalizer(post[key]);
    if (!value) throw new Error(`${label}不可為空：${post.id}`);
    if (seen.has(value)) throw new Error(`${label}重複：${seen.get(value)}／${post.id}`);
    seen.set(value, post.id);
  }
}

function validatePosts(posts = POSTS) {
  if (posts.length !== 10) throw new Error(`第一批正式貼文必須是10篇，目前為${posts.length}篇`);
  assertUnique(posts, "id", "貼文ID");
  assertUnique(posts, "topicKey", "主題");
  assertUnique(posts, "title", "標題", normalizeForDuplicateCheck);
  assertUnique(posts, "imageName", "圖片");
  assertUnique(posts, "instagramCaption", "Instagram文案", normalizeForDuplicateCheck);
  assertUnique(posts, "facebookCaption", "Facebook文案", normalizeForDuplicateCheck);

  const fixed = posts.filter((post) => !post.conditionalWeather);
  const weather = posts.filter((post) => post.conditionalWeather);
  if (fixed.length !== 7 || weather.length !== 3) throw new Error("第一批必須包含7篇固定貼文與3篇氣候條件貼文");
  assertUnique(fixed, "scheduledAt", "固定排程時間");
  if (weather.some((post) => post.scheduledAt)) throw new Error("氣候條件貼文不可預先排固定日期");
  if (weather.some((post) => !post.weatherTrigger || post.automationStandby !== true)) throw new Error("氣候條件貼文必須維持自動化待命");
  return true;
}

validatePosts();

module.exports = { POSTS, normalizeForDuplicateCheck, validatePosts };
