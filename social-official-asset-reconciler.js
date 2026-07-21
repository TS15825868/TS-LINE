"use strict";

const Module = require("module");
const batch = require("./social-first-batch-202607");

const VERSION = "1.0.0";
const RECONCILE_MS = Math.max(60_000, Number(process.env.SOCIAL_ASSET_RECONCILE_MS || 5 * 60_000));
const TEMPLATE_BY_ID = new Map(batch.POSTS.map((post) => [post.id, post]));
let installed = false;
let timer = null;

function templateFor(post = {}) {
  return TEMPLATE_BY_ID.get(String(post.id || "")) || TEMPLATE_BY_ID.get(String(post.autoTemplateId || "")) || null;
}

function reconcileStore(store) {
  if (!store || !Array.isArray(store.posts)) return { store, changed: 0 };
  const updatedAt = new Date().toISOString();
  let changed = 0;
  const posts = store.posts.map((post) => {
    if (!post || ["published", "cancelled"].includes(post.status)) return post;
    const template = templateFor(post);
    if (!template) return post;
    const sourceImageFile = String(template.imageUrl || "").split("/").pop().split("?")[0] || template.sourceImageFile || "";
    if (
      post.imageUrl === template.imageUrl &&
      post.sourceImageFile === sourceImageFile &&
      post.officialAssetVersion === VERSION
    ) return post;
    changed += 1;
    return {
      ...post,
      imageUrl: template.imageUrl,
      sourceImageFile,
      officialAssetVersion: VERSION,
      officialAssetLocked: true,
      updatedAt,
    };
  });
  if (!changed && store.socialOfficialAssetVersion === VERSION) return { store, changed: 0 };
  return {
    changed,
    store: {
      ...store,
      posts,
      socialOfficialAssetVersion: VERSION,
      socialOfficialAssetUpdatedAt: updatedAt,
    },
  };
}

function reconcile(loaded) {
  if (!loaded?.readStore || !loaded?.writeStore) return { changed: 0 };
  const current = loaded.readStore();
  const result = reconcileStore(current);
  if (result.changed || current.socialOfficialAssetVersion !== VERSION) loaded.writeStore(result.store);
  return { changed: result.changed };
}

function setup(loaded) {
  setTimeout(() => {
    try {
      const result = reconcile(loaded);
      if (result.changed) console.log("Official social assets reconciled", result);
    } catch (error) {
      console.error("Official social asset reconciliation failed", error.message);
    }
  }, 1_250).unref?.();

  if (!timer) {
    timer = setInterval(() => {
      try { reconcile(loaded); }
      catch (error) { console.error("Official social asset reconciliation retry failed", error.message); }
    }, RECONCILE_MS);
    timer.unref?.();
  }
}

function install() {
  if (installed) return;
  installed = true;
  const previousLoad = Module._load;
  Module._load = function loadWithOfficialAssetReconciliation(request, parent, isMain) {
    const loaded = previousLoad.apply(this, arguments);
    if (request === "./social-server" && parent?.filename?.endsWith("internal-entry.js") && loaded?.readStore && loaded?.writeStore) {
      setup(loaded);
    }
    return loaded;
  };
}

install();

module.exports = {
  VERSION,
  TEMPLATE_BY_ID,
  templateFor,
  reconcileStore,
  reconcile,
  setup,
  install,
};