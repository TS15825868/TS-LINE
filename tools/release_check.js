const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { applyMaster, getCurrentAuthority } = require('../product-sales-master');
const brand = require('../brand-content.json');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname,'..','data.json'),'utf8'));
const data = applyMaster(raw);
const authority = getCurrentAuthority();
const official = Object.fromEntries(authority.products.filter(p=>authority.websitePublicProductIds.includes(p.id)).map(p=>[p.id,p]));
const products = Object.fromEntries(data.products.map(p=>[p.id,p]));

assert.equal(authority.authority,'user-confirmed-current');
assert.equal(data.products.length,authority.websitePublicProductIds.length,'正式產品輸出必須符合最新公開母資料');
for(const id of Object.keys(official)){
  assert(products[id],`缺少${id}`);
  assert.equal(products[id].name,official[id].name,`${id}名稱未跟目前權威同步`);
  assert.equal(products[id].specification,official[id].specification,`${id}規格未跟目前權威同步`);
  assert.equal(products[id].size,official[id].specification,`${id}.size未跟目前權威同步`);
  assert.equal(products[id].spec,official[id].specification,`${id}.spec未跟目前權威同步`);
  assert.deepEqual(products[id].ingredients,official[id].ingredients,`${id}成分未跟目前權威同步`);
}

assert.equal(products['guilu-gao'].price,1800);
assert.equal(products['guilu-gao'].originalPrice,2100);
assert.equal(products['guilu-gao'].usage?.[0],official['guilu-gao'].usagePrimary);
assert.ok(!(products['guilu-gao'].usage||[]).some(line=>/早晚各一小匙/.test(String(line))));

const drink30=products['guilu-drink-30'];
assert.equal(drink30.unit,'罐');
assert.equal(drink30.price,60);
assert.ok(drink30.offers.some(o=>o.label==='買10送1'&&Number(o.qty)===11&&Number(o.total)===600));
assert.ok(!/玻璃瓶|30cc／瓶|瓶裝/.test(JSON.stringify(drink30)),'30cc不得回退瓶型舊稱');

const drink180=products['guilu-drink-180'];
assert.equal(drink180.price,200);
assert.ok(drink180.offers.some(o=>o.label==='買10送1'&&Number(o.qty)===11&&Number(o.total)===2000));

assert.equal(products['guilu-tangkuai'].price,1600);
assert.equal(products['guilu-tangkuai'].detailUnitApprox,'每塊約9.375g');
assert.equal(products['guilu-jiao'].price,9600);
assert.equal(products['guilu-jiao'].originalPrice,12000);
assert.match(products['guilu-jiao'].detailUnitApprox,/每塊約18\.75\s*g/);
assert.equal(products['luerong-fen'].price,2000);

const trial=data.trialCampaign;
assert(trial,'缺少長期試喝活動');
assert.equal(trial.contents,'30cc小玻璃罐×3罐');
assert.equal(Number(trial.productFee),0);
assert.equal(trial.active,true);
assert.equal(trial.evergreen,true);
assert.deepEqual((trial.shippingOptions||[]).map(item=>[item.id,Number(item.fee)]),[['store',60],['home',100]]);
assert.match(String(trial.fulfillmentRule||''),/製作加工約需5～7個工作天/);
assert.match(String(trial.fulfillmentRule||''),/完成後才安排出貨/);

assert.equal(data.combos?.length,3);
assert.equal(data.runtime?.imagePolicy?.productMainImageSource,'products-v3-user-approved-originals');
assert.equal(data.runtime?.imagePolicy?.productsV2Use,'legacy-reference-only');
for(const product of data.products){
  assert.equal(product.image,official[product.id].approvedProductImage);
  assert.equal(product.dmImage,official[product.id].approvedDm);
  assert.ok(product.officialOriginalImage.includes('/images/products-v3/'));
}

for(const label of ['品牌故事','品牌由來','選料理念','品質把關','傳統工法','品牌承諾']){
  assert.equal(typeof brand.quickReplies?.[label],'string',`品牌內容缺少：${label}`);
  assert(brand.quickReplies[label].trim().length>=20,`品牌內容過短：${label}`);
}

console.log(`PASS release check：LINE輸出依目前 ${authority.version} 權威、價格、試喝、交期與products-v3能力驗收；不再用舊延伸規格／舊用法／歷史版號判定。`);

