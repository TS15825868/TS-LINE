import fs from 'node:fs';

const authority = JSON.parse(fs.readFileSync('assets/data/official-products.json', 'utf8'));
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
  if (products.size !== 6) throw new Error(`${file}: official product count must be 6, got ${products.size}`);

  for (const expected of authority.products) {
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
  if (!String(drink30.image || '').includes('/assets/guilu-drink-30-clean.jpg')) throw new Error(`${file}: 30cc image must use Render clean endpoint`);
  if (!String(drink30.officialOriginalImage || '').includes('/images/guilu-drink-30cc-glass.jpg')) throw new Error(`${file}: 30cc official original source missing`);
  if (drink30.imagePolicy !== 'official-original-contain-no-crop') throw new Error(`${file}: 30cc image policy mismatch`);
  if (source.fulfillmentPolicy?.version !== '2026-08-05-v2') throw new Error(`${file}: fulfillment policy version mismatch`);

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
  for (const forbidden of authority.forbidden) {
    if (activeText.includes(forbidden)) throw new Error(`${file}: forbidden legacy content found: ${forbidden}`);
  }
}

console.log('LINE OA six-product authority v3 verified: exact names/specs, fulfillment v2 and official-original 30cc image.');
