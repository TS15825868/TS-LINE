"use strict";

const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "data.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
data.version = "298.7";
data.classics = data.classics || {};
data.classics.huangdiNeijing = {
  title: "《黃帝內經》的生活養生觀點",
  usage: "用於理解飲食、作息、四時與日常節奏，並與產品成分、規格及使用方式分層呈現。",
  sourceUrl: "https://ts15825868.github.io/xianjiawei/sources.html"
};

const product = (data.products || []).find((item) => item.id === "guilu-drink-180");
if (product) {
  product.image = "images/products-v3/guilu-drink-180.jpg?v=298.7";
  product.dmImage = "images/dm-final/03_guilu-drink-180cc-dm.jpg?v=298.7";
  product.detailImages = ["images/dm-final/03_guilu-drink-180cc-dm.jpg?v=298.7"];
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
const runtimePath = path.join(__dirname, ".server-v298-7-runtime.js");
let serverSource = fs.readFileSync(serverPath, "utf8");
serverSource = serverSource
  .replace(/仙加味 LINE OA Bot v[^\n*]+/, "仙加味 LINE OA Bot v298.7")
  .replace(/const VERSION = "[^"]+";/, 'const VERSION = "v298.7";');

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

if (!serverSource.includes("function huangdiNeijingReply()")) {
  serverSource = serverSource.replace("\nfunction detectProduct(text) {", `${neijingFunction}\nfunction detectProduct(text) {`);
}

const neijingRoute = '  if (/黃帝內經|內經|食飲有節|飲食有節|起居有常|四時調養|順應四時/.test(text)) return reply(event.replyToken, huangdiNeijingReply());\n';
if (!serverSource.includes("huangdiNeijingReply());")) {
  const brandRoute = '  if (/品牌故事|四代|鹿角伯|家族傳承|曾祖父|祖父|第三代|第四代/.test(text)) return reply(event.replyToken, brandStoryReply());\n';
  serverSource = serverSource.replace(brandRoute, neijingRoute + brandRoute);
}

fs.writeFileSync(runtimePath, serverSource, "utf8");
require(runtimePath);
