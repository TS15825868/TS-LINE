"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const official=JSON.parse(fs.readFileSync("assets/data/official-products.json"));
const bot=JSON.parse(fs.readFileSync("data.json"));
const partner=JSON.parse(fs.readFileSync("partner-inquiry-catalog.json"));
const photo=JSON.parse(fs.readFileSync("line-product-photo-authority.json"));
const ids=["guilu-gao","guilu-drink-30","guilu-drink-180","luerong-fen"];
for(const id of ids){
 const a=official.products.find(x=>x.id===id),b=bot.products.find(x=>x.id===id);
 assert.ok(a&&b,"missing official "+id);
 assert.equal(a.approvedProductImage,b.image);
 assert.equal(b.image,b.imageUrl);
 assert.equal(b.image,b.image_url);
 assert.equal(a.approvedProductImage,photo.approvedCustomerMainImages[id]);
 assert.ok(photo.products[id]?.includes("/images/products-v3/"),"identity originals must not change");
 assert.ok(b.image.includes("/catalog-pure-v20261017/"),"no stale image "+id);
}
for(const p of partner.products.filter(x=>x.approvedImage)){
 const main=new URL(p.approvedImage);
 assert.equal(main.origin,"https://ts15825868.github.io","Unexpected photo host "+p.id);
 assert.ok(main.pathname.startsWith("/xianjiawei/images/"),"Partner media must remain a verified website image "+p.id);
 assert.ok(main.pathname.includes("/catalog-pure-v20261017/")||main.pathname.includes("/catalog-user-original-v20261017/"),"Unverified original carton source "+p.id);
 assert.ok((p.approvedDetailImages||[]).every(url=>{
   const detail=new URL(url);
   return detail.origin===main.origin && detail.pathname.startsWith("/xianjiawei/images/");
 }),"Unverified partner detail photo host "+p.id);
}
console.log("PASS LINE own products and "+partner.products.filter(p=>p.approvedImage).length+" public partner/variant photos; authenticity, host and detail media checked");
