"use strict";

const assert = require("assert");
const batch = require("./social-final-approved-batch");
const runtime = require("./runtime-social-stabilizer");
const review = require("./social-review-only-mode");

const normalized = runtime.normalizeStore({ posts: [] }, { posts: [] });
assert.strictEqual(runtime.VERSION, "2026-07-26-runtime-stabilizer-v2");
assert.strictEqual(batch.POSTS.length, 10);
assert.strictEqual(runtime.CANONICAL_IDS.size, 10);
assert.strictEqual(normalized.posts.filter((post) => runtime.CANONICAL_IDS.has(post.id)).length, 10);
assert.strictEqual(normalized.posts.filter((post) => post.status === "pending_review").length, 10);
assert(normalized.posts.every((post) => !post.scheduledAt));
assert(normalized.posts.every((post) => !post.reviewApprovedAt));

const secondPass = runtime.normalizeStore(normalized, normalized);
assert.strictEqual(secondPass.posts.length, 10);
assert.strictEqual(secondPass.posts.filter((post) => post.status === "pending_review").length, 10);
assert.strictEqual(review.CANONICAL_IDS.size, 10);

console.log("PASS early runtime stabilizer restores exactly ten canonical unreviewed posts without active schedules");