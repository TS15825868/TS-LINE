"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const VERSION = "2026-08-07-instagram-content-publishing-v2";
let installed = false;

function transformSocialServer(source) {
  let transformed = String(source || "");
  transformed = transformed
    .replace(
      'const IG_USER_ID = String(process.env.INSTAGRAM_USER_ID || "").trim();',
      'const IG_USER_ID = String(process.env.META_INSTAGRAM_USER_ID || process.env.INSTAGRAM_USER_ID || "").trim();'
    )
    .replace(
      'const IG_TOKEN = String(process.env.INSTAGRAM_ACCESS_TOKEN || "").trim();',
      'const IG_TOKEN = String(process.env.META_PAGE_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN || "").trim();'
    );

  const before = "https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(IG_USER_ID)}";
  const after = "https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(IG_USER_ID)}";
  transformed = transformed.split(before).join(after);

  if (!transformed.includes('process.env.META_INSTAGRAM_USER_ID || process.env.INSTAGRAM_USER_ID')) {
    throw new Error("找不到 Instagram User ID 設定，未套用 Meta 正式環境變數相容修正");
  }
  if (!transformed.includes('process.env.META_PAGE_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN')) {
    throw new Error("找不到 Instagram Token 設定，未套用 Meta 正式環境變數相容修正");
  }
  if (!transformed.includes("graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(IG_USER_ID)}/media")) {
    throw new Error("找不到 Instagram 內容發布端點，未套用安全修正");
  }
  return transformed;
}

function transformErpBridge(source) {
  const before = 'Instagram: Boolean(process.env.INSTAGRAM_USER_ID && process.env.INSTAGRAM_ACCESS_TOKEN),';
  const after = 'Instagram: Boolean((process.env.META_INSTAGRAM_USER_ID || process.env.INSTAGRAM_USER_ID) && (process.env.META_PAGE_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN)),';
  const transformed = String(source || "").replace(before, after);
  if (!transformed.includes('process.env.META_INSTAGRAM_USER_ID || process.env.INSTAGRAM_USER_ID')) {
    throw new Error("找不到 ERP Instagram 授權狀態，未套用 Meta 正式環境變數相容修正");
  }
  return transformed;
}

function transform(source, filename = "social-server.js") {
  const basename = path.basename(filename);
  if (basename === "social-server.js") return transformSocialServer(source);
  if (basename === "erp-publish-bridge.js") return transformErpBridge(source);
  return String(source || "");
}

function install() {
  if (installed) return;
  installed = true;
  const previousLoader = Module._extensions[".js"];
  const wrapped = function loadInstagramPublishingFix(module, filename) {
    const basename = path.basename(filename);
    if (!new Set(["social-server.js", "erp-publish-bridge.js"]).has(basename)) {
      return previousLoader(module, filename);
    }
    return module._compile(transform(fs.readFileSync(filename, "utf8"), filename), filename);
  };
  Object.defineProperty(wrapped, "__xjwInstagramContentPublishingFix", { value: VERSION });
  Module._extensions[".js"] = wrapped;
}

install();
module.exports = { VERSION, transform, transformSocialServer, transformErpBridge, install };
