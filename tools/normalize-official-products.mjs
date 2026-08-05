import fs from 'node:fs';

const authority = JSON.parse(fs.readFileSync('assets/data/official-products.json', 'utf8'));
const file = 'line-sales-master.json';
const source = JSON.parse(fs.readFileSync(file, 'utf8'));
const products = source.products || {};

for (const expected of authority.products) {
  const product = products[expected.id];
  if (!product) throw new Error(`Missing official product: ${expected.id}`);
  product.specification = expected.specification;
  if ('size' in product) product.size = expected.specification;
  if ('spec' in product) product.spec = expected.specification;
}

const drink30 = products['guilu-drink-30'];
if (drink30) {
  drink30.name = '龜鹿飲30cc玻璃罐';
  drink30.displayName = '龜鹿飲30cc玻璃罐';
  drink30.unit = '罐';
}

const soup = products['guilu-tangkuai'];
if (soup) soup.name = '龜鹿湯塊75g';
const jiao = products['guilu-jiao'];
if (jiao) {
  jiao.name = '龜鹿膠';
  jiao.unit = '盒';
}

fs.writeFileSync(file, JSON.stringify(source, null, 2) + '\n');
console.log('LINE OA official product specifications normalized.');
