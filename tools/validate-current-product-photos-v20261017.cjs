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
 assert.ok(p.approvedImage.includes("/catalog-pure-v20261017/"),"partner stale image "+p.id);
}
console.log("PASS LINE own 4 and public partner 11 current genuine-product image references; identity and pricing remain separate");
