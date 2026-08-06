"use strict";

const assert = require("assert");
const {
  VERSION,
  transformSocialServer,
  transformErpBridge,
} = require("./instagram-content-publishing-endpoint-fix");

assert.strictEqual(VERSION, "2026-08-07-instagram-content-publishing-v2");

const socialSource = `
const GRAPH_VERSION = String(process.env.META_GRAPH_VERSION || "v25.0").replace(/^\\/?/, "");
const IG_USER_ID = String(process.env.INSTAGRAM_USER_ID || "").trim();
const IG_TOKEN = String(process.env.INSTAGRAM_ACCESS_TOKEN || "").trim();
async function publishInstagram() {
  return fetch(\`https://graph.instagram.com/\${GRAPH_VERSION}/\${encodeURIComponent(IG_USER_ID)}/media\`);
}
`;
const transformedSocial = transformSocialServer(socialSource);
assert.ok(transformedSocial.includes("process.env.META_INSTAGRAM_USER_ID || process.env.INSTAGRAM_USER_ID"));
assert.ok(transformedSocial.includes("process.env.META_PAGE_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN"));
assert.ok(transformedSocial.includes("https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(IG_USER_ID)}/media"));
assert.ok(!transformedSocial.includes("https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(IG_USER_ID)}/media"));

const bridgeSource = `
function readiness() {
  return {
    Instagram: Boolean(process.env.INSTAGRAM_USER_ID && process.env.INSTAGRAM_ACCESS_TOKEN),
  };
}
`;
const transformedBridge = transformErpBridge(bridgeSource);
assert.ok(transformedBridge.includes("process.env.META_INSTAGRAM_USER_ID || process.env.INSTAGRAM_USER_ID"));
assert.ok(transformedBridge.includes("process.env.META_PAGE_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN"));

console.log("PASS Instagram official publishing endpoint and Meta credential aliases");
