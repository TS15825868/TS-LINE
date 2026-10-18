"use strict";
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs");
const server=require("./server");
const publicPartners=require("./line-partner-public-carousel.json").products;
const authority=require("./line-partner-retail-authority.json").products;
const inquiry=require("./partner-inquiry-catalog.json").products;
const sales=require("./line-sales-master.json").products;
const tea=require("./line-danshen-flavor-menu");
const {applyMaster}=require("./product-sales-master");
const core=applyMaster(JSON.parse(fs.readFileSync(path.join(__dirname,"data.json"),"utf8"))).products;
const ids=core.map(p=>p.id).concat(publicPartners.map(p=>p.id));
assert.equal(ids.length,new Set(ids).size,"重複商品 ID");
assert.equal(core.length,4,"目前正式核心產品須與母檔一致");
assert.equal(publicPartners.length,5,"目前五張已核准其他廠牌卡不能缺漏");
assert.equal(inquiry.length,26,"其他廠牌26筆詢價及內部候選資料不得因公開展示被刪除");
for(const p of core){
 const approved=sales[p.id];
 assert.ok(approved,"核心產品缺正式母資料："+p.id);
 assert.equal(p.specification,approved.specification,"核心規格不同步："+p.id);
 assert.equal(p.price,approved.price,"核心售價不同步："+p.id);
 assert.equal(p.ingredients.join("、"),approved.ingredients.join("、"),"正式成分或順序不同步："+p.id);
 if(p.id==="guilu-drink-30"){
   assert.ok(/30cc/.test(p.specification));
   assert.ok(/裸罐|無貼紙/.test(approved.description),"小玻璃裸罐不可改成貼標大瓶");
 }
 if(p.id==="guilu-drink-180")assert.ok(/鋁袋/.test(p.specification));
}
for(const p of publicPartners){
 const price=authority[p.id],catalog=inquiry.find(i=>i.id===p.id);
 assert.ok(price?.confirmed&&price.price>0,"其他商品末端價未核准："+p.id);
 assert.ok(catalog,"公開其他商品缺詢價目錄："+p.id);
 assert.equal(catalog.publicPage,p.page,"公開詳細頁不一致："+p.id);
 assert.ok(p.specification&&p.name&&p.image&&/\.webp$/.test(p.image),"商品資訊或真實圖路徑不完整："+p.id);
 assert.ok(!catalog.medicine,"藥品不得以一般食品產品卡公開販售："+p.id);
 assert.ok(!/成本|批發價/.test(price.label),"顧客卡片不得洩漏內部價格："+p.id);
}
assert.equal(authority["danshen-tea-collection"].price,480);
assert.equal(authority["royalherb-erzhenbao-64"].priceType,"suggested");
assert.equal(authority["royalherb-erzhenbao-64"].promotionPrice,12000);
assert.equal(authority["uboss-sizhenbao"].priceType,"suggested");
assert.equal(authority["uboss-sizhenbao"].promotionPrice,12000);
assert.deepEqual(tea.variants().map(p=>p.price),[480,480,480,480,480,480]);
assert.equal(tea.menu().length,2,"口味選單必須分兩張避免手機截斷");
assert.ok(tea.menu().every(p=>p.contents.footer.contents.length===3));
assert.ok(tea.quantityMenu(tea.IDS[0]).every(p=>p.contents.footer.contents.length===3));
const messages=server.productCarousel();
assert.equal(messages.type,"flex");
assert.equal(messages.contents.type,"carousel");
assert.equal(messages.contents.contents.length,ids.length,"LINE 看產品應顯示全部9張");
const cards=messages.contents.contents;
for(let index=0;index<cards.length;index++){
  const card=cards[index],id=ids[index];
  assert.equal(card.type,"bubble",id);
  assert.ok(card.hero?.url?.startsWith("https://"),id+" 主圖須為有效絕對 URL");
  assert.equal(card.hero?.aspectMode,"fit",id+" 圖片不能裁切");
  assert.ok(card.footer?.contents?.length>=2&&card.footer.contents.length<=3,id+" 按鈕數量不合格");
  const body=card.body?.contents?.map(x=>x.text).filter(Boolean).join("\n")||"";
  assert.ok(body.includes("規格："),id+" 未顯示規格");
  assert.ok(!/成本|批發價/.test(body),id+" 不得公開內部售價");
  if(index>=core.length){
    const retail=authority[id];
    assert.ok(body.includes(retail.label),id+" 商品卡價格與母資料不一致");
    assert.ok(!body.includes("供貨與個別優惠請洽 LINE 客服"),id+" 商品卡無須重複客服說明造成留白");
  }
}
const imageIds=publicPartners.map(p=>p.id);
assert.equal(imageIds.length,new Set(imageIds).size);
const medicines=inquiry.filter(p=>p.medicine);
assert.ok(medicines.every(p=>!ids.includes(p.id)),"藥品不得出現在一般公開滑動選購卡");
console.log("PASS: 9張公開商品卡、26筆詢價候選、6款丹參口味、真實圖、規格、核准零售價、合法分類與完整按鈕均一致。");
