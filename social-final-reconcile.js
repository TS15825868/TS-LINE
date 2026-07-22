"use strict";

const Module = require("module");
const approvedAssets = require("./social-approved-originals");

const VERSION = "4.1.0";
const CAMPAIGN_ID = "xjw-social-first-batch-202607-v3";
const CONTENT_VERSION = "approved-production-assets-20260722-v1";
const RECONCILE_INTERVAL_MS = 20_000;
const WEATHER_INTERVAL_MS = 60 * 60 * 1000;
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

const CAPTIONS = Object.freeze({
  rest: ["工作再忙，也別忘了休息一下", "工作一忙，很容易連喝水和休息都忘了。忙碌之間替自己留一點時間，喝口水、伸展一下，慢慢整理自己的節奏。", "#仙加味 #仙加味小老闆 #日常關心 #記得休息"],
  gao: ["龜鹿膏100g｜依日常節奏慢慢安排", "龜鹿膏是100g／罐的膏狀型態，可依產品標示取用，也可加入溫熱水化開後飲用。開罐後請依包裝標示冷藏保存。", "#仙加味 #龜鹿膏 #100g #使用小提醒"],
  family: ["照顧自己，也別忘了關心家人", "一句問候、一起吃頓飯，都是日常裡很溫柔的陪伴。照顧自己的同時，也別忘了關心身邊的人。", "#仙加味 #仙加味小老闆 #日常關心 #家人陪伴"],
  drink: ["龜鹿飲｜30cc／180cc，外出與日常都方便", "龜鹿飲有30cc矮胖玻璃瓶與180cc鋁袋兩種規格。可直接飲用，也可依個人習慣溫熱後再喝；實際保存方式以包裝標示為準。", "#仙加味 #龜鹿飲 #30cc #180cc #日常攜帶"],
  storage: ["開封後與平時保存，記得放在適合的地方", "不同型態與包裝，保存方式可能不一樣。需要冷藏時依包裝標示處理；開封後也記得密封保存。", "#仙加味 #保存提醒 #日常小提醒"],
  powder: ["鹿茸粉75g｜依自己的飲食習慣搭配", "鹿茸粉規格為75g／罐，可依個人習慣取適量，加入溫開水、牛奶、豆漿或其他飲品中攪拌均勻。開封後請密封保存並儘早食用完畢。", "#仙加味 #鹿茸粉 #75g #飲品搭配"],
  warm: ["想喝熱熱的時候，記得先化開再調整溫度", "想搭配溫熱飲用時，可先依產品說明化開，再慢慢調整到適合入口的溫度。實際水量與保存方式以包裝標示為準。", "#仙加味 #溫熱飲用 #日常小提醒"],
  block: ["龜鹿湯塊75g｜8塊裝，沖泡料理都方便", "龜鹿湯塊75g為每盒8塊裝，主要成分為龜板萃取物與鹿角萃取物。可依產品標示熱水沖泡，也能搭配雞湯、排骨湯等家常料理。", "#仙加味 #龜鹿湯塊 #75g #沖泡料理"],
  water: ["日常補水提醒，記得分次補充水分", "水瓶放在看得到、拿得到的地方，忙碌時比較不容易忘記。外出記得帶水，分次補充，也替自己留一點休息時間。", "#仙加味 #日常關心 #補水提醒"],
  glue: ["龜鹿膠600g｜家庭規格，依日常慢慢安排", "龜鹿膠規格為600g／盒（1斤），共32塊，每塊約18.75g。可依產品標示加入熱水化開，也能搭配家常料理。", "#仙加味 #龜鹿膠 #600g #家庭規格"],
});

function post(id, scheduledAt, sequenceRole, assetKey, copyKey, category) {
  const [title, body, tags] = CAPTIONS[copyKey];
  return { id, scheduledAt, sequenceRole, assetKey, category, title, instagramCaption: `${body}\n\n${tags}`, facebookCaption: `${body}\n\n${tags}` };
}

const POSTS = Object.freeze([
  post("first-batch-v2-care-work-rest-20260729", "2026-07-22T02:00:00.000Z", "care", "care-work-rest", "rest", "日常關心"),
  post("first-batch-v2-product-guilu-gao-20260724", "2026-07-24T12:00:00.000Z", "product", "product-guilu-gao", "gao", "產品介紹"),
  post("first-batch-v2-care-family-20260805", "2026-07-29T02:00:00.000Z", "care", "care-family", "family", "日常關心"),
  post("first-batch-v2-product-guilu-yin-30cc-20260731", "2026-07-31T12:00:00.000Z", "product", "product-guilu-drink", "drink", "產品介紹"),
  post("first-batch-v3-care-storage-20260805", "2026-08-05T02:00:00.000Z", "care", "care-storage", "storage", "日常提醒"),
  post("first-batch-v2-product-lurongfen-75g-20260807", "2026-08-07T12:00:00.000Z", "product", "product-lurongfen", "powder", "產品介紹"),
  post("first-batch-v3-care-warm-drink-20260812", "2026-08-12T02:00:00.000Z", "care", "care-warm-drink", "warm", "日常提醒"),
  post("first-batch-v2-product-tangkuai-75g-20260814", "2026-08-14T12:00:00.000Z", "product", "product-tangkuai", "block", "產品介紹"),
  post("first-batch-v3-care-hydration-20260819", "2026-08-19T02:00:00.000Z", "care", "care-hydration", "water", "日常關心"),
  post("first-batch-v2-product-guilu-jiao-600g-20260821", "2026-08-21T12:00:00.000Z", "product", "product-guilu-jiao", "glue", "產品介紹"),
]);
const CANONICAL = new Map(POSTS.map((item) => [item.id, item]));

const WEATHER_REPLACEMENTS = Object.freeze({
  "temperature-gap": { assetKey: "weather-temperature-gap", title: "早晚溫差大，出門多帶一件薄外套", body: "早晚或室內外溫差明顯時，出門可以多帶一件薄外套，並依當下溫度調整穿著。", tags: "#仙加味 #日常關心 #溫差提醒" },
  hot: { assetKey: "weather-hot", title: "天氣悶熱，外出記得留意防曬與補水", body: "天氣悶熱時，外出記得帶水，也留意遮陽與防曬；分次補充水分並安排休息時間。", tags: "#仙加味 #日常關心 #炎熱提醒 #補水" },
  rain: { assetKey: "weather-rain", title: "下雨天在家，也別忘了留一點暖身時間", body: "下雨天待在家，可以替自己留一點慢下來的時間，泡杯溫熱飲品或陪家人聊聊天。", tags: "#仙加味 #日常關心 #下雨天" },
});

let installed = false;
let socialApi = null;
let reconciling = false;
let weatherChecking = false;
let reconcileTimer = null;
let weatherTimer = null;
const nowIso = () => new Date().toISOString();
const isPublished = (item) => String(item?.status || "") === "published";

function applyWeatherContent(item, trigger, summary = "") {
  const replacement = WEATHER_REPLACEMENTS[trigger];
  if (!replacement) return item;
  const caption = `${replacement.body}\n\n${replacement.tags}`;
  return { ...item, category: "氣候關心", title: replacement.title, imageUrl: approvedAssets.assetUrl(replacement.assetKey), sourceImageFile: approvedAssets.ASSETS[replacement.assetKey].sourceFile, instagramCaption: caption, facebookCaption: caption, weatherReplacementActive: true, weatherTrigger: trigger, weatherConditionSummary: summary };
}

function buildCanonicalPost(id, config, previous, updatedAt) {
  const asset = approvedAssets.ASSETS[config.assetKey];
  let desired = { ...config, ...previous, id, campaignId: CAMPAIGN_ID, campaignVersion: VERSION, contentVersion: CONTENT_VERSION, imageUrl: approvedAssets.assetUrl(config.assetKey), sourceImageFile: asset.sourceFile, publishInstagram: true, publishFacebook: true, autoManaged: true, automationVersion: VERSION, assetLocked: true, approvedAt: previous?.approvedAt || updatedAt, status: ["failed", "partial", "publishing"].includes(String(previous?.status || "")) ? previous.status : "approved", result: previous?.result || {}, lastError: ["failed", "partial"].includes(String(previous?.status || "")) ? String(previous.lastError || "") : "", createdAt: previous?.createdAt || updatedAt, updatedAt: previous?.updatedAt || updatedAt };
  if (previous?.weatherReplacementActive && WEATHER_REPLACEMENTS[previous.weatherTrigger]) desired = applyWeatherContent(desired, previous.weatherTrigger, previous.weatherConditionSummary || "");
  else Object.assign(desired, { weatherReplacementActive: false, weatherTrigger: "", weatherConditionSummary: "" });
  return desired;
}

function comparable(item) { const copy = { ...item }; delete copy.updatedAt; return copy; }

function reconcileStore(inputStore, updatedAt = nowIso()) {
  const store = { ...(inputStore || {}) };
  const posts = Array.isArray(store.posts) ? store.posts : [];
  const published = posts.filter(isPublished);
  const publishedIds = new Set(published.map((item) => String(item.id || "")));
  const previousById = new Map(posts.map((item) => [String(item.id || ""), item]));
  const active = [];
  let inserted = 0;
  let updated = 0;
  for (const [id, config] of CANONICAL) {
    if (publishedIds.has(id)) continue;
    const previous = previousById.get(id);
    const desired = buildCanonicalPost(id, config, previous, updatedAt);
    if (!previous) inserted += 1;
    else if (JSON.stringify(comparable(previous)) !== JSON.stringify(comparable(desired))) { updated += 1; desired.updatedAt = updatedAt; }
    active.push(desired);
  }
  const removedUnpublished = posts.filter((item) => !isPublished(item) && !CANONICAL.has(String(item.id || ""))).length;
  store.posts = [...published, ...active].slice(-500);
  Object.assign(store, { socialFinalReconcileVersion: VERSION, socialFinalReconcileUpdatedAt: updatedAt, socialFinalCampaignId: CAMPAIGN_ID, socialFinalCanonicalCount: CANONICAL.size, socialFinalRemovedUnpublished: removedUnpublished });
  return { store, inserted, updated, removedUnpublished, active };
}

function reconcile(loaded = socialApi) {
  if (reconciling || !loaded?.readStore || !loaded?.writeStore) return { skipped: true };
  reconciling = true;
  try {
    const source = loaded.readStore();
    const result = reconcileStore(source);
    if (result.inserted || result.updated || result.removedUnpublished || source.socialFinalReconcileVersion !== VERSION) loaded.writeStore(result.store);
    return { skipped: false, version: VERSION, inserted: result.inserted, updated: result.updated, removedUnpublished: result.removedUnpublished, active: result.active.length, approved: result.active.filter((item) => item.status === "approved").length, failed: result.active.filter((item) => ["failed", "partial"].includes(item.status)).length };
  } finally { reconciling = false; }
}

function taipeiDateKey(value) { const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() + TAIPEI_OFFSET_MS).toISOString().slice(0, 10); }
function weatherUrl() { const url = new URL("https://api.open-meteo.com/v1/forecast"); url.searchParams.set("latitude", "25.038"); url.searchParams.set("longitude", "121.499"); url.searchParams.set("timezone", "Asia/Taipei"); url.searchParams.set("forecast_days", "8"); url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,precipitation_probability_max"); return url; }
function selectWeather(daily, dateKey) { const index = daily?.time?.indexOf(dateKey) ?? -1; if (index < 0) return null; const num = (key) => Number(daily?.[key]?.[index]); const code = num("weather_code"), max = num("temperature_2m_max"), min = num("temperature_2m_min"), apparent = num("apparent_temperature_max"), rain = num("precipitation_sum"), probability = num("precipitation_probability_max"); if (code >= 51 || probability >= 60 || rain >= 5) return { trigger: "rain", summary: `降雨機率${probability}%／預估雨量${rain}mm` }; if (apparent >= 34 || max >= 32) return { trigger: "hot", summary: `最高${max}°C／體感最高${apparent}°C` }; if (max - min >= 8) return { trigger: "temperature-gap", summary: `高低溫差${(max - min).toFixed(1)}°C` }; return null; }
function nextCarePost(store, currentTime = Date.now()) { return (store.posts || []).filter((item) => CANONICAL.has(String(item.id || "")) && item.sequenceRole === "care" && item.status === "approved" && new Date(item.scheduledAt).getTime() >= currentTime - 5 * 60 * 1000).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0] || null; }
function updateWeatherReplacement(store, postId, selection, checkedAt) { const index = (store.posts || []).findIndex((item) => item.id === postId); if (index < 0 || !CANONICAL.has(postId)) return false; const original = store.posts[index]; let next = buildCanonicalPost(postId, CANONICAL.get(postId), { ...original, weatherReplacementActive: false, weatherTrigger: "" }, checkedAt); if (selection) next = applyWeatherContent(next, selection.trigger, selection.summary); next.updatedAt = checkedAt; if (JSON.stringify(comparable(original)) === JSON.stringify(comparable(next))) return false; store.posts[index] = next; return true; }

async function checkWeather(loaded = socialApi) {
  if (weatherChecking || !loaded?.readStore || !loaded?.writeStore || typeof fetch !== "function") return { skipped: true };
  weatherChecking = true;
  try {
    reconcile(loaded);
    const store = loaded.readStore(), target = nextCarePost(store), checkedAt = nowIso();
    if (!target) return { skipped: false, activated: false, reason: "no-upcoming-care-post" };
    const targetDate = taipeiDateKey(target.scheduledAt);
    const response = await fetch(weatherUrl(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`weather HTTP ${response.status}`);
    const selection = selectWeather((await response.json()).daily, targetDate);
    const changed = updateWeatherReplacement(store, target.id, selection, checkedAt);
    store.weatherAutomation = { version: VERSION, checkedAt, targetPostId: target.id, targetDate, selectedTrigger: selection?.trigger || "", summary: selection?.summary || "目前使用一般關心素材", replacementChanged: changed };
    loaded.writeStore(store);
    return { skipped: false, activated: Boolean(selection), changed, targetDate, selection };
  } catch (error) { console.error("Social weather check failed", error.message); return { skipped: false, activated: false, error: error.message }; }
  finally { weatherChecking = false; }
}

function officialRebuildNoop() { const slots = [...CANONICAL.values()].map((item) => item.scheduledAt).sort(); return { campaignId: CAMPAIGN_ID, imageVersion: CONTENT_VERSION, preservedPublished: 0, removedUnpublished: 0, inserted: 0, updated: 0, pendingReview: 0, activeTotal: CANONICAL.size, firstAt: slots[0] || "", lastAt: slots.at(-1) || "", signature: `social-final-${VERSION}` }; }

function install() {
  if (installed) return;
  installed = true;
  const previousLoad = Module._load;
  Module._load = function finalSocialLoader(request, parent, isMain) {
    const loaded = previousLoad.apply(this, arguments);
    if (request === "./social-official-rebuild" && loaded?.rebuildOfficialSocialSchedule) loaded.rebuildOfficialSocialSchedule = officialRebuildNoop;
    if (request === "./social-server" && loaded?.readStore && loaded?.writeStore) {
      socialApi = loaded;
      setImmediate(() => { try { console.log("Final social reconciliation", reconcile(loaded)); } catch (error) { console.error("Final social reconciliation failed", error.message); } checkWeather(loaded).then((result) => console.log("Weather social replacement", result)); });
      setTimeout(() => { try { reconcile(loaded); } catch (error) { console.error("Delayed social reconciliation failed", error.message); } }, 1_800).unref?.();
      if (!reconcileTimer) { reconcileTimer = setInterval(() => { try { reconcile(loaded); } catch (error) { console.error("Social reconciliation retry failed", error.message); } }, RECONCILE_INTERVAL_MS); reconcileTimer.unref?.(); }
      if (!weatherTimer) { weatherTimer = setInterval(() => checkWeather(loaded), WEATHER_INTERVAL_MS); weatherTimer.unref?.(); }
    }
    return loaded;
  };
}

install();
module.exports = { VERSION, CAMPAIGN_ID, CONTENT_VERSION, POSTS, CANONICAL, WEATHER_REPLACEMENTS, applyWeatherContent, buildCanonicalPost, reconcileStore, reconcile, taipeiDateKey, weatherUrl, selectWeather, nextCarePost, updateWeatherReplacement, checkWeather, officialRebuildNoop, install };
