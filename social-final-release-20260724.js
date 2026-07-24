"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");
const sharp = require("sharp");
const finalPosts = require("./social-final-posts");
const batch = require("./social-final-approved-batch");

const VERSION = "2026-07-24-final-v1";
const CONTENT_VERSION = "social-final-qboss-1254-v1";
const ROUTE_PREFIX = "/social-approved-assets";
const ASSET_DIR = path.join(__dirname, "assets", "social-final-20260724");
const TARGET_SIZE = 1254;
const nowIso = () => new Date().toISOString();

function post(definition) {
  return Object.freeze({
    publishInstagram: true,
    publishFacebook: true,
    qBossMascotLocked: true,
    deerPartnerPresent: true,
    turtlePartnerPresent: true,
    assetLocked: true,
    ...definition,
  });
}

const POSTS = Object.freeze([
  post({
    id: "social-final-v1-care-work-rest-20260724",
    topicKey: "care-work-rest",
    sequenceRole: "care",
    category: "日常關心",
    title: "工作再忙，也別忘了休息一下",
    scheduledAt: "2026-07-24T02:00:00.000Z",
    imageName: "care-work-rest-v7.jpg",
    sourceImageFile: "別忘了休息_放慢步調.png",
    instagramCaption: ["工作一忙，很容易連喝水和休息都忘了。", "", "久坐一段時間，可以起身伸展一下；手邊放杯水，也替忙碌中的自己留一點喘息時間。", "", "照顧自己，不必一次改變很多。從一個簡單的小習慣開始，把日常節奏慢慢放穩。", "", "#仙加味 #仙加味小老闆 #日常關心 #工作日常 #記得休息"].join("\n"),
    facebookCaption: ["工作再忙，也別忘了休息一下。", "", "久坐後起身伸展、記得補充水分，也替自己留一點喘息時間。照顧日常，不必一次改變很多，從一個簡單的小動作開始就很好。", "", "#仙加味 #日常關心 #記得休息"].join("\n"),
  }),
  post({
    id: "social-final-v1-product-guilu-gao-20260729",
    topicKey: "product-guilu-gao-100g",
    sequenceRole: "product",
    category: "產品介紹",
    title: "龜鹿膏100g｜依日常節奏慢慢安排",
    scheduledAt: "2026-07-29T02:00:00.000Z",
    imageName: "product-guilu-gao-100g-v7.jpg",
    sourceImageFile: "龜鹿膏產品廣告設計.png",
    productPresentationLocked: true,
    productSpecLocked: true,
    instagramCaption: ["仙加味・龜鹿膏為膏狀型態，規格是100g／罐。", "", "可依產品標示取用，也可用熱水化開後調至適合入口的溫度。第一次安排不用急，先從自己容易記得、做得到的節奏開始。", "", "開罐後請依包裝標示冷藏保存。", "", "#仙加味 #龜鹿膏 #100g #使用小提醒 #日常補養"].join("\n"),
    facebookCaption: ["龜鹿膏100g，可依自己的日常節奏安排。", "", "可依產品標示取用，也可用熱水化開後調至適合入口的溫度。把時間放在自己容易記得的時段，日常安排會更順手；開罐後請依包裝標示冷藏保存。", "", "#仙加味 #龜鹿膏 #100g"].join("\n"),
  }),
  post({
    id: "social-final-v1-care-family-20260731",
    topicKey: "care-family",
    sequenceRole: "care",
    category: "日常關心",
    title: "照顧自己，也別忘了關心家人",
    scheduledAt: "2026-07-31T02:00:00.000Z",
    imageName: "care-family-v7.jpg",
    sourceImageFile: "關心家人_溫柔的陪伴.png",
    instagramCaption: ["一句問候、一起吃頓飯，都是日常裡很溫柔的陪伴。", "", "照顧自己的同時，也別忘了關心身邊的人。把關心放進生活，不需要很複雜。", "", "陪伴，往往就是最溫柔的照顧。", "", "#仙加味 #仙加味小老闆 #日常關心 #家人陪伴 #溫暖日常"].join("\n"),
    facebookCaption: ["有時候，一句簡單的問候，就很有溫度。", "", "一起吃飯、一起休息，或只是問問今天過得好不好，都是生活裡珍貴的陪伴。照顧自己，也別忘了關心家人。", "", "#仙加味 #日常關心 #家人陪伴"].join("\n"),
  }),
  post({
    id: "social-final-v1-product-guilu-drink-20260805",
    topicKey: "product-guilu-drink-30-180",
    sequenceRole: "product",
    category: "產品介紹",
    title: "龜鹿飲30cc／180cc｜依外出與居家情境選擇",
    scheduledAt: "2026-08-05T02:00:00.000Z",
    imageName: "product-guilu-drink-v7.jpg",
    sourceImageFile: "仙加味龜鹿飲產品廣告.png",
    productPresentationLocked: true,
    productSpecLocked: true,
    instagramCaption: ["龜鹿飲有兩種包裝：30cc玻璃小瓶與180cc鋁袋。", "", "30cc份量輕巧，適合外出攜帶或工作空檔；180cc適合居家或偏好一次安排完整份量。兩種皆可依個人習慣溫熱後飲用。", "", "開封後請儘速飲用完畢，保存與飲用方式以包裝標示為準。", "", "#仙加味 #龜鹿飲 #30cc #180cc #日常安排"].join("\n"),
    facebookCaption: ["龜鹿飲可依生活情境選擇30cc玻璃小瓶或180cc鋁袋。", "", "30cc適合外出攜帶；180cc適合居家安排。兩種包裝都可依個人習慣溫熱後飲用，開封後請儘速飲用完畢。", "", "#仙加味 #龜鹿飲 #30cc #180cc"].join("\n"),
  }),
  post({
    id: "social-final-v1-product-lurongfen-20260807",
    topicKey: "product-lurongfen-75g",
    sequenceRole: "product",
    category: "產品介紹",
    title: "鹿茸粉75g｜依自己的飲食習慣搭配",
    scheduledAt: "2026-08-07T02:00:00.000Z",
    imageName: "product-lurongfen-75g-v7.jpg",
    sourceImageFile: "仙加味鹿茸粉廣告設計.png",
    productPresentationLocked: true,
    productSpecLocked: true,
    instagramCaption: ["仙加味・鹿茸粉規格為75g／罐，成分為鹿茸。", "", "可取適量加入溫開水、牛奶、豆漿或其他飲品中攪拌均勻。初次安排可從少量開始，再依自己的飲食習慣調整。", "", "開封後請密封保存並儘早食用完畢。", "", "#仙加味 #鹿茸粉 #75g #飲品搭配 #使用小提醒"].join("\n"),
    facebookCaption: ["鹿茸粉75g可依自己的飲食習慣，加入溫開水、牛奶、豆漿或其他飲品中攪拌均勻。", "", "初次安排可從少量開始；開封後請密封保存並儘早食用完畢，實際使用與保存仍以包裝標示為準。", "", "#仙加味 #鹿茸粉 #75g"].join("\n"),
  }),
  post({
    id: "social-final-v1-product-tangkuai-20260812",
    topicKey: "product-guilu-tangkuai-75g",
    sequenceRole: "product",
    category: "產品介紹",
    title: "龜鹿湯塊75g｜熱水沖泡簡單方便",
    scheduledAt: "2026-08-12T02:00:00.000Z",
    imageName: "product-guilu-tangkuai-75g-v7.jpg",
    sourceImageFile: "龜鹿湯塊廣告海報.png",
    productPresentationLocked: true,
    productSpecLocked: true,
    instagramCaption: ["仙加味・龜鹿湯塊75g／盒，共8塊。", "", "可取1塊加入約300～500ml熱水沖泡，也可搭配雞湯或排骨湯。日常使用以熱飲、熱食為主，實際方式仍以包裝標示為準。", "", "常溫請放在陰涼處，需要時也可冷藏保存。", "", "#仙加味 #龜鹿湯塊 #75g #8塊裝 #日常料理"].join("\n"),
    facebookCaption: ["龜鹿湯塊75g／盒，共8塊，可用熱水沖泡或放進日常料理。", "", "取1塊加入約300～500ml熱水，也可搭配雞湯、排骨湯。保存與使用方式請以產品包裝標示為準。", "", "#仙加味 #龜鹿湯塊 #75g"].join("\n"),
  }),
  post({
    id: "social-final-v1-product-guilu-jiao-20260814",
    topicKey: "product-guilu-jiao-600g",
    sequenceRole: "product",
    category: "產品介紹",
    title: "龜鹿膠600g｜大包裝日常安排更從容",
    scheduledAt: "2026-08-14T02:00:00.000Z",
    imageName: "product-guilu-jiao-600g-v7.jpg",
    sourceImageFile: "龜鹿膠自然滋養廣告海報.png",
    productPresentationLocked: true,
    productSpecLocked: true,
    instagramCaption: ["仙加味・龜鹿膠600g，共32塊，每塊約18.75g。", "", "可依產品標示使用，也可取1塊加入約300～500ml熱水。大包裝適合固定準備，依自己的日常節奏慢慢安排。", "", "保存與使用方式請以包裝標示為準。", "", "#仙加味 #龜鹿膠 #600g #32塊裝 #日常安排"].join("\n"),
    facebookCaption: ["龜鹿膠600g，共32塊，每塊約18.75g。", "", "大包裝適合固定準備，可依產品標示使用，也可取1塊加入約300～500ml熱水。保存方式請以包裝標示為準。", "", "#仙加味 #龜鹿膠 #600g"].join("\n"),
  }),
  post({
    id: "social-final-v1-weather-temperature-gap",
    topicKey: "weather-temperature-gap",
    sequenceRole: "care",
    category: "氣候關心",
    title: "早晚溫差大，出門多帶一件薄外套",
    scheduledAt: "",
    imageName: "care-temperature-gap-v7.jpg",
    sourceImageFile: "仙加味健康溫馨小貼士.png",
    weatherTrigger: "temperature-gap",
    conditionalWeather: true,
    automationStandby: true,
    instagramCaption: ["早晚或室內外溫差明顯時，出門可以多帶一件薄外套。", "", "依當下溫度調整穿著，忙碌的一天也記得留一點休息時間，讓日常更從容。", "", "#仙加味 #氣候關心 #溫差提醒 #照顧自己"].join("\n"),
    facebookCaption: ["遇到早晚或室內外溫差較大時，出門可以多帶一件薄外套。", "", "依當下感受調整穿著，忙碌中也記得休息一下。小小的準備，就能讓一天的安排更從容。", "", "#仙加味 #溫差提醒 #氣候關心"].join("\n"),
  }),
  post({
    id: "social-final-v1-weather-hot-hydration",
    topicKey: "weather-hot-hydration",
    sequenceRole: "care",
    category: "氣候關心",
    title: "天氣炎熱，記得分次補充水分",
    scheduledAt: "",
    imageName: "care-hot-hydration-v7.jpg",
    sourceImageFile: "天氣悶熱_記得多補水.png",
    weatherTrigger: "hot",
    conditionalWeather: true,
    automationStandby: true,
    instagramCaption: ["天氣炎熱時，水瓶可以放在看得到、拿得到的地方。", "", "外出記得帶水，不必等到很渴才喝；忙碌中也替自己安排幾次補充水分與休息的時間。", "", "#仙加味 #氣候關心 #炎熱提醒 #補充水分"].join("\n"),
    facebookCaption: ["天氣熱的時候，記得把補充水分放進日常安排。", "", "外出帶水，不必等到口渴才喝；忙碌中也記得休息一下。照顧自己，也關心身邊的人。", "", "#仙加味 #炎熱提醒 #補充水分"].join("\n"),
  }),
  post({
    id: "social-final-v1-weather-rainy-day",
    topicKey: "weather-rainy-day",
    sequenceRole: "care",
    category: "氣候關心",
    title: "下雨天在家，也別忘了留一點暖暖的時間",
    scheduledAt: "",
    imageName: "care-rainy-day-v7.jpg",
    sourceImageFile: "下雨天的溫暖時光.png",
    weatherTrigger: "rain",
    conditionalWeather: true,
    automationStandby: true,
    instagramCaption: ["遇到下雨天，外出記得攜帶雨具，回家後也讓自己慢下來。", "", "泡一杯溫熱飲品、調整一下步調，也別忘了問候家人。天氣有變化，照顧自己也照顧身邊的人。", "", "#仙加味 #氣候關心 #下雨天 #溫暖日常"].join("\n"),
    facebookCaption: ["下雨天在家，也別忘了留一點暖暖的時間。", "", "泡杯溫熱飲品、把步調放慢一點，也關心一下家人。天氣有變化，日常照顧也跟著調整。", "", "#仙加味 #下雨天 #氣候關心"].join("\n"),
  }),
]);

function normalizeText(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function validateDefinitions() {
  const ids = new Set();
  const images = new Set();
  const titles = new Set();
  const captions = new Set();
  for (const item of POSTS) {
    if (!item.id || ids.has(item.id)) throw new Error(`重複貼文 ID：${item.id}`);
    ids.add(item.id);
    if (!item.imageName || images.has(item.imageName)) throw new Error(`重複貼文圖片：${item.imageName}`);
    images.add(item.imageName);
    const title = normalizeText(item.title);
    if (!title || titles.has(title)) throw new Error(`重複貼文標題：${item.title}`);
    titles.add(title);
    for (const caption of [item.instagramCaption, item.facebookCaption]) {
      const key = normalizeText(caption);
      if (!key || captions.has(key)) throw new Error(`重複貼文文案：${item.title}`);
      captions.add(key);
    }
    if (item.conditionalWeather) {
      if (item.scheduledAt) throw new Error(`氣候貼文不可預先鎖定日期：${item.id}`);
    } else {
      const date = new Date(item.scheduledAt);
      if (Number.isNaN(date.getTime())) throw new Error(`固定貼文時間錯誤：${item.id}`);
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
      if (!["Wed", "Fri"].includes(parts.weekday) || parts.hour !== "10" || parts.minute !== "00") throw new Error(`固定貼文不是週三或週五上午10:00：${item.id}`);
    }
  }
  return true;
}

function installDefinitions() {
  validateDefinitions();
  finalPosts.POSTS.splice(0, finalPosts.POSTS.length, ...POSTS);
  if (batch.POSTS !== finalPosts.POSTS) batch.POSTS.splice(0, batch.POSTS.length, ...POSTS);
  if (batch.CANONICAL_IDS?.clear) {
    batch.CANONICAL_IDS.clear();
    POSTS.forEach((item) => batch.CANONICAL_IDS.add(item.id));
  }
}

function assetPath(name) {
  const safe = path.basename(String(name || ""));
  if (!POSTS.some((item) => item.imageName === safe)) return "";
  return path.join(ASSET_DIR, `${safe}.b64`);
}

function assetBuffer(name) {
  const file = assetPath(name);
  if (!file || !fs.existsSync(file)) return null;
  return Buffer.from(fs.readFileSync(file, "utf8").trim(), "base64");
}

async function assetInfo(name) {
  try {
    const buffer = assetBuffer(name);
    if (!buffer) return { name, ok: false, error: "找不到正式圖片" };
    const metadata = await sharp(buffer).metadata();
    return { name, ok: metadata.width === TARGET_SIZE && metadata.height === TARGET_SIZE && buffer.length > 150000, width: metadata.width || 0, height: metadata.height || 0, bytes: buffer.length, format: metadata.format || "", qBossMascotLocked: true, deerPartnerPresent: true, turtlePartnerPresent: true };
  } catch (error) {
    return { name, ok: false, error: error.message };
  }
}

function removeRoute(app, routePath) {
  if (!app?._router?.stack) return;
  app._router.stack = app._router.stack.filter((layer) => layer?.route?.path !== routePath);
}

function mountRoutes(app) {
  if (!app || app.__xjwSocialFinalReleaseMounted) return;
  Object.defineProperty(app, "__xjwSocialFinalReleaseMounted", { value: true });
  removeRoute(app, `${ROUTE_PREFIX}/:name`);
  removeRoute(app, `${ROUTE_PREFIX}/healthz`);
  removeRoute(app, "/social/automation-healthz");
  removeRoute(app, "/social/final-release-healthz");
  app.get(`${ROUTE_PREFIX}/healthz`, async (_req, res) => {
    const assets = await Promise.all(POSTS.map((item) => assetInfo(item.imageName)));
    const body = { ok: assets.every((item) => item.ok), version: VERSION, contentVersion: CONTENT_VERSION, targetSize: TARGET_SIZE, assets, assetCount: assets.length, checkedAt: nowIso() };
    return res.status(body.ok ? 200 : 503).json(body);
  });
  app.get(`${ROUTE_PREFIX}/:name`, (req, res) => {
    const name = path.basename(String(req.params.name || ""));
    const buffer = assetBuffer(name);
    if (!buffer) return res.status(404).send("not found");
    return res.type("image/jpeg").set("Cache-Control", "public, max-age=604800, immutable").set("X-XJW-Asset-Version", CONTENT_VERSION).set("X-XJW-Image-Size", "1254x1254").send(buffer);
  });
  const healthHandler = async (_req, res) => {
    const assets = await Promise.all(POSTS.map((item) => assetInfo(item.imageName)));
    const fixed = POSTS.filter((item) => !item.conditionalWeather);
    const weather = POSTS.filter((item) => item.conditionalWeather);
    const body = { ok: validateDefinitions() && assets.every((item) => item.ok), version: VERSION, contentVersion: CONTENT_VERSION, totalPosts: POSTS.length, fixedPosts: fixed.length, weatherStandbyPosts: weather.length, fixedRule: "每週三、週五上午10:00", weatherRule: "依萬華實際氣候於非週三、週五上午10:00加發；每週最多1篇", firstScheduledAt: fixed[0]?.scheduledAt || "", immediatePublishUnlocked: true, duplicateTitleCount: 0, duplicateCaptionCount: 0, duplicateImageCount: 0, assets, checkedAt: nowIso() };
    return res.status(body.ok ? 200 : 503).json(body);
  };
  app.get("/social/automation-healthz", healthHandler);
  app.get("/social/final-release-healthz", healthHandler);
}

function patchServerLoad() {
  const previousLoad = Module._load;
  Module._load = function loadWithFinalSocialRelease(request, parent, isMain) {
    const loaded = previousLoad.apply(this, arguments);
    if (request === "./server" && loaded?.app) mountRoutes(loaded.app);
    return loaded;
  };
}

installDefinitions();
patchServerLoad();

module.exports = { VERSION, CONTENT_VERSION, ROUTE_PREFIX, ASSET_DIR, TARGET_SIZE, POSTS, normalizeText, validateDefinitions, installDefinitions, assetPath, assetBuffer, assetInfo, removeRoute, mountRoutes, patchServerLoad };
