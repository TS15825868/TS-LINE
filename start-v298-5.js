"use strict";

const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "data.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
data.version = "298.9";
data.classics = data.classics || {};
data.classics.huangdiNeijing = {
  title: "《黃帝內經》的生活養生觀點",
  usage: "用於理解飲食、作息、四時與日常節奏，並與產品成分、規格及使用方式分層呈現。",
  sourceUrl: "https://ts15825868.github.io/xianjiawei/sources.html"
};

data.medicalReferral = {
  doctor: "章無忌中醫師",
  lineId: "@changwuchi",
  url: "https://lin.ee/1MK4NR9"
};

const product = (data.products || []).find((item) => item.id === "guilu-drink-180");
if (product) {
  product.image = "images/products-v3/guilu-drink-180.jpg?v=298.9";
  product.dmImage = "images/dm-final/03_guilu-drink-180cc-dm.jpg?v=298.9";
  product.detailImages = ["images/dm-final/03_guilu-drink-180cc-dm.jpg?v=298.9"];
  product.description = "180cc鋁袋包裝，把龜鹿膏的成分方向整理成較大容量的即飲型態。開封即可飲用，也可隔水加熱，或倒入杯中後加熱飲用。";
  product.usage = [
    "打開即可飲用。",
    "可隔水加熱後飲用。",
    "亦可倒入杯中後加熱飲用。",
    "開封後請儘速飲用完畢。"
  ];
  product.purpose = "較大容量即飲食補";
  product.purposeDirection = "適合偏好較大容量即飲、居家安排或溫熱後飲用的人。";
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n", "utf8");

const serverPath = path.join(__dirname, "server.js");
const runtimePath = path.join(__dirname, ".server-v298-9-runtime.js");
let serverSource = fs.readFileSync(serverPath, "utf8");

serverSource = serverSource
  .replace(/仙加味 LINE OA Bot v[^\n*]+/, "仙加味 LINE OA Bot v298.9")
  .replace(/const VERSION = "[^"]+";/, 'const VERSION = "v298.9";')
  .replace(/const CRM_URL = process\.env\.CRM_URL \|\| "[^"]*";/, 'const CRM_URL = process.env.CRM_URL || "";')
  .replace(/channelAccessToken:\s*process\.env\.CHANNEL_ACCESS_TOKEN\s*\|\|\s*"[^"]*",/, 'channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "",')
  .replace(/channelSecret:\s*process\.env\.CHANNEL_SECRET\s*\|\|\s*"[^"]*",/, 'channelSecret: process.env.CHANNEL_SECRET || "",');

const neijingFunction = `
function huangdiNeijingReply() {
  return flexCard(
    "《黃帝內經》｜日常生活觀點",
    "仙加味引用《黃帝內經》時，著重古代對飲食有節、起居有常與順應四時的生活觀點。\\n\\n這一層用來理解日常補養的節奏；《本草綱目》用於理解成分名稱與本草文化，現代藥典則用於理解正式品名與品質規格。產品資訊仍以實際成分、規格、保存與使用方式為準。",
    [
      { label: "查看資料來源", uri: absoluteUrl("sources.html") },
      { label: "查看漢方百科", uri: absoluteUrl("hanfang-baike.html") },
      { label: "詢問日常安排", text: "我想了解日常食補怎麼安排" },
    ]
  );
}
`;

const doctorReferralFunction = `
function doctorReferralReply() {
  return flexCard(
    "個人狀況｜轉介中醫師諮詢",
    "這部分會因每個人的身體狀況不同，為了讓您得到更準確的說明與建議，建議先由合作的中醫師了解您的情況🙂\\n\\n✔ 專人一對一說明\\n✔ 可詢問適不適合食用\\n✔ 可詢問個人狀況與疑問\\n\\nLINE ID：@changwuchi\\n章無忌中醫師",
    [
      { label: "前往中醫師諮詢", uri: "https://lin.ee/1MK4NR9" },
      { label: "查看產品資訊", data: pb("products") },
      { label: "人工客服", text: "我要人工客服" },
    ]
  );
}
`;

if (!serverSource.includes("function huangdiNeijingReply()")) {
  serverSource = serverSource.replace("\nfunction detectProduct(text) {", `${neijingFunction}\nfunction detectProduct(text) {`);
}

if (!serverSource.includes("function doctorReferralReply()")) {
  serverSource = serverSource.replace("\nfunction detectProduct(text) {", `${doctorReferralFunction}\nfunction detectProduct(text) {`);
}

const neijingRoute = '  if (/黃帝內經|內經|食飲有節|飲食有節|起居有常|四時調養|順應四時/.test(text)) return reply(event.replyToken, huangdiNeijingReply());\n';
const doctorRoute = '  if (/功效|效果|有效|有沒有用|多久有效|改善|治療|預防|疾病|症狀|不舒服|疼痛|腰痠|腰酸|膝蓋|關節|睡眠|失眠|血糖|血壓|膽固醇|免疫|明目|補血|補氣|壯陽|腎虛|肝腎|眼睛|服藥|用藥|藥物|孕婦|懷孕|哺乳|兒童|小孩|慢性病|過敏|手術|化療|洗腎|適不適合吃|適不適合食用|能不能吃|可以吃嗎|我能吃嗎|體質|燥熱|上火|副作用|禁忌/.test(text)) return reply(event.replyToken, doctorReferralReply());\n';

if (!serverSource.includes("huangdiNeijingReply());")) {
  const brandRoute = '  if (/品牌故事|四代|鹿角伯|家族傳承|曾祖父|祖父|第三代|第四代/.test(text)) return reply(event.replyToken, brandStoryReply());\n';
  serverSource = serverSource.replace(brandRoute, neijingRoute + brandRoute);
}

const recommendRoute = '  if (/不知道|怎麼選|推薦|適合哪個/.test(text)) return reply(event.replyToken, recommendReply());\n';
if (!serverSource.includes("doctorReferralReply());")) {
  serverSource = serverSource.replace(recommendRoute, doctorRoute + recommendRoute);
}

serverSource = serverSource.replace(
  /  if \(\/功效\|效果\|改善\|治療\|預防\|疾病\|服藥\|孕婦\|懷孕\|哺乳\|兒童\|小孩\|慢性病\/\.test\(text\)\) \{[\s\S]*?\n  \}\n/,
  ""
);

fs.writeFileSync(runtimePath, serverSource, "utf8");
require(runtimePath);
