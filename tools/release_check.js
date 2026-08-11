const assert = require('node:assert/strict');
const sales = require('../line-sales-master.json');
const brand = require('../brand-content.json');

const productIds = Object.keys(sales.products || {});
assert.equal(productIds.length, 6, '正式產品主檔必須剛好六項');

const gao = sales.products['guilu-gao'];
assert(gao, '缺少龜鹿膏');
assert.equal(gao.specification, '100g／罐');
assert.equal(gao.price, 1800);
assert.equal(gao.originalPrice, 2100);
assert.equal(gao.usage?.[0], '每日早上及下午各一小匙');

const drink30 = sales.products['guilu-drink-30'];
assert(drink30, '缺少龜鹿飲30cc');
assert.equal(drink30.name, '龜鹿飲30cc玻璃罐');
assert.equal(drink30.specification, '30cc／罐（小玻璃罐）');
assert.equal(drink30.unit, '罐');
assert.equal(drink30.price, 60);
assert(drink30.offers.includes('買10送1'));
assert.equal(drink30.offer.qty, 11);
assert.equal(drink30.offer.total, 600);
assert.ok(!/玻璃瓶|30cc／瓶|瓶裝/.test(JSON.stringify(drink30)), '30cc不得回退瓶型舊稱');

const drink180 = sales.products['guilu-drink-180'];
assert(drink180, '缺少龜鹿飲180cc');
assert.equal(drink180.name, '龜鹿飲180cc鋁袋');
assert.equal(drink180.specification, '180cc／包（鋁袋）');
assert.equal(drink180.price, 200);
assert(drink180.offers.includes('買10送1'));
assert.equal(drink180.offer.qty, 11);
assert.equal(drink180.offer.total, 2000);

const tangkuai = sales.products['guilu-tangkuai'];
assert(tangkuai, '缺少龜鹿湯塊');
assert.equal(tangkuai.specification, '75g／盒｜8塊裝｜每塊約9.375g');
assert.equal(tangkuai.price, 1600);

const jiao = sales.products['guilu-jiao'];
assert(jiao, '缺少龜鹿膠');
assert.equal(jiao.specification, '600g（1斤）／盒｜32塊裝｜每塊約18.75g');
assert.equal(jiao.size, jiao.specification, '龜鹿膠 size 必須同步完整正式規格');
assert.equal(jiao.spec, jiao.specification, '龜鹿膠 spec 必須同步完整正式規格');
assert.equal(jiao.price, 9600);
assert.equal(jiao.originalPrice, 12000);
assert.equal(jiao.priceText, '$9,600 / 盒', '龜鹿膠價格單位必須使用盒');

const powder = sales.products['luerong-fen'];
assert(powder, '缺少鹿茸粉');
assert.equal(powder.specification, '75g／罐');
assert.equal(powder.price, 2000);

const trial = sales.trialCampaign;
assert(trial, '缺少長期試喝活動');
assert.equal(trial.contents, '30cc小玻璃罐×3罐');
assert.equal(Number(trial.productFee), 0);
assert.equal(trial.active, true);
assert.equal(trial.evergreen, true);
assert.deepEqual((trial.shippingOptions || []).map((item) => [item.id, Number(item.fee)]), [['store', 60], ['home', 100]]);
assert.match(String(trial.fulfillmentRule || ''), /製作加工約需5～7個工作天/);
assert.match(String(trial.fulfillmentRule || ''), /完成後才安排出貨/);
assert.match(String(trial.leadTimeDefinition || ''), /製作加工約需5～7個工作天/);

assert.equal(sales.comboOffers?.length, 3);
assert.equal(sales.combos?.length, 3);
assert.deepEqual(sales.imagePolicy?.partners, ['小鹿娃娃', '小烏龜娃娃', '灰色小河馬娃娃', '米色小鹿安撫巾']);
assert.equal(sales.imagePolicy?.realProductImagesOnly, true);
assert.equal(sales.imagePolicy?.noProductRedraw, true);
assert.equal(sales.imagePolicy?.approvalRequiredBeforePublish, true);

for (const label of ['品牌故事', '品牌由來', '選料理念', '品質把關', '傳統工法', '品牌承諾']) {
  assert.equal(typeof brand.quickReplies?.[label], 'string', `品牌內容缺少：${label}`);
  assert(brand.quickReplies[label].trim().length >= 20, `品牌內容過短：${label}`);
}

console.log('PASS release check：六項產品、目前正式規格、價格、試喝、交期與圖片政策均符合最新權威；不再保留30cc舊50元／500元方案。');
