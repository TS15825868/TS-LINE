"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const VERSION = "1.0.0";
const MASCOT_BASE = "https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot";
const CARE_IMAGE_MAP = Object.freeze({
  "care-work-rest-2026-07-29.jpg": "faq.jpg",
  "care-family-2026-08-05.jpg": "brand.jpg",
  "care-temperature-gap-2026-08-12.jpg": "service.jpg",
  "care-hydration-2026-08-19.jpg": "usage.jpg",
  "care-rainy-day-2026-08-26.jpg": "welcome.jpg",
});
let installed = false;

function approvedImageUrl(name) {
  const approved = CARE_IMAGE_MAP[name];
  return approved ? `${MASCOT_BASE}/${approved}?v=401.6-20260714-approved` : "";
}

function transformFirstBatch(source) {
  let result = String(source || "");
  for (const [generatedName, approvedName] of Object.entries(CARE_IMAGE_MAP)) {
    const replacement = `https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot/${approvedName}?v=401.6-20260714-approved`;
    result = result.replace(
      new RegExp("`\\$\\{RAW_BASE\\}/" + generatedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\?v=first-batch-v2`", "g"),
      `"${replacement}"`
    );
    result = result.replace(
      new RegExp("`\\$\\{RENDER_SOURCE\\}/" + generatedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\?v=first-batch-v2`", "g"),
      `"${replacement}"`
    );
  }
  return result;
}

function install() {
  if (installed) return;
  installed = true;
  const previousLoader = Module._extensions[".js"];
  const wrapped = function loadWithApprovedMascot(module, filename) {
    if (path.basename(filename) !== "social-first-batch-202607.js") {
      return previousLoader(module, filename);
    }
    const source = transformFirstBatch(fs.readFileSync(filename, "utf8"));
    return module._compile(source, filename);
  };
  Object.defineProperty(wrapped, "__xjwApprovedMascotAssets", { value: true });
  Module._extensions[".js"] = wrapped;
}

install();

module.exports = {
  VERSION,
  MASCOT_BASE,
  CARE_IMAGE_MAP,
  approvedImageUrl,
  transformFirstBatch,
  install,
};