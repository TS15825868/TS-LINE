"use strict";

const fs = require("fs");

const SERVER_PATH = "server.js";
const SAFETY_PATH = "line-image-safety.js";
const TEST_PATH = "tests/line-approved-mascot-contract.js";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label} 預期 1 個匹配，實際 ${count}`);
  }
  return source.replace(before, after);
}

let server = fs.readFileSync(SERVER_PATH, "utf8");

server = replaceOnce(
  server,
  `const MASCOT_VERSION = "401.6-20260714";\n// LINE fetches images independently from the webhook. Use GitHub's CDN instead of\n// the sleeping Render instance so image cards appear faster and cache busting is reliable.\nconst mascotAssetUrl = (name) =>\n  \`https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot/\${name}.jpg?v=\${MASCOT_VERSION}\`;`,
  `const MASCOT_VERSION = "401.7-20260801";\n// LINE Messaging API images must be JPEG or PNG. These JPEG files are generated\n// from the same 15 approved website mascot scenes without cropping or redrawing.\nconst LINE_MASCOT_BASE = "https://ts15825868.github.io/xianjiawei/images/brand/line-oa";\nconst mascotAssetUrl = (name) =>\n  \`\${LINE_MASCOT_BASE}/\${name}.jpg?v=\${MASCOT_VERSION}\`;`,
  "LINE 正式小老闆 CDN"
);

server = replaceOnce(
  server,
  `const MASCOT_PATHS = {\n  welcome: mascotAssetUrl("welcome"),\n  recommend: mascotAssetUrl("recommend"),\n  usage: mascotAssetUrl("usage"),\n  faq: mascotAssetUrl("faq"),\n  service: mascotAssetUrl("service"),\n  brand: mascotAssetUrl("brand"),\n};`,
  `const MASCOT_PATHS = {\n  welcome: mascotAssetUrl("welcome"),\n  products: mascotAssetUrl("products"),\n  recommend: mascotAssetUrl("recommend"),\n  combo: mascotAssetUrl("combo"),\n  usage: mascotAssetUrl("usage"),\n  faq: mascotAssetUrl("faq"),\n  service: mascotAssetUrl("service"),\n  brand: mascotAssetUrl("brand"),\n};`,
  "LINE 小老闆用途映射"
);

server = replaceOnce(
  server,
  `function mascotPoseForTitle(title = "") {\n  if (/常見問題|FAQ/.test(title)) return "faq";\n  if (/客服|聯絡|確認|訂單|結帳|門市/.test(title)) return "service";\n  if (/使用|沖泡|燉湯|料理/.test(title)) return "usage";\n  if (/推薦|幫你選|怎麼選/.test(title)) return "recommend";\n  if (/傳承|故事|品牌|漢方|百科|資料/.test(title)) return "brand";\n  return "welcome";\n}`,
  `function mascotPoseForTitle(title = "") {\n  if (/常見問題|FAQ/.test(title)) return "faq";\n  if (/客服|聯絡|確認|訂單|結帳|門市/.test(title)) return "service";\n  if (/使用|沖泡|燉湯|料理/.test(title)) return "usage";\n  if (/搭配組合|組合方案|日常搭配/.test(title)) return "combo";\n  if (/推薦|幫你選|怎麼選/.test(title)) return "recommend";\n  if (/傳承|故事|品牌|漢方|百科|資料/.test(title)) return "brand";\n  if (/全部產品|產品總覽|看產品/.test(title)) return "products";\n  return "welcome";\n}`,
  "LINE 小老闆用途判斷"
);

server = replaceOnce(
  server,
  `    aspectRatio: "1:1",\n    aspectMode: "fit",`,
  `    aspectRatio: "4:3",\n    aspectMode: "fit",`,
  "LINE 小老闆完整圖比例"
);

const comboReplyPattern = /function comboReply\(\) \{[\s\S]*?\n\}\n\nfunction getCombo/;
if (!comboReplyPattern.test(server)) {
  throw new Error("找不到 comboReply 函式");
}
server = server.replace(
  comboReplyPattern,
  `function comboReply() {\n  return {\n    type: "flex",\n    altText: "仙加味搭配組合",\n    contents: mascotBubble(\n      "搭配組合｜依日常使用方式選擇",\n      \`搭配組合以產品型態、使用方式與生活情境為主：\n\n・固定日常安排：龜鹿膏\n・方便即飲：龜鹿飲30cc\n・沖泡與料理：龜鹿湯塊\n・家庭長期使用：龜鹿膠\n・自行搭配飲品：鹿茸粉\n\n若涉及個人體質、疾病、用藥或適不適合食用，會轉介合作中醫師協助判斷。\`,\n      [\n        { label: "查看搭配組合", text: "搭配組合" },\n        { label: "查看產品", text: "看產品" },\n        { label: "人工客服", text: "我要人工客服" },\n      ],\n      "combo"\n    ),\n  };\n}\n\nfunction getCombo`
);

server = replaceOnce(
  server,
  `        flexCard(\n          "日常搭配導覽",\n          "依日常節奏查看搭配組合。每組價格、可選組數、活動與加入購物車功能都保留在各方案卡中。",\n          [\n            { label: "看產品", text: "看產品" },\n            { label: "怎麼使用", text: "怎麼使用" },\n            { label: "人工客服", text: "我要人工客服" },\n          ]\n        ).contents,`,
  `        mascotBubble(\n          "日常搭配導覽",\n          "依日常節奏查看搭配組合。每組價格、可選組數、活動與加入購物車功能都保留在各方案卡中。",\n          [\n            { label: "看產品", text: "看產品" },\n            { label: "怎麼使用", text: "怎麼使用" },\n            { label: "人工客服", text: "我要人工客服" },\n          ],\n          "combo"\n        ),`,
  "搭配組合正式完整圖"
);

fs.writeFileSync(SERVER_PATH, server);

const safety = `"use strict";\n\n/**\n * LINE OA image safety.\n *\n * Old TS-LINE public/mascot files remain blocked. Approved purpose-specific\n * scenes are served as JPEG from the website CDN and derive from the locked\n * website mascot master without crop or redraw.\n */\nconst line = require("@line/bot-sdk");\n\nconst APPROVED_MASCOT_BASE =\n  "https://ts15825868.github.io/xianjiawei/images/brand/line-oa/";\nconst LEGACY_MASCOT_PATHS = [\n  "/public/mascot/",\n  "/mascot/",\n  "raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot/",\n];\nconst APPROVED_MASCOT_NAMES = [\n  "welcome.jpg",\n  "products.jpg",\n  "recommend.jpg",\n  "combo.jpg",\n  "usage.jpg",\n  "faq.jpg",\n  "service.jpg",\n  "brand.jpg",\n];\nconst BLOCKED_MASCOT_ASSETS = [...LEGACY_MASCOT_PATHS];\nconst MASCOT_RULES = APPROVED_MASCOT_NAMES.map(\n  (name) => \`\${APPROVED_MASCOT_BASE}\${name}\`\n);\n\nfunction isApprovedMascotUrl(value) {\n  const url = String(value || "").split("?")[0];\n  return MASCOT_RULES.includes(url);\n}\n\nfunction isBlockedMascotUrl(value) {\n  const url = String(value || "");\n  if (isApprovedMascotUrl(url)) return false;\n  return BLOCKED_MASCOT_ASSETS.some((asset) => url.includes(asset));\n}\n\nfunction applyImageSafety(node) {\n  if (!node || typeof node !== "object") return node;\n\n  if (Array.isArray(node)) {\n    for (const item of node) applyImageSafety(item);\n    return node;\n  }\n\n  if (node.type === "bubble" && node.hero?.type === "image" && isBlockedMascotUrl(node.hero.url)) {\n    delete node.hero;\n  }\n\n  for (const value of Object.values(node)) applyImageSafety(value);\n  return node;\n}\n\nconst Client = line?.messagingApi?.MessagingApiClient;\nif (Client?.prototype?.replyMessage && !Client.prototype.__xjwImageSafetyInstalled) {\n  const originalReplyMessage = Client.prototype.replyMessage;\n\n  Client.prototype.replyMessage = function patchedReplyMessage(payload) {\n    applyImageSafety(payload?.messages);\n    return originalReplyMessage.call(this, payload);\n  };\n\n  Object.defineProperty(Client.prototype, "__xjwImageSafetyInstalled", {\n    value: true,\n    enumerable: false,\n  });\n}\n\nmodule.exports = {\n  APPROVED_MASCOT_BASE,\n  APPROVED_MASCOT_NAMES,\n  BLOCKED_MASCOT_ASSETS,\n  MASCOT_RULES,\n  isApprovedMascotUrl,\n  isBlockedMascotUrl,\n  applyImageSafety,\n};\n`;
fs.writeFileSync(SAFETY_PATH, safety);

fs.mkdirSync("tests", { recursive: true });
const contract = `"use strict";\n\nconst assert = require("node:assert/strict");\nconst fs = require("node:fs");\nconst safety = require("../line-image-safety");\n\nconst server = fs.readFileSync("server.js", "utf8");\nconst approvedBase =\n  "https://ts15825868.github.io/xianjiawei/images/brand/line-oa";\nconst names = [\n  "welcome",\n  "products",\n  "recommend",\n  "combo",\n  "usage",\n  "faq",\n  "service",\n  "brand",\n];\n\nassert.ok(server.includes(approvedBase), "server 必須使用官網正式 LINE JPEG CDN");\nassert.ok(server.includes('aspectRatio: "4:3"'), "完整圖比例必須為 4:3");\nassert.ok(server.includes('aspectMode: "fit"'), "完整圖必須使用 fit，不可裁切");\nassert.ok(!server.includes("raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot"), "不得再使用舊 mascot CDN");\nfor (const name of names) {\n  assert.ok(server.includes(\`mascotAssetUrl("\${name}")\`), \`缺少正式圖映射：\${name}\`);\n  const url = \`\${approvedBase}/\${name}.jpg?v=contract\`;\n  assert.equal(safety.isApprovedMascotUrl(url), true, \`正式圖未列入白名單：\${name}\`);\n  assert.equal(safety.isBlockedMascotUrl(url), false, \`正式圖被安全層誤擋：\${name}\`);\n}\nassert.equal(\n  safety.isBlockedMascotUrl("https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot/recommend.jpg"),\n  true,\n  "舊拼湊 mascot 圖必須維持封鎖"\n);\n\nconst approvedBubble = {\n  type: "bubble",\n  hero: { type: "image", url: \`\${approvedBase}/recommend.jpg\` },\n};\nsafety.applyImageSafety(approvedBubble);\nassert.ok(approvedBubble.hero, "正式完整圖不得被移除");\n\nconst legacyBubble = {\n  type: "bubble",\n  hero: { type: "image", url: "https://example.com/public/mascot/recommend.jpg" },\n};\nsafety.applyImageSafety(legacyBubble);\nassert.equal(legacyBubble.hero, undefined, "舊拼湊圖必須被移除");\n\nconsole.log("PASS LINE OA 正式小老闆 JPEG、安全白名單、4:3 fit 與舊圖封鎖契約");\n`;
fs.writeFileSync(TEST_PATH, contract);

console.log("PASS 已安裝 LINE OA 正式完整小老闆圖片規則");
