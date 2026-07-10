"use strict";

/**
 * 仙加味 LINE OA v306 runtime wrapper
 * 保留原正式主程式，於載入時恢復龜鹿飲180cc、門市時間與完整角色圖顯示。
 */

const fs = require("fs");
const path = require("path");
const Module = require("module");

const originalReadFileSync = fs.readFileSync.bind(fs);
const dataPath = path.join(__dirname, "data.json");
const corePath = path.join(__dirname, "server-core.js");

const data = JSON.parse(originalReadFileSync(dataPath, "utf8"));
const product180 = {
  id: "guilu-drink-180",
  series: "仙加味・龜鹿",
  name: "龜鹿飲180cc鋁袋",
  displayName: "龜鹿飲180cc鋁袋",
  size: "180cc／包（鋁袋）",
  image: "images/products-v3/guilu-drink-180.jpg?v=305.0",
  dmImage: "images/dm-final/03_guilu-drink-180cc-dm.jpg?v=305.0",
  description: "180cc鋁袋包裝，把龜鹿膏的成分方向整理成方便即飲的液態型態。適合居家、工作空檔或偏好一次安排較完整份量的人。",
  ingredients: ["水", "鹿角萃取物", "龜板萃取物", "枸杞", "紅棗", "黃耆", "粉光蔘"],
  usage: ["撕開包裝即可飲用", "可依個人習慣溫熱後飲用", "開封後請儘速飲用完畢"],
  storage: ["未開封置於陰涼乾燥處", "避免高溫與日光直射", "開封後請儘速飲用完畢"],
  fit: "想要較完整即飲份量、居家安排或工作空檔飲用的人",
  page: "product-guilu-drink-180cc.html",
  purpose: "完整份量即飲食補",
  purposeDirection: "適合偏好180cc鋁袋、居家安排、工作空檔或想一次飲用較完整份量的人。",
  aliases: ["龜鹿飲180cc", "龜鹿飲180", "180cc", "180cc鋁袋", "鋁袋", "龜鹿飲鋁袋"],
  spec: "180cc鋁袋",
  price: 200,
  unit: "包",
  offers: [{ qty: 12, total: 2000, label: "買10送2（12包）" }],
  quantityOptions: [1, 3, 5, 12],
  priceText: "$200 / 包",
  priceLabel: "售價200元，買10送2"
};

data.products = (data.products || []).filter((item) => item.id !== product180.id);
const drink30Index = data.products.findIndex((item) => item.id === "guilu-drink-30");
data.products.splice(drink30Index >= 0 ? drink30Index + 1 : data.products.length, 0, product180);
data.store = {
  ...(data.store || {}),
  address: "台北市萬華區西昌街52號",
  hours: "週一至週六 09:30–18:30",
  holidayNote: "假日如未外出，可提前透過官方 LINE 預約。"
};

const mergedData = JSON.stringify(data, null, 2);
fs.readFileSync = function patchedRead(file, encoding, ...rest) {
  if (path.resolve(String(file)) === path.resolve(dataPath)) {
    return encoding ? mergedData : Buffer.from(mergedData, "utf8");
  }
  return originalReadFileSync(file, encoding, ...rest);
};

let source = originalReadFileSync(corePath, "utf8");
source = source
  .replace("仙加味 LINE OA Bot v303.0", "仙加味 LINE OA Bot v306.0")
  .replace('const VERSION = "v303.0";', 'const VERSION = "v306.0";')
  .replace(/xianjiawei-scene-([a-z]+)\.jpg\?v=306\.0/g, "xianjiawei-scene-$1.jpg?v=305.0")
  .replace('aspectRatio: "4:3",\n    aspectMode: "contain",', 'aspectRatio: "4:3",\n    aspectMode: "contain",')
  .replace(
    '  if (/龜鹿飲.*30|30cc|玻璃瓶/.test(raw)) return getProduct("guilu-drink-30");',
    '  if (/龜鹿飲.*180|180cc|鋁袋/.test(raw)) return getProduct("guilu-drink-180");\n  if (/龜鹿飲.*30|30cc|玻璃瓶/.test(raw)) return getProduct("guilu-drink-30");'
  )
  .replace(
    '"想建立固定日常安排可從龜鹿膏開始；需要外出或忙碌時方便飲用，可查看龜鹿飲30cc。",',
    '"想建立固定日常安排可從龜鹿膏開始；需要輕巧攜帶可看龜鹿飲30cc，想要較完整份量可看龜鹿飲180cc鋁袋。",'
  )
  .replace(
    '{ label: "看30cc", text: "產品詳情｜guilu-drink-30" },',
    '{ label: "看30cc", text: "產品詳情｜guilu-drink-30" },\n        { label: "看180cc", text: "產品詳情｜guilu-drink-180" },'
  )
  .replace(
    '  if (/人工|客服|聯絡/.test(text)) {',
    '  if (/營業時間|門市時間|幾點營業|幾點關門|假日預約|預約門市/.test(text)) {\n    return reply(event.replyToken, textMsg("門市地址：台北市萬華區西昌街52號。\\n營業時間：週一至週六 09:30–18:30。\\n假日如未外出，可提前透過官方 LINE 預約。", mainQuick()));\n  }\n\n  if (/人工|客服|聯絡/.test(text)) {'
  )
  .replace(
    '請直接留下想詢問的內容，我們會由人工協助回覆。',
    '請直接留下想詢問的內容，我們會由人工協助回覆。\\n\\n門市營業時間：週一至週六 09:30–18:30。\\n假日如未外出，可提前透過官方 LINE 預約。'
  );

const runtimeModule = new Module(corePath, module);
runtimeModule.filename = corePath;
runtimeModule.paths = Module._nodeModulePaths(__dirname);
try {
  runtimeModule._compile(source, corePath);
} finally {
  fs.readFileSync = originalReadFileSync;
}

const core = runtimeModule.exports;
if (require.main === module) {
  const port = process.env.PORT || 3000;
  core.app.listen(port, () => console.log(`仙加味 LINE OA v306.0 running on ${port}`));
}

module.exports = core;
