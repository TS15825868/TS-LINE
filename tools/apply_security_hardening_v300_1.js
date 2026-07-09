"use strict";

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(ROOT, name), "utf8");
const write = (name, content) => fs.writeFileSync(path.join(ROOT, name), content, "utf8");

function replaceRegex(content, pattern, replacement, label) {
  const next = content.replace(pattern, replacement);
  if (next === content) throw new Error(`找不到預期內容：${label}`);
  return next;
}

let server = read("server.js");
if (server.includes("function productMenuReply()") && server.includes("const CRM_TIMEOUT_MS")) {
  console.log("LINE OA v300.1 security and UX changes already applied");
  process.exit(0);
}

server = server.replace("仙加味 LINE OA Bot v300.0", "仙加味 LINE OA Bot v300.1");
server = server.replace('const VERSION = "v300.0";', 'const VERSION = "v300.1";');
server = replaceRegex(
  server,
  /const CRM_URL = process\.env\.CRM_URL \|\| [^;]+;/,
  'const CRM_URL = process.env.CRM_URL || "";\nconst CRM_TIMEOUT_MS = Number(process.env.CRM_TIMEOUT_MS || 8000);\nconst STATE_TTL_MS = Number(process.env.STATE_TTL_MS || 24 * 60 * 60 * 1000);\nconst STATE_CLEANUP_INTERVAL_MS = Number(process.env.STATE_CLEANUP_INTERVAL_MS || 60 * 60 * 1000);\nconst MAX_STATE_ENTRIES = Number(process.env.MAX_STATE_ENTRIES || 10000);',
  "CRM 設定"
);
server = replaceRegex(
  server,
  /const config = \{[\s\S]*?\n\};\n\nconst app = express\(\);/,
  'const config = {\n  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "",\n  channelSecret: process.env.CHANNEL_SECRET || "",\n};\n\nconst app = express();',
  "LINE 憑證設定"
);

const loadDataBlock = [
  'function validateData(data) {',
  '  if (!data || typeof data !== "object") throw new Error("data.json 必須是 JSON 物件");',
  '  if (!Array.isArray(data.products) || !data.products.length) throw new Error("data.json 缺少 products");',
  '  for (const product of data.products) {',
  '    for (const field of ["id", "name", "price", "unit", "image", "usage", "ingredients"]) {',
  '      if (product[field] === undefined || product[field] === null || product[field] === "") {',
  '        throw new Error((product.id || "unknown") + " 缺少 " + field);',
  '      }',
  '    }',
  '  }',
  '  return data;',
  '}',
  '',
  'function loadData() {',
  '  const file = path.join(__dirname, "data.json");',
  '  try {',
  '    const data = validateData(JSON.parse(fs.readFileSync(file, "utf8")));',
  '    data.siteUrl = data.siteUrl || SITE_URL;',
  '    data.products = data.products.map((product) => ({',
  '      ...product,',
  '      displayName: product.displayName || product.name,',
  '      spec: product.spec || product.size || "",',
  '      offers: product.offers || [],',
  '      orderStatus: "開放下單",',
  '      shippingNotice: "實際庫存與出貨時間由客服確認。",',
  '    }));',
  '    return data;',
  '  } catch (error) {',
  '    console.error("data.json 載入失敗：" + error.message);',
  '    throw error;',
  '  }',
  '}',
  '',
  'function money',
].join("\n");
server = replaceRegex(server, /function loadData\(\) \{[\s\S]*?\n\}\n\nfunction money/, loadDataBlock, "資料載入");

const stateBlock = [
  'function cleanupExpiredStates(now = Date.now()) {',
  '  for (const [userId, state] of states) {',
  '    if (now - Number(state.lastActivity || 0) > STATE_TTL_MS) states.delete(userId);',
  '  }',
  '}',
  '',
  'function getState(userId) {',
  '  const now = Date.now();',
  '  cleanupExpiredStates(now);',
  '  if (!states.has(userId)) {',
  '    if (states.size >= MAX_STATE_ENTRIES) {',
  '      const oldest = [...states.entries()].sort((a, b) => (a[1].lastActivity || 0) - (b[1].lastActivity || 0))[0];',
  '      if (oldest) states.delete(oldest[0]);',
  '    }',
  '    states.set(userId, { cart: [], checkout: null, lastActivity: now });',
  '  }',
  '  const state = states.get(userId);',
  '  state.lastActivity = now;',
  '  return state;',
  '}',
  '',
  'const cleanupTimer = setInterval(cleanupExpiredStates, STATE_CLEANUP_INTERVAL_MS);',
  'cleanupTimer.unref?.();',
  '',
  'function sanitizeUserText(value, maxLength = 500) {',
  '  return String(value || "")',
  '    .replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]/g, "")',
  '    .replace(/\\s+/g, " ")',
  '    .trim()',
  '    .slice(0, maxLength);',
  '}',
  '',
  'function pb',
].join("\n");
server = replaceRegex(server, /function getState\(userId\) \{[\s\S]*?\n\}\n\nfunction pb/, stateBlock, "狀態管理");

const crmBlock = [
  'async function saveCRM(payload) {',
  '  if (!CRM_URL) return { ok: false, error: "CRM_URL is not configured" };',
  '  const controller = new AbortController();',
  '  const timeout = setTimeout(() => controller.abort(), CRM_TIMEOUT_MS);',
  '  try {',
  '    const response = await fetch(CRM_URL, {',
  '      method: "POST",',
  '      headers: { "content-type": "application/json" },',
  '      body: JSON.stringify(payload),',
  '      signal: controller.signal,',
  '    });',
  '    const result = await response.json().catch(() => ({}));',
  '    if (!response.ok) return { ok: false, error: "CRM HTTP " + response.status, ...result };',
  '    return typeof result.ok === "boolean" ? result : { ok: true, ...result };',
  '  } catch (error) {',
  '    const message = error.name === "AbortError" ? "CRM timeout after " + CRM_TIMEOUT_MS + "ms" : error.message;',
  '    console.error("CRM 寫入失敗：" + message);',
  '    return { ok: false, error: message || "CRM request failed" };',
  '  } finally {',
  '    clearTimeout(timeout);',
  '  }',
  '}',
  '',
  'async function continueCheckout',
].join("\n");
server = replaceRegex(server, /async function saveCRM\(payload\) \{[\s\S]*?\n\}\n\nasync function continueCheckout/, crmBlock, "CRM 逾時");

server = server.replace('  if (checkout.step === "name") {\n    checkout.name = text;', '  if (checkout.step === "name") {\n    const name = sanitizeUserText(text, 40);\n    if (!name) return reply(event.replyToken, textMsg("請輸入收件人姓名。"));\n    checkout.name = name;');
server = server.replace('  if (checkout.step === "address") {\n    checkout.address = text;', '  if (checkout.step === "address") {\n    const address = sanitizeUserText(text, 160);\n    if (address.length < 2) return reply(event.replyToken, textMsg("請輸入完整地址或 7-11 門市資料。"));\n    checkout.address = address;');
server = server.replace('  const text = String(event.message.text || "").trim();', '  const text = sanitizeUserText(event.message.text, 500);');
server = server.replace('    credentialsConfigured: Boolean(config.channelAccessToken && config.channelSecret),\n  });', '    credentialsConfigured: Boolean(config.channelAccessToken && config.channelSecret),\n    crmConfigured: Boolean(CRM_URL),\n    activeStates: states.size,\n  });');

const productMenuBlock = [
  'function productCarousel() {',
  '  return {',
  '    type: "flex",',
  '    altText: "仙加味產品",',
  '    contents: { type: "carousel", contents: DATA.products.map(productBubble) },',
  '  };',
  '}',
  '',
  'function productMenuReply() {',
  '  const lines = DATA.products.map((product, index) =>',
  '    (index + 1) + ". " + product.displayName + "｜" + product.spec + "｜" + (product.purpose || "日常食補")',
  '  );',
  '  return textMsg(',
  '    "請選擇想了解或下單的產品：\\n\\n" + lines.join("\\n") + "\\n\\n點選下方產品後，可查看規格、價格、使用方式並選擇數量。",',
  '    DATA.products.map((product) => ({ label: product.displayName.slice(0, 20), text: "產品詳情｜" + product.id }))',
  '  );',
  '}',
  '',
  'function priceCarousel',
].join("\n");
server = replaceRegex(server, /function productCarousel\(\) \{[\s\S]*?\n\}\n\nfunction priceCarousel/, productMenuBlock, "產品選單");

const comboBlock = [
  'function comboReply() {',
  '  return comboMenuReply();',
  '}',
  '',
  'function comboMenuReply() {',
  '  const combos = DATA.offers?.comboOffers || [];',
  '  if (!combos.length) return textMsg("目前搭配方案由客服依需求協助整理。", mainQuick());',
  '  const lines = combos.map((combo, index) =>',
  '    (index + 1) + ". " + combo.name + "\\n" + (combo.items || []).map((item) => "・" + item).join("\\n") + "\\n" + (combo.desc || "")',
  '  );',
  '  return textMsg(',
  '    "請選擇想查看的搭配方案：\\n\\n" + lines.join("\\n\\n") + "\\n\\n實際價格、庫存與活動由客服確認。",',
  '    combos.slice(0, 10).map((combo, index) => ({ label: combo.name.slice(0, 20), text: "搭配方案｜" + index }))',
  '  );',
  '}',
  '',
  'function comboDetailReply(index) {',
  '  const combo = (DATA.offers?.comboOffers || [])[Number(index)];',
  '  if (!combo) return comboMenuReply();',
  '  return flexCard(',
  '    combo.name,',
  '    (combo.items || []).map((item) => "・" + item).join("\\n") + "\\n\\n" + (combo.desc || "") + "\\n\\n" + (combo.priceNote || "價格與活動由客服確認"),',
  '    [',
  '      { label: "看全部產品", text: "看產品" },',
  '      { label: "其他搭配方案", text: "搭配組合" },',
  '      { label: "人工客服", text: "我要人工客服" },',
  '    ]',
  '  );',
  '}',
  '',
  'function usageChooserReply',
].join("\n");
server = replaceRegex(server, /function comboReply\(\) \{[\s\S]*?\n\}\n\nfunction usageChooserReply/, comboBlock, "搭配方案");

server = server.replace(
  '  const state = getState(event.source.userId || "anonymous");\n\n  if (state.checkout)',
  '  const state = getState(event.source.userId || "anonymous");\n\n  const productDetailMatch = text.match(/^產品詳情｜([^｜]+)$/);\n  if (productDetailMatch) {\n    const product = getProduct(productDetailMatch[1]);\n    return reply(event.replyToken, product ? { type: "flex", altText: product.displayName, contents: productBubble(product) } : productMenuReply());\n  }\n\n  const comboDetailMatch = text.match(/^搭配方案｜(\\d+)$/);\n  if (comboDetailMatch) return reply(event.replyToken, comboDetailReply(comboDetailMatch[1]));\n\n  if (state.checkout)'
);
server = server.replace('return reply(event.replyToken, productCarousel());', 'return reply(event.replyToken, productMenuReply());');
server = server.replace('return reply(event.replyToken, comboReply());', 'return reply(event.replyToken, comboMenuReply());');
server = server.replace('  productCarousel,\n  priceCarousel,', '  productCarousel,\n  productMenuReply,\n  priceCarousel,');
server = server.replace('  comboReply,\n  usageChooserReply,', '  comboReply,\n  comboMenuReply,\n  comboDetailReply,\n  usageChooserReply,');
server = server.replace('  isSensitiveHealthQuestion,\n};', '  isSensitiveHealthQuestion,\n  validateData,\n  sanitizeUserText,\n  cleanupExpiredStates,\n};');
write("server.js", server);

let test = read("test.js");
test = test.replace('assert.strictEqual(VERSION, "v300.0");', 'assert.strictEqual(VERSION, "v300.1");');
test = test.replace('  productCarousel,\n  priceCarousel,', '  productCarousel,\n  productMenuReply,\n  priceCarousel,');
test = test.replace('  comboReply,\n  usageChooserReply,', '  comboReply,\n  comboMenuReply,\n  comboDetailReply,\n  usageChooserReply,');
test += '\nassert.strictEqual(productMenuReply().quickReply.items.length, 6);\nassert.ok(comboMenuReply().text.includes("日常節奏組"));\nassert.ok(comboDetailReply(0).contents.body.contents[0].text.includes("日常節奏組"));\n';
write("test.js", test);

const pkg = JSON.parse(read("package.json"));
pkg.version = "3.0.1";
pkg.scripts.test = "node test.js && node catalog.test.js && node security.test.js";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let workflow = read(".github/workflows/verify-line-and-website-catalog.yml");
workflow = workflow.replace('grep \'"version":"v300.0"\'', 'grep \'"version":"v300.1"\'');
workflow = workflow.replace("          node --check catalog.test.js\n", "          node --check catalog.test.js\n          node --check security.test.js\n");
write(".github/workflows/verify-line-and-website-catalog.yml", workflow);

write("security.test.js", '"use strict";\nconst assert = require("assert");\nconst fs = require("fs");\nconst { validateData, sanitizeUserText, cleanupExpiredStates, VERSION } = require("./server");\nconst source = fs.readFileSync("server.js", "utf8");\nassert.strictEqual(VERSION, "v300.1");\nassert.ok(!source.includes("script.google.com/macros/s/"));\nassert.ok(!/channelAccessToken:\\s*process\\.env\\.CHANNEL_ACCESS_TOKEN\\s*\\|\\|\\s*["\\\'][A-Za-z0-9+/=]{40,}/.test(source));\nassert.ok(!/channelSecret:\\s*process\\.env\\.CHANNEL_SECRET\\s*\\|\\|\\s*["\\\'][a-f0-9]{32}/i.test(source));\nassert.strictEqual(sanitizeUserText("  王\\u0000 小明  ", 40), "王 小明");\nassert.strictEqual(sanitizeUserText("abcdef", 3), "abc");\nassert.throws(() => validateData({ products: [] }), /products/);\ncleanupExpiredStates(Date.now());\nconsole.log("PASS security and UX v300.1");\n');
write(".env.example", "CHANNEL_ACCESS_TOKEN=\nCHANNEL_SECRET=\nCRM_URL=\nCRM_TIMEOUT_MS=8000\nSTATE_TTL_MS=86400000\nSTATE_CLEANUP_INTERVAL_MS=3600000\nMAX_STATE_ENTRIES=10000\nPORT=3000\n");
write("SECURITY_DEPLOYMENT.md", "# LINE OA 安全部署設定\n\n正式部署必須由環境變數提供 CHANNEL_ACCESS_TOKEN、CHANNEL_SECRET、CRM_URL。程式庫不再保存任何憑證或 CRM 網址。\n\n舊憑證曾出現在 Git 紀錄中，請重新發行 Channel Access Token，並視需要重設 Channel Secret。\n");
console.log("Applied LINE OA security and UX v300.1");
