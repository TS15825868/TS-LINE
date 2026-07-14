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
]) {
  assert.ok(bridgeSource.includes(token), `Supabase bridge missing ${token}`);
}

assert.ok(bridgeSource.includes("https://iphexhvjhsmelbgwzhhr.supabase.co"));
assert.ok(schemaSource.includes("create table if not exists public.xjw_app_state"));
assert.ok(schemaSource.includes("alter table public.xjw_app_state enable row level security"));
assert.ok(schemaSource.includes("grant select, insert, update, delete"));
assert.ok(schemaSource.includes("'internal'"));
assert.ok(schemaSource.includes("'social'"));

const oldSecret = process.env.SUPABASE_SECRET_KEY;
const oldRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete require.cache[require.resolve("./supabase-state-bridge")];
const bridge = require("./supabase-state-bridge");
const health = bridge.health();
assert.strictEqual(health.storage, "local-json");
assert.strictEqual(health.projectUrl, "https://iphexhvjhsmelbgwzhhr.supabase.co");
assert.strictEqual(typeof bridge.restoreAll, "function");
assert.strictEqual(typeof bridge.startWatching, "function");
if (oldSecret !== undefined) process.env.SUPABASE_SECRET_KEY = oldSecret;
if (oldRole !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = oldRole;

console.log("PASS Supabase persistence bridge, schema, fallback and project routing");
