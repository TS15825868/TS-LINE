"use strict";

const assert = require("assert");
const { removeLegacyDuplicateDrafts } = require("./social-legacy-dedupe");

let store = {
  posts: [
    { id: "a", campaignId: "xjw-14day-202607", campaignKey: "xjw-14day-202607-day-1", title: "14天企劃 Day 1", status: "draft", result: {} },
    { id: "b", campaignId: "xjw-14day-202607", campaignKey: "xjw-14day-202607-day-2", title: "14天企劃 Day 2", status: "published", result: { facebook: { id: "1" } } },
    { id: "c", campaignId: "xjw-14day-202607", campaignKey: "xjw-14day-202607-day-3", title: "14天企劃 Day 3", status: "failed", result: { instagram: { id: "2" } } },
    { id: "d", campaignId: "xjw-30day-202607-v2", campaignKey: "xjw-30day-202607-v2-01", title: "保留", status: "draft", result: {} },
  ],
};
const readStore = () => JSON.parse(JSON.stringify(store));
const writeStore = (next) => { store = JSON.parse(JSON.stringify(next)); };
const result = removeLegacyDuplicateDrafts(readStore, writeStore);
assert.strictEqual(result.removed, 1);
assert.strictEqual(result.preservedHistory, 2);
assert.deepStrictEqual(store.posts.map((post) => post.id), ["b", "c", "d"]);
console.log("PASS legacy duplicate drafts removed while published history is preserved");
