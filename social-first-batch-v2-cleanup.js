"use strict";

const Module = require("module");

const VERSION = "1.0.0";
const LEGACY_ID = /^social-v2-/;
let installed = false;
let timer = null;

function cleanupLegacyBatch(loaded) {
  const store = loaded.readStore();
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  const nowIso = new Date().toISOString();
  let changed = 0;

  store.posts = store.posts.map((post) => {
    if (!LEGACY_ID.test(String(post.id || "")) || ["published", "cancelled"].includes(post.status)) return post;
    changed += 1;
    return {
      ...post,
      status: "cancelled",
      assetLocked: false,
      approvedAt: "",
      lastError: "已由新版5篇關心＋5篇正式產品DM貼文取代",
      updatedAt: nowIso,
    };
  });

  store.socialFirstBatchLegacyCleanupVersion = VERSION;
  store.socialFirstBatchLegacyCleanupUpdatedAt = nowIso;
  if (changed) loaded.writeStore(store);
  return changed;
}

function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./social-server" && loaded?.readStore && loaded?.writeStore) {
      setTimeout(() => {
        try {
          const changed = cleanupLegacyBatch(loaded);
          if (changed) console.log("Legacy first social batch cancelled", { changed });
        } catch (error) {
          console.error("Legacy first social batch cleanup failed", error);
        }
      }, 1200).unref?.();

      if (!timer) {
        let remaining = 4;
        timer = setInterval(() => {
          try { cleanupLegacyBatch(loaded); }
          catch (error) { console.error("Legacy first social batch cleanup retry failed", error); }
          remaining -= 1;
          if (remaining <= 0) { clearInterval(timer); timer = null; }
        }, 30000);
        timer.unref?.();
      }
    }
    return loaded;
  };
}

install();

module.exports = { VERSION, LEGACY_ID, cleanupLegacyBatch, install };
