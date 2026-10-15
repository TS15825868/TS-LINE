"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {findPartnerInquiry}=require("./partner-inquiry");
const catalog=require("./partner-inquiry-catalog.json");
const cases=[
  ["請問四珍寶有貨嗎","uboss-sizhenbao"],
  ["四珍寶精華膏湯塊價格","uboss-sizhenbao"],
  ["御采堂四珍寶精華膏湯塊可以買嗎","uboss-sizhenbao"],
  ["黑糖仙楂烏梅茶多少錢","brown-sugar-ume-tea"],
  ["龜鹿活力飲（葡萄糖胺）","guilu-vitality"],
  ["龜鹿活力飲有貨嗎","guilu-vitality"]
];
for(const [query,id] of cases){
  const found=findPartnerInquiry(query);
  assert.equal(found?.id,id,"食品詢問必須留在仙加味："+query);
  assert.equal(found?.food?.classification,"merchant-confirmed-food");
  assert.equal(found?.medicine,undefined,"不得因食品由藥廠製造就當成藥品");
  assert.equal(found?.food?.autoCheckout,false,"價格與購買由仙加味人工確認");
}
const four=catalog.products.find(p=>p.id==="uboss-sizhenbao");
assert.equal(four.food?.producerFromPackage,"御采堂生技食品有限公司");
assert.equal(four.publicPage,"product-four-treasures.html");
assert.equal(four.food?.websitePublic,true);
assert.ok(four.aliases.every(x=>!x.includes("御聖堂")),"原廠錯名不得回流");
// 產品是否公開須以最新版正式圖片及商品資料為準，不能用舊的待審狀態鎖住正確新品。
const vitality=catalog.products.find(p=>p.id==="guilu-vitality");
assert.equal(vitality?.name,"龜鹿活力飲（葡萄糖胺）");
assert.equal(vitality.publicPage,"product-guilu-vitality.html","已以原圖上架的食品應能開啟正確詳細頁");
assert.equal(vitality.food?.websitePublic,true);
assert.equal(vitality.food?.photoState,"three-exact-original-photos-on-website");
assert.equal(vitality.food?.size,"60毫升×12罐／盒");
for(const id of ["guilu-vitality","brown-sugar-ume-tea","uboss-sizhenbao"]){
  const item=catalog.products.find(p=>p.id===id);
  assert.equal(item?.food?.classification,"merchant-confirmed-food");
  assert.equal(Boolean(item.publicPage),Boolean(item.food.websitePublic),
    "食品網站連結須與正式公開審核狀態同步："+id);
  if(item.publicPage)assert.match(item.publicPage,/^product-[a-z0-9-]+\.html$/,
    "公開食品須指向真實正式詳細頁："+id);
}
const src=fs.readFileSync("server.js","utf8");
assert.ok(src.includes("if (partnerInquiry.food?.classification === 'merchant-confirmed-food')"),"LINE必須使用食品回答分支");
assert.ok(src.includes("partnerInquiry.publicPage && food.websitePublic"),"只對已上架食品出現商品頁按鈕");
assert.ok(src.includes("仙加味商品及購買諮詢"),"所有食品須回流仙加味人工客服");
console.log("PASS：三款供應商食品分類／詢價／公開圖片連結／成藥分開管理");
