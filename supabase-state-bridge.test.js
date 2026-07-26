"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const bridgeSource = fs.readFileSync(path.join(__dirname, "supabase-state-bridge.js"), "utf8");
const schemaSource = fs.readFileSync(path.join(__dirname, "supabase", "schema.sql"), "utf8");

for (const token of [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "xjw_app_state",
  "restoreAll",
  "startWatching",
  "writeRemote",
  "readRaw",
  "setInterval",
  "AbortController",
  "REQUEST_TIMEOUT_MS",
  "REQUEST_RETRIES",
  "saveChains",
  "retryAfterAt",
  "raw === snapshots.get(key)",
  "centralized retry backoff active",
  "stale Render writer blocked",
  "shutdownFlushEnabled: false",
  "normalizeStateForKey",
]) {
  assert.ok(bridgeSource.includes(token), `Supabase bridge missing ${token}`);
}

assert.ok(bridgeSource.includes("https://iphexhvjhsmelbgwzhhr.supabase.co"));
assert.ok(schemaSource.includes("create table if not exists public.xjw_app_state"));
assert.ok(schemaSource.includes("alter table public.xjw_app_state enable row level security"));
assert.ok(schemaSource.includes("grant select, insert, update, delete"));
assert.ok(schemaSource.includes("'internal'"));
assert.ok(schemaSource.includes("'social'"));
assert.ok(!bridgeSource.includes("await syncAll({ force: false });\n    process.exit(0);"), "shutdown must not flush stale local state");

const oldSecret = process.env.SUPABASE_SECRET_KEY;
const oldRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete require.cache[require.resolve("./supabase-state-bridge")];
const bridge = require("./supabase-state-bridge");
const health = bridge.health();
assert.strictEqual(bridge.VERSION, "1.3.0");
assert.strictEqual(health.storage, "local-json");
assert.strictEqual(health.projectUrl, "https://iphexhvjhsmelbgwzhhr.supabase.co");
assert.strictEqual(health.staleWriterProtection, true);
assert.strictEqual(health.shutdownFlushEnabled, false);
assert.strictEqual(typeof bridge.restoreAll, "function");
assert.strictEqual(typeof bridge.startWatching, "function");
assert.strictEqual(typeof bridge.saveFile, "function");
assert.ok(bridge.REQUEST_TIMEOUT_MS >= 1000);
assert.ok(bridge.REQUEST_RETRIES >= 0);

const batch = require("./social-final-approved-batch");
const duplicate = batch.POSTS[0];
const normalized = bridge.normalizeStateForKey("social", {
  posts: [
    { ...duplicate, status: "approved", scheduledAt: "2026-07-24T12:00:00.000Z", manualReviewRequired: true },
    { ...duplicate, status: "pending_review", scheduledAt: "", manualReviewRequired: true },
    ...batch.POSTS.slice(1),
  ],
}, {});
const canonical = normalized.posts.filter((post) => batch.CANONICAL_IDS.has(post.id));
assert.strictEqual(canonical.length, 10);
assert.strictEqual(new Set(canonical.map((post) => post.id)).size, 10);
assert.strictEqual(canonical.filter((post) => post.status === "pending_review").length, 10);
assert.ok(canonical.every((post) => !post.scheduledAt));

if (oldSecret !== undefined) process.env.SUPABASE_SECRET_KEY = oldSecret;
if (oldRole !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = oldRole;

console.log("PASS Supabase persistence normalization, stale Render writer blocking, timeout, retries, backoff, schema and local fallback");