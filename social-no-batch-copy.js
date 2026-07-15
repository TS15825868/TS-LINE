"use strict";

const VERSION = "1.0.0";

const REPLACEMENTS = [
  ["保留批號期限與保存標示", "保留品名規格與保存標示"],
  ["批號與保存資訊先留好", "品名規格與保存資訊先留好"],
  ["拍下批號與保存標示", "拍下品名、規格與保存標示"],
  ["拍下批號、期限與保存方式", "拍下品名、規格、期限與保存方式"],
  ["品名、批號、期限與保存方式", "品名、規格、期限與保存方式"],
  ["完整包裝、批號期限，以及實際內容與保存環境", "完整包裝、產品名稱與規格，以及實際內容與保存環境"],
  ["完整包裝正反面、批號與有效日期、實際內容物與目前保存狀況", "完整包裝正反面、產品名稱與規格、有效日期，以及實際內容物與目前保存狀況"],
  ["保留包裝與批號並拍照詢問", "保留完整包裝並拍照詢問"],
  ["批號與有效日期", "產品名稱、規格與有效日期"],
  ["批號期限", "產品名稱、規格與有效日期"],
  ["批號", "產品標示"],
];

function replaceText(value) {
  let text = String(value ?? "");
  for (const [from, to] of REPLACEMENTS) text = text.split(from).join(to);
  return text;
}

function removeBatchNumberWording(readStore, writeStore) {
  const store = readStore();
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  let updated = 0;

  for (const post of store.posts) {
    let changed = false;
    for (const key of ["title", "instagramCaption", "facebookCaption", "lastError"]) {
      if (typeof post[key] !== "string") continue;
      const next = replaceText(post[key]);
      if (next !== post[key]) {
        post[key] = next;
        changed = true;
      }
    }
    if (changed) {
      post.updatedAt = new Date().toISOString();
      updated += 1;
    }
  }

  if (updated) writeStore(store);
  return { version: VERSION, updated, total: store.posts.length };
}

module.exports = { VERSION, REPLACEMENTS, replaceText, removeBatchNumberWording };
