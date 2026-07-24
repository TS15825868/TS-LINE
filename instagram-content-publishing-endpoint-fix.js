"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const VERSION = "2026-07-24-instagram-content-publishing-v1";
let installed = false;

function transform(source) {
  const before = "https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(IG_USER_ID)}";
  const after = "https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(IG_USER_ID)}";
  const transformed = String(source || "").split(before).join(after);
  if (transformed === source || !transformed.includes("graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(IG_USER_ID)}/media")) {
    throw new Error("找不到 Instagram 內容發布端點，未套用安全修正");
  }
  return transformed;
}

function install() {
  if (installed) return;
  installed = true;
  const previousLoader = Module._extensions[".js"];
  const wrapped = function loadInstagramPublishingFix(module, filename) {
    if (path.basename(filename) !== "social-server.js") return previousLoader(module, filename);
    return module._compile(transform(fs.readFileSync(filename, "utf8")), filename);
  };
  Object.defineProperty(wrapped, "__xjwInstagramContentPublishingFix", { value: VERSION });
  Module._extensions[".js"] = wrapped;
}

install();
module.exports = { VERSION, transform, install };
