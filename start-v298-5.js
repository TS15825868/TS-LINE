"use strict";

const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "data.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
data.version = "298.5";

const product = (data.products || []).find((item) => item.id === "guilu-drink-180");
if (product) {
  product.image = "images/products-v3/guilu-drink-180.webp?v=298.5";
  product.dmImage = "images/dm-v3/guilu-drink-180.webp?v=298.5";
  product.detailImages = ["images/dm-v3/guilu-drink-180.webp?v=298.5"];
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
const runtimePath = path.join(__dirname, ".server-v298-5-runtime.js");
let serverSource = fs.readFileSync(serverPath, "utf8");
serverSource = serverSource
  .replace(/仙加味 LINE OA Bot v[^\n*]+/, "仙加味 LINE OA Bot v298.5")
  .replace(/const VERSION = "[^"]+";/, 'const VERSION = "v298.5";');
fs.writeFileSync(runtimePath, serverSource, "utf8");
require(runtimePath);
