"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("./facebook-page-token-bridge"), "utf8");
[
  "me/accounts",
  "pages_show_list",
  "pages_manage_posts",
  "CREATE_CONTENT",
  "publish_actions",
  "replaceAccessToken",
  "resolveFacebookPageAuth",
].forEach((token) => assert.ok(source.includes(token), `missing Facebook bridge token: ${token}`));
assert.ok(source.includes('graphUrl("me/accounts"'), "Facebook bridge must request the managed Pages list");
new vm.Script(source);
console.log("PASS Facebook user token to Page token resolution and friendly permission errors");
