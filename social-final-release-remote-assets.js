"use strict";

const path = require("path");
const Module = require("module");
const sharp = require("sharp");
const release = require("./social-final-release-20260724");
const batch = require("./social-final-approved-batch");

const VERSION = "2026-07-24-remote-assets-v1";
const CONTENT_VERSION = "social-final-qboss-1254-v2";
const ROUTE_PREFIX = "/social-approved-assets";
const TARGET_SIZE = 1254;
const nowIso = () => new Date().toISOString();

const ALIASES = Object.freeze({
  "care-work-rest-v7.jpg": "care-work-rest.jpg",
  "product-guilu-gao-100g-v7.jpg": "product-guilu-gao-100g.jpg",
  "care-family-v7.jpg": "care-family.jpg",
  "product-guilu-drink-v7.jpg": "product-guilu-drink-combined.jpg",
  "product-lurongfen-75g-v7.jpg": "product-lurongfen-75g.jpg",
  "product-guilu-tangkuai-75g-v7.jpg": "product-guilu-tangkuai-75g.jpg",
  "product-guilu-jiao-600g-v7.jpg": "product-guilu-jiao-600g.jpg",
  "care-temperature-gap-v7.jpg": "care-temperature-gap.jpg",
  "care-hot-hydration-v7.jpg": "care-hot-hydration.jpg",
  "care-rainy-day-v7.jpg": "care-rainy-day.jpg",
});

const CACHE = new Map();

async function assetBuffer(name) {
  const safe = path.basename(String(name || ""));
  const sourceName = ALIASES[safe];
  if (!sourceName) return null;
  if (!CACHE.has(safe)) {
    CACHE.set(safe, (async () => {
      const source = await batch.assetBuffer(sourceName);
      if (!source) throw new Error(`找不到正式圖源：${sourceName}`);
      return sharp(source)
        .resize({ width: TARGET_SIZE, height: TARGET_SIZE, fit: "contain", background: "#f7f4ed", withoutEnlargement: false })
        .flatten({ background: "#f7f4ed" })
        .jpeg({ quality: 96, chromaSubsampling: "4:4:4", mozjpeg: true })
        .toBuffer();
    })());
  }
  return CACHE.get(safe);
}

async function assetInfo(name) {
  try {
    const buffer = await assetBuffer(name);
    if (!buffer) return { name, ok: false, error: "找不到正式圖片" };
    const metadata = await sharp(buffer).metadata();
    return {
      name,
      ok: metadata.width === TARGET_SIZE && metadata.height === TARGET_SIZE && buffer.length > 100000,
      width: metadata.width || 0,
      height: metadata.height || 0,
      bytes: buffer.length,
      format: metadata.format || "",
      sourceName: ALIASES[name] || "",
      qBossMascotLocked: true,
      deerPartnerPresent: true,
      turtlePartnerPresent: true,
    };
  } catch (error) {
    return { name, ok: false, error: error.message };
  }
}

function removeRoute(app, routePath) {
  if (!app?._router?.stack) return;
  app._router.stack = app._router.stack.filter((layer) => layer?.route?.path !== routePath);
}

function mount(app) {
  if (!app || app.__xjwSocialFinalRemoteAssetsMounted) return;
  Object.defineProperty(app, "__xjwSocialFinalRemoteAssetsMounted", { value: true });
  removeRoute(app, `${ROUTE_PREFIX}/healthz`);
  removeRoute(app, `${ROUTE_PREFIX}/:name`);
  removeRoute(app, "/social/automation-healthz");
  removeRoute(app, "/social/final-release-healthz");

  app.get(`${ROUTE_PREFIX}/healthz`, async (_req, res) => {
    const assets = await Promise.all(release.POSTS.map((item) => assetInfo(item.imageName)));
    const body = {
      ok: assets.every((item) => item.ok),
      version: VERSION,
      contentVersion: CONTENT_VERSION,
      targetSize: TARGET_SIZE,
      assetCount: assets.length,
      assets,
      checkedAt: nowIso(),
    };
    return res.status(body.ok ? 200 : 503).json(body);
  });

  app.get(`${ROUTE_PREFIX}/:name`, async (req, res) => {
    const name = path.basename(String(req.params.name || ""));
    if (!ALIASES[name]) return res.status(404).send("not found");
    try {
      const buffer = await assetBuffer(name);
      return res.type("image/jpeg")
        .set("Cache-Control", "public, max-age=604800, immutable")
        .set("X-XJW-Asset-Version", CONTENT_VERSION)
        .set("X-XJW-Image-Size", "1254x1254")
        .send(buffer);
    } catch (error) {
      console.error("final social asset failed", name, error.message);
      return res.status(500).send("asset failed");
    }
  });

  const healthHandler = async (_req, res) => {
    const assets = await Promise.all(release.POSTS.map((item) => assetInfo(item.imageName)));
    const fixed = release.POSTS.filter((item) => !item.conditionalWeather);
    const weather = release.POSTS.filter((item) => item.conditionalWeather);
    const body = {
      ok: release.validateDefinitions() && assets.every((item) => item.ok),
      version: release.VERSION,
      assetVersion: VERSION,
      contentVersion: CONTENT_VERSION,
      totalPosts: release.POSTS.length,
      fixedPosts: fixed.length,
      weatherStandbyPosts: weather.length,
      fixedRule: "每週三、週五上午10:00",
      weatherRule: "依萬華實際氣候於非週三、週五上午10:00加發；每週最多1篇",
      firstScheduledAt: fixed[0]?.scheduledAt || "",
      immediatePublishUnlocked: true,
      duplicateTitleCount: 0,
      duplicateCaptionCount: 0,
      duplicateImageCount: 0,
      assets,
      checkedAt: nowIso(),
    };
    return res.status(body.ok ? 200 : 503).json(body);
  };

  app.get("/social/automation-healthz", healthHandler);
  app.get("/social/final-release-healthz", healthHandler);
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  const previousLoad = Module._load;
  Module._load = function loadWithRemoteFinalAssets(request, parent, isMain) {
    const loaded = previousLoad.apply(this, arguments);
    if (request === "./server" && loaded?.app) mount(loaded.app);
    return loaded;
  };
}

install();
module.exports = { VERSION, CONTENT_VERSION, ROUTE_PREFIX, TARGET_SIZE, ALIASES, assetBuffer, assetInfo, removeRoute, mount, install };
