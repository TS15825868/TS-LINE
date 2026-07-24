"use strict";

const line = require("@line/bot-sdk");

const VERSION = "402.1";
const APPROVED_MASCOT_VERSION = "402.1-20260724-approved";
const APPROVED_MASCOT_NAMES = Object.freeze([
  "welcome.jpg",
  "recommend.jpg",
  "combo.jpg",
  "usage.jpg",
  "faq.jpg",
  "service.jpg",
  "brand.jpg",
  "products.jpg",
  "cart.jpg",
]);
const MASCOT_PATH_MARKERS = ["/public/mascot/", "/mascot/"];
const BLOCKED_MASCOT_ASSETS = [];
const MASCOT_RULES = APPROVED_MASCOT_NAMES.map((name) => ({
  name,
  version: APPROVED_MASCOT_VERSION,
  aspectRatio: "1:1",
  aspectMode: "fit",
}));

function mascotFilename(value) {
  const url = String(value || "");
  const marker = MASCOT_PATH_MARKERS.find((item) => url.includes(item));
  if (!marker) return "";
  return decodeURIComponent(url.split(marker)[1].split(/[?#]/)[0] || "").split("/")[0];
}

function isApprovedMascotUrl(value) {
  const url = String(value || "");
  const name = mascotFilename(url);
  if (!name || !APPROVED_MASCOT_NAMES.includes(name)) return false;
  const approvedSource = url.includes("raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot/") || url.includes("/mascot/");
  return approvedSource && url.includes(`v=${APPROVED_MASCOT_VERSION}`);
}

function isBlockedMascotUrl(value) {
  const url = String(value || "");
  if (!MASCOT_PATH_MARKERS.some((marker) => url.includes(marker))) return false;
  return !isApprovedMascotUrl(url);
}

function applyImageSafety(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    for (const item of node) applyImageSafety(item);
    return node;
  }
  if (node.type === "bubble" && node.hero?.type === "image" && isBlockedMascotUrl(node.hero.url)) delete node.hero;
  for (const value of Object.values(node)) applyImageSafety(value);
  return node;
}

const Client = line?.messagingApi?.MessagingApiClient;
if (Client?.prototype?.replyMessage && !Client.prototype.__xjwImageSafetyInstalled) {
  const originalReplyMessage = Client.prototype.replyMessage;
  Client.prototype.replyMessage = function patchedReplyMessage(payload) {
    applyImageSafety(payload?.messages);
    return originalReplyMessage.call(this, payload);
  };
  Object.defineProperty(Client.prototype, "__xjwImageSafetyInstalled", { value: true, enumerable: false });
}

module.exports = {
  VERSION,
  APPROVED_MASCOT_VERSION,
  APPROVED_MASCOT_NAMES,
  BLOCKED_MASCOT_ASSETS,
  MASCOT_RULES,
  mascotFilename,
  isApprovedMascotUrl,
  isBlockedMascotUrl,
  applyImageSafety,
};