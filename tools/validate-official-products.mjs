import fs from 'node:fs';

const authority = JSON.parse(fs.readFileSync('assets/data/official-products.json', 'utf8'));
const publicIds=authority.websitePublicProductIds;
if(!Array.isArray(publicIds)||!publicIds.length||new Set(publicIds).size!==publicIds.length)throw new Error('公開清單無效');
const drinkIds = new Set(authority.fulfillmentPolicy.drinkProductIds);
const stockIds = new Set(authority.fulfillmentPolicy.readyStockProductIds);

function mapProducts(source) {
  return Array.isArray(source.products)
    ? new Map(source.products.map((item) => [item.id, item]))
    : new Map(Object.entries(source.products || {}));
}

for (const file of ['line-sales-master.json', 'data.json']) {
  const source = JSON.parse(fs.readFileSync(file, 'utf8'));
  const products = mapProducts(source);
  if (products.size !== publicIds.length || !publicIds.every(id=>products.has(id))) throw new Error(`${file}: official products must match current public authority, got ${products.size}`);

  for (const expected of authority.products.filter(p=>publicIds.includes(p.id))) {
    const actual = products.get(expected.id);
    if (!actual) throw new Error(`${file}: missing official product ${expected.id}`);
    const spec = actual.specification || actual.size || actual.spec;
    if (actual.name !== expected.name) throw new Error(`${file}: ${expected.id} name mismatch: ${actual.name} !== ${expected.name}`);
    if (spec !== expected.specification) throw new Error(`${file}: ${expected.id} specification mismatch: ${spec} !== ${expected.specification}`);
    const notice = String(actual.fulfillmentNotice || '');
    if (drinkIds.has(expected.id)) {
      if (actual.fulfillmentType !== 'made-to-order-drink' || actual.readyStock !== false || actual.productionLeadTime !== '5～7個工作天') {
        throw new Error(`${file}: ${expected.id} drink fulfillment fields mismatch`);
      }
      if (!notice.includes('製作加工約需5～7個工作天') || !notice.includes('完成後才安排出貨')) {
        throw new Error(`${file}: ${expected.id} drink notice mismatch`);
      }
    }
    if (stockIds.has(expected.id)) {
      if (actual.fulfillmentType !== 'ready-stock' || actual.readyStock !== true || actual.productionLeadTime !== null) {
        throw new Error(`${file}: ${expected.id} ready-stock fields mismatch`);
      }
      if (!notice.includes('預先製作備貨商品') || /5\s*[～~〜－-]\s*7/.test(notice)) {
        throw new Error(`${file}: ${expected.id} must not use drink lead time`);
      }
    }
  }

  const drink30 = products.get('guilu-drink-30');
  if (drink30.unit !== '罐') throw new Error(`${file}: 30cc unit must be 罐`);
  if(file==='data.json'){
    if(!String(drink30.officialOriginalImage||'').includes('/images/products-v3/guilu-drink-30.jpg'))throw new Error(`${file}: 30cc official identity source missing`);
    if(!/(?:current-approved|current-user-confirmed)-product-images/.test(drink30.imagePolicy||''))throw new Error(`${file}: current image policy missing`);
  }
  if(!drink30.usage.includes('每日 1–2 罐')||!drink30.usage.includes('可依個人需求調整'))throw new Error(`${file}: 30cc current usage lost`);

  const activeText = JSON.stringify({
    products: Object.fromEntries([...products].map(([id, product]) => [id, {
      name: product.name,
      displayName: product.displayName,
      specification: product.specification,
      size: product.size,
      spec: product.spec,
      unit: product.unit,
      description: product.description,
      fulfillmentType: product.fulfillmentType,
      fulfillmentNotice: product.fulfillmentNotice,
      productionLeadTime: product.productionLeadTime,
      image: product.image,
      officialOriginalImage: product.officialOriginalImage,
    }])),
    trialCampaign: source.trialCampaign,
    comboOffers: source.comboOffers,
  });
  for (const forbidden of ['龜鹿飲30cc玻璃瓶','30cc／瓶','75g（2兩）','75g （2兩）','柒玄茶・龜鹿調飲粉']) {
    if (activeText.includes(forbidden)) throw new Error(`${file}: forbidden legacy content found: ${forbidden}`);
  }
}

console.log('LINE OA current public authority verified: exact names/specs, fulfillment and official-original 30cc image.');

