"use strict";

const Module = require("module");
const line = require("@line/bot-sdk");

const VERSION = "402.1";
const APPROVED_MASCOT_VERSION = "402.1-20260724-approved";
const APPROVED_SCENES = Object.freeze([
  "welcome", "recommend", "combo", "usage", "faq", "service", "brand", "products", "cart",
]);
const assetUrl = (scene) => `https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot/${scene}.jpg?v=${APPROVED_MASCOT_VERSION}`;

function textContent(node) {
  if (!node || typeof node !== "object") return "";
  if (Array.isArray(node)) return node.map(textContent).join(" ");
  const own = node.type === "text" ? String(node.text || "") : "";
  return [own, ...Object.values(node).map(textContent)].join(" ");
}

function realProductHero(hero = {}) {
  return hero?.type === "image" && /\/xianjiawei\/images\/products-v3\//.test(String(hero.url || ""));
}

function existingScene(hero = {}) {
  const match = String(hero?.url || "").match(/\/mascot\/(welcome|recommend|combo|usage|faq|service|brand|products|cart)\.jpg/i);
  return match ? match[1].toLowerCase() : "";
}

function sceneForBubble(bubble = {}) {
  if (realProductHero(bubble.hero)) return "";
  const text = textContent(bubble);
  if (/購物車|購買清單/.test(text)) return "cart";
  if (/搭配|組合|套餐/.test(text)) return "combo";
  if (/常見問題|FAQ/.test(text)) return "faq";
  if (/客服|聯絡|確認|訂單|結帳|門市/.test(text)) return "service";
  if (/使用|沖泡|燉湯|料理/.test(text)) return "usage";
  if (/推薦|幫你選|怎麼選|比較產品|產品差異/.test(text)) return "recommend";
  if (/品牌|傳承|故事|漢方|百科|資料/.test(text)) return "brand";
  if (/產品總覽|產品選單|看產品|查看產品/.test(text)) return "products";
  return existingScene(bubble.hero) || (/歡迎|仙加味小老闆/.test(text) ? "welcome" : "");
}

function approvedHero(scene) {
  return {
    type: "image",
    url: assetUrl(scene),
    size: "full",
    aspectRatio: "1:1",
    aspectMode: "fit",
    backgroundColor: "#EFE4D2",
  };
}

function applyApprovedMascotScenes(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    for (const item of node) applyApprovedMascotScenes(item);
    return node;
  }
  if (node.type === "bubble") {
    const scene = sceneForBubble(node);
    if (scene && APPROVED_SCENES.includes(scene)) node.hero = approvedHero(scene);
    return node;
  }
  for (const value of Object.values(node)) applyApprovedMascotScenes(value);
  return node;
}

const Client = line?.messagingApi?.MessagingApiClient;
if (Client?.prototype?.replyMessage && !Client.prototype.__xjwApprovedMascotRuntimeInstalled) {
  const originalReplyMessage = Client.prototype.replyMessage;
  Client.prototype.replyMessage = function approvedMascotReply(payload) {
    applyApprovedMascotScenes(payload?.messages);
    return originalReplyMessage.call(this, payload);
  };
  Object.defineProperty(Client.prototype, "__xjwApprovedMascotRuntimeInstalled", { value: true, enumerable: false });
}

let installed = false;
function installHealthRoute() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function approvedMascotLoader(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./server" && loaded?.app && !loaded.app.__xjwApprovedMascotHealthMounted) {
      Object.defineProperty(loaded.app, "__xjwApprovedMascotHealthMounted", { value: true });
      loaded.app.get("/line/approved-mascot-healthz", (_req, res) => res.json({
        ok: true,
        version: VERSION,
        approvedMascotVersion: APPROVED_MASCOT_VERSION,
        approvedScenes: APPROVED_SCENES,
        approvedSceneCount: APPROVED_SCENES.length,
        realProductCardCount: Array.isArray(loaded.DATA?.products) ? loaded.DATA.products.length : 0,
        legacyMascotVersionsBlocked: true,
        socialReviewGateUnaffected: true,
        checkedAt: new Date().toISOString(),
      }));
    }
    return loaded;
  };
}

installHealthRoute();

module.exports = {
  VERSION,
  APPROVED_MASCOT_VERSION,
  APPROVED_SCENES,
  assetUrl,
  textContent,
  realProductHero,
  existingScene,
  sceneForBubble,
  approvedHero,
  applyApprovedMascotScenes,
  installHealthRoute,
};