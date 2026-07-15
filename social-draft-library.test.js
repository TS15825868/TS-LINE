"use strict";

const assert = require("assert");
const { CAMPAIGN_ID, POSTS, seedSocialDraftLibrary } = require("./social-draft-library");

assert.strictEqual(POSTS.length, 30);
assert.strictEqual(new Set(POSTS.map((post) => post.campaignKey)).size, 30);
assert.ok(POSTS.every((post) => post.campaignKey.startsWith(CAMPAIGN_ID)));
assert.ok(POSTS.every((post) => /^https:\/\//.test(post.imageUrl)));
assert.ok(POSTS.every((post) => post.instagramCaption.includes("#仙加味")));
assert.ok(POSTS.every((post) => post.facebookCaption.includes("#仙加味")));
assert.ok(POSTS.every((post) => post.publishInstagram && post.publishFacebook));
assert.ok(POSTS.every((post) => Number.isFinite(new Date(post.scheduledAt).getTime())));

let state = { posts: [] };
const readStore = () => JSON.parse(JSON.stringify(state));
const writeStore = (next) => { state = JSON.parse(JSON.stringify(next)); };

const first = seedSocialDraftLibrary(readStore, writeStore);
assert.deepStrictEqual(first, { campaignId: CAMPAIGN_ID, added: 30, total: 30 });
assert.strictEqual(state.posts.length, 30);
assert.ok(state.posts.every((post) => post.status === "draft"));

const second = seedSocialDraftLibrary(readStore, writeStore);
assert.strictEqual(second.added, 0);
assert.strictEqual(state.posts.length, 30);

console.log("PASS 30 ready-to-review social drafts");
