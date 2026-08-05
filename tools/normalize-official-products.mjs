import fs from 'node:fs';

const authority = JSON.parse(fs.readFileSync('assets/data/official-products.json', 'utf8'));
const files = ['line-sales-master.json', 'data.json'];
const DRINK_NOTICE = authority.fulfillmentPolicy.drinkNotice;
const STOCK_NOTICE = authority.fulfillmentPolicy.readyStockNotice;
const drinkIds = new Set(authority.fulfillmentPolicy.drinkProductIds);

function productMap(source) {
  if (Array.isArray(source.products)) return new Map(source.products.map((item) => [item.id, item]));
  return new Map(Object.entries(source.products || {}));
}

for (const file of files) {
  const source = JSON.parse(fs.readFileSync(file, 'utf8'));
  const products = productMap(source);
  for (const expected of authority.products) {
    const product = products.get(expected.id);
    if (!product) throw new Error(`${file} missing official product: ${expected.id}`);
    const isDrink = drinkIds.has(expected.id);
    product.name = expected.name;
    if (expected.id === 'guilu-drink-30' || expected.id === 'guilu-drink-180') product.displayName = expected.name;
    product.specification = expected.specification;
    product.size = expected.specification;
    product.spec = expected.specification;
    product.fulfillmentType = isDrink ? 'made-to-order-drink' : 'ready-stock';
    product.fulfillmentNotice = isDrink ? DRINK_NOTICE : STOCK_NOTICE;
    product.productionLeadTime = isDrink ? '5～7個工作天' : null;
    product.readyStock = !isDrink;
    if (expected.id === 'guilu-drink-30') {
      product.unit = '罐';
      product.image = expected.image;
      product.imageUrl = expected.image;
      product.image_url = expected.image;
      product.dmImage = expected.image;
      product.officialOriginalImage = expected.officialOriginalImage;
      product.imagePolicy = expected.imagePolicy;
    }
    if (expected.id === 'guilu-drink-180') product.unit = '包';
    if (expected.id === 'guilu-tangkuai' || expected.id === 'guilu-jiao') product.unit = '盒';
    if (expected.id === 'guilu-gao' || expected.id === 'luerong-fen') product.unit = '罐';
  }
  source.fulfillmentPolicy = {
    version: authority.fulfillmentPolicy.version,
    drinkProductIds: [...authority.fulfillmentPolicy.drinkProductIds],
    readyStockProductIds: [...authority.fulfillmentPolicy.readyStockProductIds],
    drinkNotice: DRINK_NOTICE,
    readyStockNotice: STOCK_NOTICE,
  };
  fs.writeFileSync(file, JSON.stringify(source, null, 2) + '\n');
}

console.log('LINE OA six-product authority v3 normalized in sales master and runtime data.');
