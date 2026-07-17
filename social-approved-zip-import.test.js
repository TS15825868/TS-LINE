"use strict";

const assert = require("assert");
const vm = require("vm");
const {
  TOPICS,
} = require("./social-official-rebuild");
const {
  selectApprovedEntries,
  mountApprovedSocialZipImport,
} = require("./social-approved-zip-import");

assert.strictEqual(TOPICS.length, 20);
const entries = TOPICS.map((topic) => ({
  name: `社群排程/${topic.file}`,
  method: 8,
  compressedSize: 100,
  uncompressedSize: 200,
  localOffset: 0,
}));
const selected = selectApprovedEntries(entries);
assert.strictEqual(selected.size, 20);
for (const topic of TOPICS) assert.ok(selected.has(topic.file.toUpperCase()));
assert.throws(
  () => selectApprovedEntries(entries.slice(1)),
  /ZIP 缺少 1 張正式圖片/,
  "missing approved originals must be rejected"
);
assert.throws(
  () => selectApprovedEntries([...entries, { name: "社群排程/extra.png" }]),
  /ZIP 含有非正式圖片/,
  "unexpected replacement images must be rejected"
);

const handlers = {};
const app = {
  get(path, handler) { handlers[`GET ${path}`] = handler; },
  use() {},
  post(path, ...handler) { handlers[`POST ${path}`] = handler.at(-1); },
};
mountApprovedSocialZipImport(app, {
  readSocialStore: () => ({ posts: [] }),
  writeSocialStore: () => {},
});
assert.ok(handlers["GET /internal/approved-social-import.js"]);
assert.ok(handlers["POST /internal/api/v2/social/import-approved-zip"]);
let script = "";
const response = {
  set() { return this; },
  send(value) { script = String(value); return this; },
};
handlers["GET /internal/approved-social-import.js"]({}, response);
assert.ok(script.includes("匯入 ZIP 並建立 20 篇待審貼文"));
assert.ok(script.includes("系統不重畫、不裁切、不重新排版"));
assert.ok(script.includes("/internal/api/v2/social/import-approved-zip"));
new vm.Script(script, { filename: "approved-social-import.browser.js" });

console.log("PASS exact 20 approved ZIP originals and executable internal App import button");