import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const FINALIZER = 'node tools/finalize-evergreen-trial-buy10get1-v412.mjs';
const OFFICIAL_FULFILLMENT = '資料及運費確認後採接單安排製作，約5～7個工作天出貨；不含例假日及物流配送時間';
const ORDER_FULFILLMENT = '訂單資料與付款方式確認完成後採接單安排製作，約5～7個工作天出貨；不含例假日及物流配送時間';
const textFiles = [
  'server.js', 'test.js', 'function.test.js', 'catalog.test.js', 'security.test.js', 'README.md',
  'tools/apply-evergreen-trial-campaign.mjs',
];
const replacements = [
  ['買10送2（共12罐500元）', '買10送1（共11罐500元）'],
  ['買10送2（共12包2,000元）', '買10送1（共11包2,000元）'],
  ['買10送2，共12罐500元', '買10送1，共11罐500元'],
  ['買10送2，共12包2,000元', '買10送1，共11包2,000元'],
  ['共12罐500元', '共11罐500元'],
  ['共12包2,000元', '共11包2,000元'],
  ['買10送2', '買10送1'],
  ['qty: 12, total: 500', 'qty: 11, total: 500'],
  ['qty: 12, total: 2000', 'qty: 11, total: 2000'],
  ['[1, 3, 5, 12]', '[1, 3, 5, 11]'],
  ['calcItem(drink30, 12)', 'calcItem(drink30, 11)'],
  ['calcItem(drink30, 24)', 'calcItem(drink30, 22)'],
  ['addCart(state, drink30, 12)', 'addCart(state, drink30, 11)'],
  ['買10送2×1＋單罐×1', '買10送1×1＋單罐×1'],
  ['買10送2×1', '買10送1×1'],
  ['買10送2×2', '買10送1×2'],
  ["offers.includes('買10送2')", "offers.includes('買10送1')"],
  ['資料及運費確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計', OFFICIAL_FULFILLMENT],
  ['資料與運費確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計', OFFICIAL_FULFILLMENT],
  ['資料及運費確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，另加物流配送時間', OFFICIAL_FULFILLMENT],
  ['資料與運費確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，另加物流配送時間', OFFICIAL_FULFILLMENT],
  ['正式訂單資料與付款方式確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，另加物流配送時間', ORDER_FULFILLMENT],
  ['訂單資料與付款方式確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，另加物流配送時間', ORDER_FULFILLMENT],
  ['製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計', '約5～7個工作天出貨；不含例假日及物流配送時間'],
  ['製作加工約需5～7個工作天；完成後才安排出貨，另加物流配送時間', '約5～7個工作天出貨；不含例假日及物流配送時間'],
  ['製作加工約需5～7個工作天，完成後才安排出貨', '約5～7個工作天出貨'],
  ['5～7個工作天僅指製作加工，不包含完成後的物流配送時間', '接單安排製作後約5～7個工作天出貨，不含例假日及物流配送時間'],
  ['5～7個工作天只計製作加工，不含例假日及完成後的物流配送時間', '接單安排製作後約5～7個工作天出貨，不含例假日及物流配送時間'],
  ['約5～7個工作天安排出貨', '約5～7個工作天出貨'],
];

function normalizeOfficialText(value) {
  let text = String(value);
  for (const [from, to] of replacements) text = text.split(from).join(to);
  return text;
}

function normalizeDeep(value) {
  if (typeof value === 'string') return normalizeOfficialText(value);
  if (Array.isArray(value)) return value.map(normalizeDeep);
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) value[key] = normalizeDeep(value[key]);
  }
  return value;
}

for (const file of textFiles) {
  if (!existsSync(file)) continue;
  writeFileSync(file, normalizeOfficialText(readFileSync(file, 'utf8')));
}

const data = JSON.parse(readFileSync('data.json', 'utf8'));
const byId = new Map((data.products || []).map((item) => [item.id, item]));
const d30 = byId.get('guilu-drink-30');
const d180 = byId.get('guilu-drink-180');
if (!d30 || !d180) throw new Error('缺少龜鹿飲30cc或180cc');
Object.assign(d30, {
  name: '龜鹿飲30cc玻璃罐', displayName: '龜鹿飲30cc玻璃罐',
  size: '30cc／罐（小玻璃罐）', spec: '30cc／罐（小玻璃罐）', specification: '30cc／罐（小玻璃罐）', unit: '罐',
  price: 50, originalPrice: null,
  offers: [{ qty: 11, total: 500, label: '買10送1' }], promotionTexts: ['買10送1'], quantityOptions: [1, 3, 5, 11],
  priceText: '$50 / 罐', priceLabel: '售價50元，買10送1（共11罐500元）',
});
Object.assign(d180, {
  name: '龜鹿飲180cc鋁袋', displayName: '龜鹿飲180cc鋁袋',
  size: '180cc／包（鋁袋）', spec: '180cc／包（鋁袋）', specification: '180cc／包（鋁袋）', unit: '包',
  price: 200, originalPrice: null,
  offers: [{ qty: 11, total: 2000, label: '買10送1' }], promotionTexts: ['買10送1'], quantityOptions: [1, 3, 5, 11],
  priceText: '$200 / 包', priceLabel: '售價200元，買10送1（共11包2,000元）',
});

data.trialCampaign = {
  ...(data.trialCampaign || {}),
  id: 'guilu-drink-30-evergreen-trial', active: true, evergreen: true,
  title: '龜鹿飲30cc試喝組', contents: '30cc小玻璃罐×3罐',
  productFee: 0, productFeeText: '試喝品免費',
  shippingOptions: [{ id: 'store', label: '7-11店到店', fee: 60 }, { id: 'home', label: '郵局宅配', fee: 100 }],
  limitRule: '每位顧客、聯絡電話及收件地址限申請一次',
  paymentRule: '試喝運費需先確認並完成付款，試喝組不使用貨到付款',
  fulfillmentRule: OFFICIAL_FULFILLMENT,
  leadTimeDefinition: '接單安排製作後約5～7個工作天出貨，不含例假日及物流配送時間',
  publicPrice: '龜鹿飲30cc售價50元／罐；買10送1，共11罐500元；另有180cc鋁袋單包200元，買10送1，共11包2,000元',
  lineOnly: true, lineId: '@762jybnm', lineUrl: data.lineUrl || 'https://lin.ee/sHZW7NkR',
};
data.shippingNotes = {
  ...(data.shippingNotes || {}),
  宅配: `${ORDER_FULFILLMENT}。試喝組郵局宅配運費100元。`,
  '7-11賣貨便': `${ORDER_FULFILLMENT}。試喝組7-11店到店運費60元。`,
};
normalizeDeep(data);
writeFileSync('data.json', JSON.stringify(data, null, 2) + '\n');

if (existsSync('line-sales-master.json')) {
  const master = JSON.parse(readFileSync('line-sales-master.json', 'utf8'));
  const m30 = master.products?.['guilu-drink-30'];
  const m180 = master.products?.['guilu-drink-180'];
  if (m30) Object.assign(m30, {
    name: '龜鹿飲30cc玻璃罐', displayName: '龜鹿飲30cc玻璃罐', size: '30cc／罐（小玻璃罐）', spec: '30cc／罐（小玻璃罐）', specification: '30cc／罐（小玻璃罐）', unit: '罐', price: 50,
    offers: ['買10送1'], quantityOptions: [1, 3, 5, 11], offer: { qty: 11, total: 500, label: '買10送1' }, priceText: '$50 / 罐', priceLabel: '售價50元，買10送1（共11罐500元）',
  });
  if (m180) Object.assign(m180, {
    name: '龜鹿飲180cc鋁袋', displayName: '龜鹿飲180cc鋁袋', size: '180cc／包（鋁袋）', spec: '180cc／包（鋁袋）', specification: '180cc／包（鋁袋）', unit: '包', price: 200,
    offers: ['買10送1'], quantityOptions: [1, 3, 5, 11], offer: { qty: 11, total: 2000, label: '買10送1' }, priceText: '$200 / 包', priceLabel: '售價200元，買10送1（共11包2,000元）',
  });
  master.trialCampaign = data.trialCampaign;
  normalizeDeep(master);
  writeFileSync('line-sales-master.json', JSON.stringify(master, null, 2) + '\n');
}

if (existsSync('package.json')) {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const key of ['prestart', 'pretest']) {
    const current = String(pkg.scripts?.[key] || '');
    if (!current.includes(FINALIZER)) pkg.scripts[key] = current ? `${current} && ${FINALIZER}` : FINALIZER;
  }
  pkg.description = '仙加味 LINE OA 正式版｜30cc三罐試喝品免費、運費自付｜30cc與180cc買10送1｜接單後約5～7個工作天出貨｜人工審核後發布';
  writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
}

const verification = JSON.stringify(data);
for (const bad of ['買10送2', '共12罐500元', '共12包2,000元', '30cc／瓶（小玻璃瓶）', '製作加工約需5～7個工作天', '5～7個工作天只計製作加工']) {
  if (verification.includes(bad)) throw new Error(`LINE母本仍有舊資料：${bad}`);
}
if (!verification.includes('買10送1') || !verification.includes('約5～7個工作天出貨')) throw new Error('LINE母本缺少正式活動或出貨規則');
console.log('PASS LINE OA：長期試喝、30cc／180cc買10送1，以及接單後約5～7個工作天出貨規則已完成。');
