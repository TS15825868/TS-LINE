"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const write = (name, value) => fs.writeFileSync(path.join(root, name), value, "utf8");

let server = read("server.js")
  .replace(/仙加味 LINE OA Bot v[0-9.]+/, "仙加味 LINE OA Bot v312.0")
  .replace(/const VERSION = "v[0-9.]+";/, 'const VERSION = "v312.0";')
  .replace(/\?v=311\.0/g, "?v=312.0");

if (!server.includes("function faqReply()")) {
  const faq = `function faqReply() {
  return {
    type: "flex",
    altText: "仙加味常見問題",
    contents: mascotBubble(
      "常見問題｜小老闆幫你整理",
      "可先查看產品規格、價格方案、使用方式、配送付款與門市資訊。若仍有問題，直接留言即可由人工協助。",
      [
        { label: "產品與價格", text: "價格方案" },
        { label: "怎麼使用", text: "怎麼使用" },
        { label: "配送與付款", text: "配送付款" },
        { label: "人工客服", text: "我要人工客服" },
      ],
      "faq"
    ),
  };
}

`;
  server = server.replace("function detectProduct(text) {", faq + "function detectProduct(text) {");
}

server = server.replace(
  'if (/官網FAQ|FAQ頁|幾個問題想詢問|官網聯絡|聯絡頁|配送|付款|通路合作|診所|中藥店/.test(value)) return "human";',
  'if (/官網FAQ|FAQ頁|常見問題|幾個問題想詢問/.test(value)) return "faq";\n  if (/官網聯絡|聯絡頁|通路合作|診所|中藥店/.test(value)) return "human";'
);

server = server.replace(
  'if (websiteIntent === "brand") return reply(event.replyToken, brandStoryReply());',
  'if (websiteIntent === "brand") return reply(event.replyToken, brandStoryReply());\n  if (websiteIntent === "faq") return reply(event.replyToken, faqReply());'
);

const recommendMarker = `  if (/^(幫我推薦|怎麼選|不知道怎麼選)$/.test(text)) {
    return reply(event.replyToken, recommendReply());
  }
`;

if (!server.includes("配送與付款｜小老闆幫你整理")) {
  const routes = `
  if (/^(常見問題|FAQ|問題整理)$/.test(text)) {
    return reply(event.replyToken, faqReply());
  }

  if (/配送付款|配送方式|付款方式|怎麼付款|怎麼配送/.test(text)) {
    return reply(event.replyToken, {
      type: "flex",
      altText: "仙加味配送與付款",
      contents: mascotBubble(
        "配送與付款｜小老闆幫你整理",
        \`付款方式：\${(DATA.payments || ["現金付款", "匯款", "貨到付款"]).join("、")}\\n\\n配送方式：\${(DATA.shipping || ["宅配", "7-11賣貨便", "門市自取", "雙北親送"]).join("、")}\\n\\n實際費用、到貨時間與可用方式由客服依訂單確認。\`,
        [
          { label: "查看購物車", text: "查看購買清單" },
          { label: "直接下單", text: "直接下單" },
          { label: "人工客服", text: "我要人工客服" },
        ],
        "service"
      ),
    });
  }
`;
  server = server.replace(recommendMarker, recommendMarker + routes);
}

const oldHuman = 'return reply(event.replyToken, textMsg("請直接留下想詢問的內容，我們會由人工協助回覆。\\n\\n門市地址：台北市萬華區西昌街52號。\\n營業時間：週一至週六 09:30–18:30。\\n假日如未外出，可提前透過官方 LINE 預約。", mainQuick()));';
const newHuman = 'return reply(event.replyToken, { type: "flex", altText: "仙加味人工客服", contents: mascotBubble("人工客服｜請直接留言", storeServiceText(), [{ label: "看產品", text: "看產品" }, { label: "查看購物車", text: "查看購買清單" }], "service") });';
server = server.split(oldHuman).join(newHuman);

const oldStore = 'return reply(event.replyToken, textMsg("門市地址：台北市萬華區西昌街52號。\\n營業時間：週一至週六 09:30–18:30。\\n假日如未外出，可提前透過官方 LINE 預約。", mainQuick()));';
const newStore = 'return reply(event.replyToken, { type: "flex", altText: "仙加味門市資訊", contents: mascotBubble("門市資訊｜小老闆為你服務", storeServiceText(), [{ label: "看產品", text: "看產品" }, { label: "人工客服", text: "我要人工客服" }], "service") });';
server = server.replace(oldStore, newStore);

if (!server.includes("  faqReply,")) {
  server = server.replace("  brandStoryReply,\n", "  brandStoryReply,\n  faqReply,\n");
}
write("server.js", server);

for (const name of ["test.js", "function.test.js", "security.test.js", "catalog.test.js"]) {
  let value = read(name).replace(/v311\.0/g, "v312.0");
  if (name === "function.test.js") {
    value = value.replace(
      "  doctorReferralReply, huangdiNeijingReply, brandStoryReply,",
      "  doctorReferralReply, huangdiNeijingReply, brandStoryReply, faqReply,"
    );
    value = value.replace(
      "validateBubble(comboDetailReply(0));\nvalidateBubble(brandStoryReply());",
      "validateMessage(comboDetailReply(0));\nvalidateBubble(brandStoryReply());\nvalidateMessage(faqReply());"
    );
    value = value.replace(
      '["我從官網FAQ頁面進來，有幾個問題想詢問。", "human"]',
      '["我從官網FAQ頁面進來，有幾個問題想詢問。", "faq"]'
    );
  }
  write(name, value);
}

const pkg = JSON.parse(read("package.json"));
pkg.version = "3.1.2";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

const lock = JSON.parse(read("package-lock.json"));
lock.version = "3.1.2";
if (lock.packages && lock.packages[""]) lock.packages[""].version = "3.1.2";
write("package-lock.json", JSON.stringify(lock, null, 2) + "\n");

write("README.md", `# 仙加味 LINE OA v312.0

正式版採單一 \`server.js\` 主程式與單一 \`data.json\` 資料中心。

- 小老闆卡片：welcome、products、recommend、combo、usage、faq、service、brand
- 看產品、價格、推薦、搭配、使用、購物車、直接下單與結帳
- 常見問題、配送付款、門市資訊、人工客服與中醫師轉介
- LINE 憑證只從部署平台環境變數讀取
`);

const keepRoot = new Set([
  ".env.example", ".gitignore", "Code.gs", "MASCOT_CHARACTER_SPEC.md", "README.md",
  "RICH_MENU_SETUP.md", "SECURITY_DEPLOYMENT.md", "catalog.test.js", "data.json",
  "function.test.js", "package-lock.json", "package.json", "rich-menu-actions.json",
  "security.test.js", "server.js", "test.js"
]);
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && !keepRoot.has(entry.name) && entry.name !== "FINALIZE_V312_RUN.txt") {
    fs.unlinkSync(path.join(root, entry.name));
  }
}

for (const file of fs.readdirSync(path.join(root, "tools"))) {
  if (!new Set(["sync_website_catalog.js", "finalize_v312.js"]).has(file)) {
    fs.rmSync(path.join(root, "tools", file), { recursive: true, force: true });
  }
}

const workflows = path.join(root, ".github", "workflows");
for (const file of fs.readdirSync(workflows)) {
  if (!new Set(["verify-line-and-website-catalog.yml", "finalize-v312-run.yml"]).has(file)) {
    fs.unlinkSync(path.join(workflows, file));
  }
}

console.log("LINE OA v312 patch prepared");
