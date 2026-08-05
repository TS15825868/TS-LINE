const assert = require('node:assert');
const sales = require('../line-sales-master.json');
const brand = require('../brand-content.json');

const productIds = Object.keys(sales.products || {});
assert(productIds.length >= 6, '正式產品主檔不足');

const gao = sales.products['guilu-gao'];
assert(gao, '缺少龜鹿膏');
assert.equal(gao.price, 1800);
assert.equal(gao.originalPrice, 2100);

const drink30 = sales.products['guilu-drink-30'];
assert(drink30, '缺少龜鹿飲30cc');
assert.equal(drink30.name, '龜鹿飲30cc玻璃罐');
assert.equal(drink30.specification, '30cc／罐（小玻璃罐）');
assert.equal(drink30.unit, '罐');
assert.equal(drink30.price, 50);
assert(drink30.offers.includes('買10送1'));
assert.equal(drink30.offer.qty, 11);
assert.equal(drink30.offer.total, 500);

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
assert.equal(tangkuai.price, 1600);

const jiao = sales.products['guilu-jiao'];
assert(jiao, '缺少龜鹿膠');
assert.equal(jiao.specification, '600g／盒（1斤）｜32塊裝｜每塊約18.75g');
assert.equal(jiao.size, jiao.specification, '龜鹿膠 size 必須同步完整正式規格');
assert.equal(jiao.spec, jiao.specification, '龜鹿膠 spec 必須同步完整正式規格');
assert.equal(jiao.priceText, '$9,600 / 盒', '龜鹿膠價格單位必須使用盒');

const trial = sales.trialCampaign;
assert(trial, '缺少長期試喝活動');
assert.equal(trial.contents, '30cc小玻璃罐×3罐');
assert.equal(Number(trial.productFee), 0);
assert.equal(trial.active, true);
assert.equal(trial.evergreen, true);
assert.match(String(trial.fulfillmentRule || ''), /製作加工約需5～7個工作天/);
assert.match(String(trial.fulfillmentRule || ''), /完成後才安排出貨/);
assert.match(String(trial.fulfillmentRule || ''), /物流配送時間另計/);
assert.match(String(trial.leadTimeDefinition || ''), /製作加工約需5～7個工作天/);
assert.match(String(trial.leadTimeDefinition || ''), /完成後才安排出貨/);

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

console.log('PASS release check：產品、試喝、買10送1、製作完成後出貨與四位固定夥伴均符合正式規則');
