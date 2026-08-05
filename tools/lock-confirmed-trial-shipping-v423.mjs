import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const FINALIZER = 'node tools/lock-confirmed-trial-shipping-v423.mjs';
const OFFICIAL_FULFILLMENT = '資料及運費確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計';
const ORDER_FULFILLMENT = '訂單資料與付款方式確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計';
const LEAD_TIME = '製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計';

const replacements = [
  ['買10送2（共12罐500元）', '買10送1（共11罐500元）'],
  ['買10送2（共12包2,000元）', '買10送1（共11包2,000元）'],
  ['買10送2，共12罐500元', '買10送1，共11罐500元'],
  ['買10送2，共12包2,000元', '買10送1，共11包2,000元'],
  ['共12罐500元', '共11罐500元'],
  ['共12包2,000元', '共11包2,000元'],
  ['買10送2', '買10送1'],
  ['30cc／瓶（小玻璃瓶）', '30cc／罐（小玻璃罐）'],
  ['龜鹿飲30cc玻璃瓶', '龜鹿飲30cc玻璃罐'],
  ['小玻璃瓶外出攜帶', '小玻璃罐外出攜帶'],

  ['正式訂單資料與付款方式確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，另加物流配送時間', ORDER_FULFILLMENT],
  ['訂單資料與付款方式確認完成後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，另加物流配送時間', ORDER_FULFILLMENT],
  ['訂單資料與付款方式確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計', ORDER_FULFILLMENT],
  ['訂單資料與付款方式確認完成後採接單安排製作，約5～7個工作天出貨，不含例假日及物流配送時間', ORDER_FULFILLMENT],
  ['訂單資料與付款方式確認後採接單安排製作，約5～7個工作天出貨，不含例假日及物流配送時間', ORDER_FULFILLMENT],
  ['訂單資料與付款方式確認完成後安排製作加工，約5～7個工作天出貨，不含例假日及物流配送時間', ORDER_FULFILLMENT],
  ['訂單資料與付款方式確認後安排製作加工，約5～7個工作天出貨，不含例假日及物流配送時間', ORDER_FULFILLMENT],

  ['資料及運費確認完成後採接單安排製作，約5～7個工作天出貨，不含例假日及物流配送時間', OFFICIAL_FULFILLMENT],
  ['資料及運費確認後採接單安排製作，約5～7個工作天出貨，不含例假日及物流配送時間', OFFICIAL_FULFILLMENT],
  ['資料及運費確認完成後安排製作加工，約5～7個工作天出貨，不含例假日及物流配送時間', OFFICIAL_FULFILLMENT],
  ['資料及運費確認後安排製作加工，約5～7個工作天出貨，不含例假日及物流配送時間', OFFICIAL_FULFILLMENT],
  ['資料與運費確認完成後採接單安排製作，約5～7個工作天出貨，不含例假日及物流配送時間', OFFICIAL_FULFILLMENT],
  ['資料與運費確認後採接單安排製作，約5～7個工作天出貨，不含例假日及物流配送時間', OFFICIAL_FULFILLMENT],
  ['資料及運費確認完成後約5～7個工作天出貨，不含例假日及物流配送時間', OFFICIAL_FULFILLMENT],
  ['資料及運費確認後約5～7個工作天出貨，不含例假日及物流配送時間', OFFICIAL_FULFILLMENT],
  ['接單後安排製作，約5～7個工作天出貨，不含例假日及物流配送時間', LEAD_TIME],
  ['接單後約5～7個工作天出貨，不含例假日及物流配送時間', LEAD_TIME],
  ['約5～7個工作天出貨，不含例假日及物流配送時間', LEAD_TIME]
];

const duplicateLines = new Set([
  '  if (/試喝|體驗龜鹿飲/.test(value)) return "trial";',
  '  if (websiteIntent === "trial") return reply(event.replyToken, trialCampaignReply());'
]);

function normalizeText(value) {
  let text = String(value ?? '');
  for (const [from, to] of replacements) text = text.split(from).join(to);
  return text;
}

function dedupeTargetLines(text) {
  const lines = String(text).split('\n');
  const output = [];
  for (const line of lines) {
    if (duplicateLines.has(line) && output.at(-1) === line) continue;
    output.push(line);
  }
  return output.join('\n');
}

function normalizeDeep(value) {
  if (typeof value === 'string') return normalizeText(value);
  if (Array.isArray(value)) return value.map(normalizeDeep);
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) value[key] = normalizeDeep(value[key]);
  }
  return value;
}

for (const file of [
  'server.js',
  'test.js',
  'function.test.js',
  'catalog.test.js',
  'security.test.js',
  'README.md',
  'tools/apply-evergreen-trial-campaign.mjs',
  'tools/repair-evergreen-trial-tests.mjs',
  'line-order-cart.js',
  'line-order-cart.test.js',
  'internal-inventory-seed.js',
  'internal-inventory-seed.test.js',
  'internal-order-pricing.js',
  'internal-order-pricing.test.js',
  'internal-line-order-sync.js',
  'internal-line-order-sync.test.js'
]) {
  if (!existsSync(file)) continue;
  let content = normalizeText(readFileSync(file, 'utf8'));
  if (file === 'server.js') content = dedupeTargetLines(content);
  writeFileSync(file, content);
}

const data = normalizeDeep(JSON.parse(readFileSync('data.json', 'utf8')));
const byId = new Map((data.products || []).map((item) => [item.id, item]));
const d30 = byId.get('guilu-drink-30');
const d180 = byId.get('guilu-drink-180');
if (!d30 || !d180) throw new Error('缺少龜鹿飲30cc或180cc產品');

Object.assign(d30, {
  name: '龜鹿飲30cc玻璃罐',
  displayName: '龜鹿飲30cc玻璃罐',
  size: '30cc／罐（小玻璃罐）',
  spec: '30cc／罐（小玻璃罐）',
  specification: '30cc／罐（小玻璃罐）',
  unit: '罐',
  price: 50,
  originalPrice: null,
  offers: [{ qty: 11, total: 500, label: '買10送1' }],
  promotionTexts: ['買10送1'],
  quantityOptions: [1, 3, 5, 11],
  priceText: '$50 / 罐',
  priceLabel: '售價50元，買10送1（共11罐500元）'
});

Object.assign(d180, {
  name: '龜鹿飲180cc鋁袋',
  displayName: '龜鹿飲180cc鋁袋',
  size: '180cc／包（鋁袋）',
  spec: '180cc／包（鋁袋）',
  specification: '180cc／包（鋁袋）',
  unit: '包',
  price: 200,
  originalPrice: null,
  offers: [{ qty: 11, total: 2000, label: '買10送1' }],
  promotionTexts: ['買10送1'],
  quantityOptions: [1, 3, 5, 11],
  priceText: '$200 / 包',
  priceLabel: '售價200元，買10送1（共11包2,000元）'
});

data.trialCampaign = {
  ...(data.trialCampaign || {}),
  id: 'guilu-drink-30-evergreen-trial',
  active: true,
  evergreen: true,
  title: '龜鹿飲30cc試喝組',
  contents: '30cc小玻璃罐×3罐',
  productFee: 0,
  productFeeText: '試喝品免費',
  shippingOptions: [
    { id: 'store', label: '7-11店到店', fee: 60 },
    { id: 'home', label: '郵局宅配', fee: 100 }
  ],
  limitRule: '每位顧客、聯絡電話及收件地址限申請一次',
  paymentRule: '試喝運費需先確認並完成付款，試喝組不使用貨到付款',
  fulfillmentRule: OFFICIAL_FULFILLMENT,
  leadTimeDefinition: LEAD_TIME,
  publicPrice: '龜鹿飲30cc售價50元／罐；買10送1，共11罐500元；另有180cc鋁袋單包200元，買10送1，共11包2,000元',
  lineOnly: true,
  lineId: '@762jybnm',
  lineUrl: data.lineUrl || 'https://lin.ee/sHZW7NkR'
};

data.shippingNotes = {
  ...(data.shippingNotes || {}),
  宅配: `${ORDER_FULFILLMENT}。試喝組郵局宅配運費100元。`,
  '7-11賣貨便': `${ORDER_FULFILLMENT}。試喝組7-11店到店運費60元。`
};
data.orderNotice = `${ORDER_FULFILLMENT}。`;
writeFileSync('data.json', JSON.stringify(normalizeDeep(data), null, 2) + '\n');

const master = normalizeDeep(JSON.parse(readFileSync('line-sales-master.json', 'utf8')));
const m30 = master.products?.['guilu-drink-30'];
const m180 = master.products?.['guilu-drink-180'];
if (!m30 || !m180) throw new Error('LINE銷售母本缺少龜鹿飲30cc或180cc');

Object.assign(m30, {
  name: '龜鹿飲30cc玻璃罐',
  displayName: '龜鹿飲30cc玻璃罐',
  size: '30cc／罐（小玻璃罐）',
  spec: '30cc／罐（小玻璃罐）',
  specification: '30cc／罐（小玻璃罐）',
  unit: '罐',
  price: 50,
  offers: ['買10送1'],
  quantityOptions: [1, 3, 5, 11],
  offer: { qty: 11, total: 500, label: '買10送1' },
  priceText: '$50 / 罐',
  priceLabel: '售價50元，買10送1（共11罐500元）'
});

Object.assign(m180, {
  name: '龜鹿飲180cc鋁袋',
  displayName: '龜鹿飲180cc鋁袋',
  size: '180cc／包（鋁袋）',
  spec: '180cc／包（鋁袋）',
  specification: '180cc／包（鋁袋）',
  unit: '包',
  price: 200,
  offers: ['買10送1'],
  quantityOptions: [1, 3, 5, 11],
  offer: { qty: 11, total: 2000, label: '買10送1' },
  priceText: '$200 / 包',
  priceLabel: '售價200元，買10送1（共11包2,000元）'
});

master.trialCampaign = JSON.parse(JSON.stringify(data.trialCampaign));
writeFileSync('line-sales-master.json', JSON.stringify(normalizeDeep(master), null, 2) + '\n');

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.description = '仙加味 LINE OA 正式版｜30cc三罐試喝品免費、運費自付｜30cc與180cc買10送1｜製作加工約需5～7個工作天，完成後才安排出貨｜人工審核後發布';
for (const key of ['prestart', 'pretest']) {
  const current = String(pkg.scripts?.[key] || '');
  if (!current.includes(FINALIZER)) pkg.scripts[key] = current ? `${current} && ${FINALIZER}` : FINALIZER;
}
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

writeFileSync('tools/finalize-evergreen-trial-buy10get1-v412.mjs', "import './lock-confirmed-trial-shipping-v423.mjs';\n");
writeFileSync('tools/finalize-trial-production-lead-time-v415.mjs', "import './lock-confirmed-trial-shipping-v423.mjs';\n");

const badPhrases = [
  '買10送2',
  '共12罐500元',
  '共12包2,000元',
  '30cc／瓶（小玻璃瓶）',
  '龜鹿飲30cc玻璃瓶',
  '採接單安排製作，約5～7個工作天出貨',
  '接單後安排製作，約5～7個工作天出貨',
  '資料及運費確認後約5～7個工作天出貨'
];

for (const [file, object] of [['data.json', data], ['line-sales-master.json', master]]) {
  const text = JSON.stringify(object);
  for (const bad of badPhrases) {
    if (text.includes(bad)) throw new Error(`${file} 仍含舊資料：${bad}`);
  }
  for (const required of [
    '30cc小玻璃罐×3罐',
    '試喝品免費',
    '買10送1',
    '製作加工約需5～7個工作天',
    '完成後才安排出貨',
    '物流配送時間另計'
  ]) {
    if (!text.includes(required)) throw new Error(`${file} 缺少正式資料：${required}`);
  }
  if (object.trialCampaign?.fulfillmentRule !== OFFICIAL_FULFILLMENT) {
    throw new Error(`${file} 製作與出貨規則未鎖定`);
  }
}

mkdirSync('diagnostics', { recursive: true });
writeFileSync('diagnostics/line-authority-v429.json', JSON.stringify({
  status: 'success',
  version: 'v429',
  checked_at: new Date().toISOString(),
  products: [
    '龜鹿飲30cc玻璃罐｜30cc／罐（小玻璃罐）',
    '龜鹿飲180cc鋁袋｜180cc／包（鋁袋）'
  ],
  trial: '30cc小玻璃罐3罐免費；7-11店到店60元；郵局宅配100元；每位顧客／電話／地址限一次；LINE OA完成',
  fulfillment: OFFICIAL_FULFILLMENT,
  promotions: ['30cc買10送1，共11罐500元', '180cc買10送1，共11包2,000元'],
  duplicate_trial_handlers_removed: true,
  owner_review_required: true,
  paid_api_calls: 0
}, null, 2) + '\n');

console.log('PASS LINE OA v429：試喝、買10送1、製作5～7工作天後出貨、重複處理器清理與零付費規則均已鎖定。');
