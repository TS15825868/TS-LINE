import fs from 'node:fs';

const authority = JSON.parse(fs.readFileSync('assets/data/official-products.json', 'utf8'));
const source = JSON.parse(fs.readFileSync('line-sales-master.json', 'utf8'));
const products = source.products || {};

for (const expected of authority.products) {
  const actual = products[expected.id];
  if (!actual) throw new Error(`Missing official product: ${expected.id}`);
  const spec = actual.specification || actual.size || actual.spec;
  if (spec !== expected.specification) {
    throw new Error(`${expected.id} specification mismatch: ${spec} !== ${expected.specification}`);
  }
}

const ids = Object.keys(products);
if (ids.length !== 6) throw new Error(`Official product count must be 6, got ${ids.length}`);

const activeText = JSON.stringify({
  products: Object.fromEntries(Object.entries(source.products).map(([id, product]) => [id, {
    name: product.name,
    displayName: product.displayName,
    specification: product.specification,
    size: product.size,
    spec: product.spec,
    unit: product.unit,
    description: product.description,
  }])),
  trialCampaign: source.trialCampaign,
  comboOffers: source.comboOffers,
});
for (const forbidden of authority.forbidden) {
  if (activeText.includes(forbidden)) throw new Error(`Forbidden legacy specification found: ${forbidden}`);
}

if (products['guilu-drink-30'].unit !== '罐') throw new Error('30cc unit must be 罐');
console.log('LINE OA official product specifications verified.');
