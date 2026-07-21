"use strict";

const Module = require("module");

const VERSION = "1.0.0";
const CAMPAIGN_IDS = new Set([
  "xjw-approved-zip-202607-v1",
  "xjw-product-brand-202607-v1",
]);
const NUMBERED_TITLE = /^(小老闆知識|產品與品牌)\s+\d+\s*[｜|]\s*/u;

function cleanTitle(value) {
  return String(value || "").replace(NUMBERED_TITLE, "$1｜");
}

function normalizePost(post) {
  if (!post || typeof post !== "object" || !CAMPAIGN_IDS.has(post.campaignId)) return post;
  const title = cleanTitle(post.title);
  return title === post.title ? post : { ...post, title };
}

function normalizeStore(store) {
  if (!store || !Array.isArray(store.posts)) return { store, changed: 0 };
  let changed = 0;
  const posts = store.posts.map((post) => {
    const normalized = normalizePost(post);
    if (normalized !== post) changed += 1;
    return normalized;
  });
  return { store: changed ? { ...store, posts } : store, changed };
}

function wrapRebuild(loaded, functionName) {
  const original = loaded?.[functionName];
  if (typeof original !== "function" || original.__xjwTitleNormalizerWrapped) return;
  const wrapped = function normalizedSocialRebuild(readStore, writeStore, options) {
    return original(readStore, (nextStore) => {
      const normalized = normalizeStore(nextStore);
      return writeStore(normalized.store);
    }, options);
  };
  Object.defineProperty(wrapped, "__xjwTitleNormalizerWrapped", { value: true });
  loaded[functionName] = wrapped;
}

function normalizeLiveStore(loaded) {
  if (!loaded || typeof loaded.readStore !== "function" || typeof loaded.writeStore !== "function") return 0;
  const normalized = normalizeStore(loaded.readStore());
  if (normalized.changed) loaded.writeStore(normalized.store);
  return normalized.changed;
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);

    if (request === "./social-official-rebuild") {
      wrapRebuild(loaded, "rebuildOfficialSocialSchedule");
    }
    if (request === "./social-product-content-rebuild") {
      wrapRebuild(loaded, "rebuildProductContentSchedule");
    }
    if (request === "./social-server" && parent?.filename?.endsWith("internal-entry.js") && loaded?.app) {
      const run = () => {
        try {
          const changed = normalizeLiveStore(loaded);
          if (changed) console.log(`Social post display numbers removed: ${changed}`);
        } catch (error) {
          console.error("Social post title normalization failed", error);
        }
      };
      setImmediate(run);
      setTimeout(run, 250);
      setTimeout(run, 1500);
    }
    return loaded;
  };
}

install();

module.exports = {
  VERSION,
  CAMPAIGN_IDS,
  cleanTitle,
  normalizePost,
  normalizeStore,
  normalizeLiveStore,
  install,
};
