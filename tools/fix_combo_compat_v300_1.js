"use strict";

const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "server.js");
let source = fs.readFileSync(file, "utf8");
const from = `function comboReply() {
  return comboMenuReply();
}`;
const to = `function comboReply() {
  return flexCard(
    "搭配組合｜依日常使用方式選擇",
    "搭配組合以產品型態、使用方式與生活情境為主：\\n\\n・固定日常安排：龜鹿膏\\n・方便即飲：龜鹿飲30cc或180cc\\n・沖泡與料理：龜鹿湯塊\\n・家庭長期使用：龜鹿膠\\n・自行搭配飲品：鹿茸粉\\n\\n若涉及個人體質、疾病、用藥或適不適合食用，會轉介合作中醫師協助判斷。",
    [
      { label: "查看搭配組合", text: "搭配組合" },
      { label: "查看產品", text: "看產品" },
      { label: "人工客服", text: "我要人工客服" },
    ]
  );
}`;
if (source.includes(from)) source = source.replace(from, to);
fs.writeFileSync(file, source, "utf8");
console.log("Applied combo compatibility fix");
