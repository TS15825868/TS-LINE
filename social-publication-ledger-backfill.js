"use strict";

const Module = require("module");
const guard = require("./social-publish-guard");

const VERSION = "1.0.0";
let installed = false;
let timer = null;

function countEntries(ledger = {}) {
  return Object.values(ledger).reduce((total, group) => total + Object.keys(group || {}).length, 0);
}

function backfill(readStore, writeStore) {
  const store = readStore();
  const before = countEntries(store.publicationLedger || {});
  for (const post of store.posts || []) {
    for (const key of ["instagram", "facebook"]) {
      if (!guard.platformEnabled(post, key) || !guard.platformDone(post, key)) continue;
      const result = post.result?.[key] || {};
      const timestamp = post[`${key}PublishedAt`] || post.publishedAt || post.updatedAt || new Date().toISOString();
      guard.recordPublication(store, post, key, result, timestamp);
    }
  }
  const after = countEntries(store.publicationLedger || {});
  if (after !== before) writeStore(store);
  return { version: VERSION, before, after, added: after - before };
}

function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./social-server" && loaded?.readStore && loaded?.writeStore && !loaded.__xjwPublicationLedgerBackfill) {
      Object.defineProperty(loaded, "__xjwPublicationLedgerBackfill", { value: true });
      setImmediate(() => {
        try { console.log("Publication ledger backfill", backfill(loaded.readStore, loaded.writeStore)); }
        catch (error) { console.error("Publication ledger backfill failed", error.message); }
      });
      if (!timer) {
        timer = setInterval(() => {
          try { backfill(loaded.readStore, loaded.writeStore); }
          catch (error) { console.error("Publication ledger refresh failed", error.message); }
        }, 30 * 60 * 1000);
        timer.unref?.();
      }
    }
    return loaded;
  };
}

install();

module.exports = { VERSION, countEntries, backfill, install };
