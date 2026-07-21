"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const VERSION = "3.0.0";
const CAMPAIGN_ID = "xjw-social-final-10-v3";
const PUBLIC_BASE = String(process.env.RENDER_EXTERNAL_URL || "https://ts-line.onrender.com").replace(/\/$/, "");
const DM_BASE = "https://ts15825868.github.io/xianjiawei/images/dm-final";
const IMAGE_ROUTE = "/social-final-approved";
const IMAGE_DIR = path.join(__dirname, "public", "social", "final-approved");
const WEATHER_INTERVAL_MS = Number(process.env.SOCIAL_WEATHER_CHECK_INTERVAL_MS || 60 * 60 * 1000);
const FIRST_IDS = new Set();
let socialApi = null;
let weatherBusy = false;
let timer = null;

function addApprovedHost() {
  const hosts = new Set(String(process.env.SOCIAL_APPROVED_IMAGE_HOSTS || "raw.githubusercontent.com,ts15825868.github.io").split(",").map((v) => v.trim()).filter(Boolean));
  try { hosts.add(new URL(PUBLIC_BASE).hostname); } catch {}
  hosts.add("ts-line.onrender.com");
  process.env.SOCIAL_APPROVED_IMAGE_HOSTS = [...hosts].join(",");
}

const careImage = (name) => `${PUBLIC_BASE}${IMAGE_ROUTE}/${name}.jpg?v=${VERSION}`;

const POSTS = [
  {
    id: "final-care-work-rest-20260722", sequenceRole: "care", category: "日常關心",
    title: "工作再忙，也別忘了休息一下", scheduledAt: "2026-07-22T02:00:00.000Z",
    imageUrl: careImage("care-work-rest"), sourceImageFile: "care-work-rest.jpg",
    instagramCaption: ["工作一忙，很容易連喝水和休息都忘了。", "", "久坐一段時間可以起身伸展，手邊放杯水，忙碌之間也替自己留一點喘息時間。", "", "把日常節奏放穩，慢慢來也很好。", "", "#仙加味 #仙加味小老闆 #日常關心 #工作日常 #記得休息"].join("\n"),
    facebookCaption: ["工作再忙，也別忘了替自己留一點休息時間。", "", "久坐後起身伸展、記得補充水分，讓忙碌的一天多一點從容。照顧日常，不一定要一次改很多，從一個小動作開始就很好。", "", "#仙加味 #日常關心 #記得休息"].join("\n")
  },
  {
    id: "final-product-guilu-gao-20260724", sequenceRole: "product", category: "產品介紹",
    title: "龜鹿膏100g｜依日常節奏慢慢安排", scheduledAt: "2026-07-24T12:00:00.000Z",
    imageUrl: `${DM_BASE}/01_guilu-gao-100g-dm.jpg?v=408.7`, sourceImageFile: "01_guilu-gao-100g-dm.jpg",
    instagramCaption: ["龜鹿膏是膏狀型態，規格為100g／罐。", "", "可以依產品標示取用，也可加入溫熱水化開後慢慢飲用。第一次安排時不必急著一次很多，先從自己容易記得、做得到的節奏開始。", "", "開罐後請依包裝標示冷藏保存。", "補養，是一種節奏。", "", "#仙加味 #龜鹿膏 #100g #使用小提醒 #漢方生活"].join("\n"),
    facebookCaption: ["龜鹿膏100g是適合依日常節奏取用的膏狀型態。", "", "可直接依產品標示取用，也可加入溫熱水化開後飲用。把時間安排在自己容易記得的時段，比臨時想到才使用更順手。開罐後請依包裝標示冷藏保存。", "", "#仙加味 #龜鹿膏 #使用小提醒"].join("\n")
  },
  {
    id: "final-care-family-20260729", sequenceRole: "care", category: "日常關心",
    title: "照顧自己，也別忘了關心家人", scheduledAt: "2026-07-29T02:00:00.000Z",
    imageUrl: careImage("care-family"), sourceImageFile: "care-family.jpg",
    instagramCaption: ["一句問候、一起吃頓飯，都是日常裡很溫柔的陪伴。", "", "照顧自己的同時，也別忘了關心身邊的人。把關心放進生活，不需要很複雜。", "", "陪伴，往往就是最溫柔的照顧。", "", "#仙加味 #仙加味小老闆 #日常關心 #家人陪伴 #溫暖日常"].join("\n"),
    facebookCaption: ["有時候，一句簡單的問候，就很有溫度。", "", "一起吃飯、一起休息，或只是問問今天過得好不好，都是生活裡珍貴的陪伴。照顧自己，也別忘了關心家人。", "", "#仙加味 #日常關心 #家人陪伴"].join("\n")
  },
  {
    id: "final-product-guilu-yin-20260731", sequenceRole: "product", category: "產品介紹",
    title: "龜鹿飲｜30cc與180cc，依使用情境選擇", scheduledAt: "2026-07-31T12:00:00.000Z",
    imageUrl: `${DM_BASE}/02_guilu-drink-30cc-dm.jpg?v=408.7`, sourceImageFile: "02_guilu-drink-30cc-dm.jpg",
    instagramCaption: ["龜鹿飲有30cc玻璃瓶與180cc鋁袋兩種規格。", "", "30cc瓶裝輕巧好攜帶；180cc鋁袋適合想要較完整即飲份量的時候。可直接飲用，也可依個人習慣溫熱後再喝。", "", "實際保存與飲用方式請以包裝標示為準。", "", "#仙加味 #龜鹿飲 #30cc #180cc #日常攜帶"].join("\n"),
    facebookCaption: ["龜鹿飲有30cc玻璃瓶與180cc鋁袋兩種規格，可依外出攜帶或日常飲用情境選擇。", "", "可直接飲用，也可依個人習慣溫熱後再喝。產品圖片維持正式真實外觀，不改瓶型、袋型、標籤、比例或包裝。實際保存方式請以包裝標示為準。", "", "#仙加味 #龜鹿飲 #日常安排"].join("\n")
  },
  {
    id: "final-weather-temperature-gap", sequenceRole: "care", category: "氣候關心", weatherTrigger: "gap", conditionalWeather: true,
    title: "早晚溫差大，出門多帶一件薄外套", scheduledAt: "2026-08-05T02:00:00.000Z",
    imageUrl: careImage("care-temperature-gap"), sourceImageFile: "care-temperature-gap.jpg",
    instagramCaption: ["早晚、室內外溫差明顯時，出門可以多帶一件薄外套。", "", "忙碌的一天也記得留點休息時間，依當下溫度調整穿著，讓日常更從容。", "", "慢慢照顧自己，日常更安心。", "", "#仙加味 #日常關心 #溫差提醒 #照顧自己"].join("\n"),
    facebookCaption: ["遇到早晚或室內外溫差較大時，出門可以多帶一件薄外套。", "", "依當下感受調整穿著，忙碌中也記得留點休息時間。小小的準備，就能讓日常安排更從容。", "", "#仙加味 #溫差提醒 #日常關心"].join("\n")
  },
  {
    id: "final-product-lurongfen-20260807", sequenceRole: "product", category: "產品介紹",
    title: "鹿茸粉75g｜依自己的飲食習慣搭配", scheduledAt: "2026-08-07T12:00:00.000Z",
    imageUrl: `${DM_BASE}/04_luerong-fen-75g-dm.jpg?v=408.7`, sourceImageFile: "04_luerong-fen-75g-dm.jpg",
    instagramCaption: ["鹿茸粉規格為75g／罐，原料為鹿茸。", "", "可依個人習慣取適量，加入溫開水、牛奶、豆漿或其他飲品中攪拌均勻。初次安排可以少量開始，再依自己的飲食習慣調整。", "", "開封後請密封保存並儘早食用完畢。", "", "#仙加味 #鹿茸粉 #75g #飲品搭配 #使用小提醒"].join("\n"),
    facebookCaption: ["鹿茸粉75g可依自己的飲食習慣，加入溫開水、牛奶、豆漿或其他飲品中攪拌均勻。", "", "初次安排可從少量開始，再依個人習慣調整。開封後請密封保存並儘早食用完畢；實際使用與保存仍以包裝標示為準。", "", "#仙加味 #鹿茸粉 #使用小提醒"].join("\n")
  },
  {
    id: "final-weather-hot-hydration", sequenceRole: "care", category: "氣候關心", weatherTrigger: "hot", conditionalWeather: true,
    title: "天氣炎熱，記得分次補充水分", scheduledAt: "2026-08-12T02:00:00.000Z",
    imageUrl: careImage("care-hot-hydration"), sourceImageFile: "care-hot-hydration.jpg",
    instagramCaption: ["天氣炎熱，水瓶可以放在看得到、拿得到的地方。", "", "外出記得帶水，不用等到很渴才喝；忙碌中也替自己安排幾次補充水分與休息的時間。", "", "照顧自己，也照顧家人。", "", "#仙加味 #日常關心 #炎熱提醒 #補充水分"].join("\n"),
    facebookCaption: ["天氣熱的時候，記得把補充水分放進日常安排。", "", "外出帶水瓶、分次飲用，忙碌時也別忘了休息一下。簡單的小提醒，也可以分享給身邊的家人。", "", "#仙加味 #炎熱提醒 #補充水分"].join("\n")
  },
  {
    id: "final-product-tangkuai-20260814", sequenceRole: "product", category: "產品介紹",
    title: "龜鹿湯塊75g｜8塊裝，沖泡料理都方便", scheduledAt: "2026-08-14T12:00:00.000Z",
    imageUrl: `${DM_BASE}/05_guilu-tangkuai-75g-dm.jpg?v=408.7`, sourceImageFile: "05_guilu-tangkuai-75g-dm.jpg",
    instagramCaption: ["龜鹿湯塊75g為每盒8塊裝，主要成分為龜板萃取物與鹿角萃取物。", "", "可依產品標示加入熱水沖泡，也能搭配雞湯、排骨湯等家常料理。水量與使用方式可依包裝標示及個人口感安排。", "", "#仙加味 #龜鹿湯塊 #75g #8塊裝 #沖泡料理"].join("\n"),
    facebookCaption: ["龜鹿湯塊75g為8塊裝，適合熱水沖泡或家常料理。", "", "可搭配雞湯、排骨湯，也可依產品標示使用熱水沖泡。產品圖片維持正式盒型、塊數與真實外觀，不重畫、不改比例。", "", "#仙加味 #龜鹿湯塊 #沖泡料理"].join("\n")
  },
  {
    id: "final-weather-rainy-day", sequenceRole: "care", category: "氣候關心", weatherTrigger: "rain", conditionalWeather: true,
    title: "下雨天在家，也別忘了留一點暖身時間", scheduledAt: "2026-08-19T02:00:00.000Z",
    imageUrl: careImage("care-rainy-day"), sourceImageFile: "care-rainy-day.jpg",
    instagramCaption: ["下雨天待在家，可以替自己留一點慢下來的時間。", "", "泡一杯溫熱飲品、簡單整理餐桌，或和家人一起坐下來聊聊天，讓日常多一點溫度。", "", "天氣有變化，照顧自己也照顧身邊的人。", "", "#仙加味 #日常關心 #下雨天 #溫暖時光"].join("\n"),
    facebookCaption: ["下雨天在家，不妨替自己留一點暖暖的時間。", "", "泡杯溫熱飲品、把步調放慢，或陪家人聊聊天。照顧日常，有時就是從這些簡單的小事開始。", "", "#仙加味 #下雨天 #日常關心"].join("\n")
  },
  {
    id: "final-product-guilu-jiao-20260821", sequenceRole: "product", category: "產品介紹",
    title: "龜鹿膠600g｜家庭規格，依日常慢慢安排", scheduledAt: "2026-08-21T12:00:00.000Z",
    imageUrl: `${DM_BASE}/06_guilu-jiao-600g-dm.jpg?v=408.7`, sourceImageFile: "06_guilu-jiao-600g-dm.jpg",
    instagramCaption: ["龜鹿膠規格為600g／盒（一斤），共32塊，每塊約18.75g。", "", "可依產品標示加入熱水化開，也能搭配家常料理。家庭規格適合先確認保存空間與使用節奏，再慢慢安排。", "", "#仙加味 #龜鹿膠 #600g #家庭規格 #使用小提醒"].join("\n"),
    facebookCaption: ["龜鹿膠600g為一斤裝，盒內共32塊，每塊約18.75g。", "", "可依產品標示以熱水化開，也能搭配家常料理。正式DM呈現真實盒型與產品規格，不改包裝、不改比例。", "", "#仙加味 #龜鹿膠 #600g"].join("\n")
  }
];
POSTS.forEach((post) => FIRST_IDS.add(post.id));

function desired(item, existing, now) {
  const keepManual = existing?.manualScheduleOverride || existing?.scheduleOverride || existing?.manuallyEdited;
  const preserveState = existing && ["publishing", "published", "partial", "failed"].includes(existing.status);
  const base = {
    ...item,
    campaignId: CAMPAIGN_ID,
    campaignVersion: VERSION,
    contentVersion: VERSION,
    publishInstagram: true,
    publishFacebook: true,
    autoManaged: true,
    assetLocked: true,
    result: existing?.result || {},
    history: Array.isArray(existing?.history) ? existing.history : [{ id: `final-${Date.now().toString(36)}`, action: "建立正式10篇社群排程", detail: "5篇關心＋5篇產品正式圖文", createdAt: now }],
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (item.conditionalWeather) {
    Object.assign(base, {
      status: preserveState ? existing.status : "paused",
      approvedAt: existing?.approvedAt || now,
      oneTimeWeatherPost: preserveState ? Boolean(existing.oneTimeWeatherPost) : false,
      lastError: preserveState ? (existing.lastError || "") : "氣候待命素材：符合萬華實際氣候時，才會自動安排上午10:00發文"
    });
  } else {
    Object.assign(base, {
      status: preserveState ? existing.status : "approved",
      approvedAt: existing?.approvedAt || now,
      lastError: preserveState ? (existing.lastError || "") : ""
    });
  }
  if (keepManual) {
    base.scheduledAt = existing.scheduledAt;
    base.manualScheduleOverride = true;
  }
  return base;
}

function reconcile(loaded = socialApi) {
  if (!loaded?.readStore || !loaded?.writeStore) return { changed: 0, active: 0 };
  const store = loaded.readStore();
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  const now = new Date().toISOString();
  const existingById = new Map(store.posts.map((p) => [String(p.id || ""), p]));
  const published = store.posts.filter((p) => p.status === "published" && !FIRST_IDS.has(String(p.id || "")));
  const finalPosts = POSTS.map((item) => desired(item, existingById.get(item.id), now));
  const cancelled = store.posts
    .filter((p) => p.status !== "published" && !FIRST_IDS.has(String(p.id || "")))
    .map((p) => ({ ...p, status: "cancelled", assetLocked: false, approvedAt: "", lastError: "已由正式5篇關心＋5篇產品排程取代", updatedAt: now }));
  store.posts = [...published, ...finalPosts, ...cancelled];
  store.socialFinalBatchVersion = VERSION;
  store.socialFinalBatchCampaignId = CAMPAIGN_ID;
  store.socialFinalBatchUpdatedAt = now;
  loaded.writeStore(store);
  return { changed: finalPosts.length + cancelled.length, active: finalPosts.length, cancelled: cancelled.length };
}

function mountImages(app) {
  if (!app || app.__xjwFinalSocialImages) return;
  Object.defineProperty(app, "__xjwFinalSocialImages", { value: true });
  app.get(`${IMAGE_ROUTE}/:name.jpg`, (req, res) => {
    const name = String(req.params.name || "");
    if (!/^(care-work-rest|care-family|care-temperature-gap|care-hot-hydration|care-rainy-day)$/.test(name)) return res.status(404).send("not found");
    try {
      const text = fs.readFileSync(path.join(IMAGE_DIR, `${name}.b64`), "utf8").replace(/\s+/g, "");
      const buffer = Buffer.from(text, "base64");
      if (buffer.length < 1000 || buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error("invalid image data");
      res.set("Cache-Control", "public, max-age=604800, immutable");
      res.type("image/jpeg").send(buffer);
    } catch (error) {
      console.error("final social image failed", name, error.message);
      res.status(404).send("not found");
    }
  });
  app.get("/social-final-approved/healthz", (_req, res) => res.json({ ok: true, version: VERSION, images: 5, posts: 10 }));
}

function taipeiParts(value = new Date()) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
}
function localDate(parts) { return `${parts.year}-${parts.month}-${parts.day}`; }
function addDays(key, n) { const [y,m,d]=key.split("-").map(Number); return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10); }
function atTen(key) { const [y,m,d]=key.split("-").map(Number); return new Date(Date.UTC(y,m-1,d,2,0,0)).toISOString(); }
function weekKey(value) { const p=taipeiParts(new Date(value)); const d=new Date(Date.UTC(+p.year,+p.month-1,+p.day)); const day=d.getUTCDay()||7; d.setUTCDate(d.getUTCDate()-day+1); return d.toISOString().slice(0,10); }

async function checkWeather(loaded = socialApi) {
  if (weatherBusy || !loaded?.readStore || !loaded?.writeStore || typeof fetch !== "function") return;
  weatherBusy = true;
  try {
    const parts = taipeiParts();
    const today = localDate(parts);
    const publishDate = (+parts.hour * 60 + +parts.minute < 585) ? today : addDays(today, 1);
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", "25.038"); url.searchParams.set("longitude", "121.499"); url.searchParams.set("timezone", "Asia/Taipei");
    url.searchParams.set("forecast_days", "2"); url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,precipitation_probability_max");
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`weather ${response.status}`);
    const data = await response.json();
    const i = data.daily.time.indexOf(publishDate); if (i < 0) return;
    const v = (k) => Number(data.daily[k][i]);
    const day = { code:v("weather_code"), max:v("temperature_2m_max"), min:v("temperature_2m_min"), apparent:v("apparent_temperature_max"), rain:v("precipitation_sum"), chance:v("precipitation_probability_max") };
    let trigger="", summary="";
    if (day.code >= 51 || day.chance >= 60 || day.rain >= 5) { trigger="rain"; summary=`降雨機率${day.chance}%`; }
    else if (day.apparent >= 34 || day.max >= 32) { trigger="hot"; summary=`最高${day.max}°C／體感${day.apparent}°C`; }
    else if (day.max-day.min >= 8) { trigger="gap"; summary=`高低溫差${(day.max-day.min).toFixed(1)}°C`; }
    const store = loaded.readStore();
    store.weatherAutomation = { version: VERSION, checkedAt:new Date().toISOString(), publishDate, day, trigger, summary: summary || "目前沒有需要啟用的氣候貼文" };
    if (trigger) {
      const target = store.posts.find((p) => p.campaignId===CAMPAIGN_ID && p.weatherTrigger===trigger && p.status==="paused");
      const scheduledAt = atTen(publishDate);
      const duplicate = store.posts.some((p) => p.id!==target?.id && p.status!=="cancelled" && p.status!=="paused" && p.sequenceRole==="care" && weekKey(p.scheduledAt)===weekKey(scheduledAt));
      if (target && !duplicate) Object.assign(target, { status:"approved", oneTimeWeatherPost:true, scheduledAt, approvedAt:new Date().toISOString(), weatherConditionSummary:summary, lastError:"", updatedAt:new Date().toISOString() });
    }
    loaded.writeStore(store);
  } catch (error) { console.error("final social weather check failed", error.message); }
  finally { weatherBusy = false; }
}

function install() {
  addApprovedHost();
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./server" && loaded?.app) mountImages(loaded.app);
    if (request === "./social-official-rebuild" && loaded?.rebuildOfficialSocialSchedule) {
      return { ...loaded, rebuildOfficialSocialSchedule: () => ({ campaignId: CAMPAIGN_ID, imageVersion: VERSION, preservedPublished: 0, removedUnpublished: 0, inserted: 0, updated: 0, pendingReview: 0, activeTotal: 10, firstAt: POSTS[0].scheduledAt, lastAt: POSTS.at(-1).scheduledAt, signature: VERSION }) };
    }
    if (request === "./social-server" && loaded?.readStore && loaded?.writeStore) {
      socialApi = loaded;
      setTimeout(() => { try { console.log("Final social batch reconciled", reconcile(loaded)); } catch (e) { console.error(e); } }, 800).unref?.();
      setTimeout(() => { try { reconcile(loaded); } catch (e) { console.error(e); } }, 5000).unref?.();
      setTimeout(() => checkWeather(loaded), 8000).unref?.();
      if (!timer) { timer = setInterval(() => { try { reconcile(loaded); } catch (e) { console.error(e); } checkWeather(loaded); }, WEATHER_INTERVAL_MS); timer.unref?.(); }
    }
    return loaded;
  };
}

install();
module.exports = { VERSION, CAMPAIGN_ID, POSTS, reconcile, checkWeather, mountImages, install };
