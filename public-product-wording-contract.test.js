"use strict";

const fs = require("node:fs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sales = JSON.parse(fs.readFileSync("line-sales-master.json", "utf8"));
const catalog = JSON.parse(fs.readFileSync("data.json", "utf8"));
const scheduledPosts = fs.readFileSync("social-first-batch-202607.js", "utf8");
const finalReconcile = fs.readFileSync("social-final-reconcile.js", "utf8");

const drink30 = sales.products?.["guilu-drink-30"];
const soup75 = sales.products?.["guilu-tangkuai"];
const jiao600 = sales.products?.["guilu-jiao"];

assert(drink30?.name === "龜鹿飲30cc玻璃罐", "LINE 主檔的龜鹿飲 30cc 名稱不是玻璃罐");
assert(drink30?.specification === "30cc／罐（小玻璃罐）", "LINE 主檔的龜鹿飲 30cc 規格不正確");
assert(soup75?.name === "龜鹿湯塊75g", "龜鹿湯塊名稱不是正式 75g 版本");
assert(soup75?.specification === "75g （2兩）／盒｜8塊裝｜每塊約9.375g", "龜鹿湯塊正式規格不正確");
assert(jiao600?.name === "龜鹿膠", "龜鹿膠名稱不正確");
assert(jiao600?.specification === "600g／盒（1斤）｜32塊裝｜每塊約18.75 g", "龜鹿膠正式規格不正確");

const products = Array.isArray(catalog.products) ? catalog.products : [];
const catalogDrink30 = products.find((item) => item.id === "guilu-drink-30");
const catalogSoup75 = products.find((item) => item.id === "guilu-tangkuai");
const catalogJiao600 = products.find((item) => item.id === "guilu-jiao");

assert(catalogDrink30?.displayName === "龜鹿飲30cc玻璃罐", "LINE 公開目錄仍使用錯誤的 30cc 名稱");
assert(catalogDrink30?.size === "30cc／罐（小玻璃罐）", "LINE 公開目錄的 30cc 規格不正確");
assert(catalogSoup75?.size === "75g （2兩）／盒｜8塊裝｜每塊約9.375g", "LINE 公開目錄的龜鹿湯塊規格不正確");
assert(catalogJiao600?.size === "600g／盒（1斤）｜32塊裝｜每塊約18.75 g", "LINE 公開目錄的龜鹿膠規格不正確");

const publicPostText = `${scheduledPosts}\n${finalReconcile}`;
const forbiddenPublicTerms = [
  "玻璃瓶",
  "矮胖",
  "輕巧瓶裝",
  "龜鹿湯塊150g",
  "龜鹿湯塊300g",
  "龜鹿湯塊600g"
];
for (const term of forbiddenPublicTerms) {
  assert(!publicPostText.includes(term), `LINE 對外貼文仍含舊稱或舊規格：${term}`);
}

assert(scheduledPosts.includes("小玻璃罐"), "正式排程貼文沒有使用 30cc 小玻璃罐名稱");
assert(finalReconcile.includes("30cc小玻璃罐與180cc鋁袋"), "最終貼文校正器沒有鎖定兩種正式龜鹿飲規格");

console.log("PASS LINE public product wording: 30cc small glass jar, 75g blue-box soup block, and 600g purple-box jiao specifications are locked");
