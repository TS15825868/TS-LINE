import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const self = 'tools/lock-confirmed-trial-shipping-v423.mjs';
const officialFulfillment = '資料及運費確認完成後採接單安排製作，約5～7個工作天出貨，不含例假日及物流配送時間';
const orderFulfillment = '訂單資料與付款方式確認完成後採接單安排製作，約5～7個工作天出貨，不含例假日及物流配送時間';
const productionPhrase = ['製作加工約需', '5～7個工作天'].join('');
const onlyProductionPhrase = ['5～7個工作天只計', '製作加工'].join('');
const onlyProductionPhrase2 = ['5～7個工作天僅指', '製作加工'].join('');
const extensions = new Set(['.js', '.mjs', '.json', '.md', '.txt', '.yml', '.yaml', '.html']);

function ext(path) {
  const index = path.lastIndexOf('.');
  return index >= 0 ? path.slice(index).toLowerCase() : '';
}

function walk(directory) {
  const output = [];
  for (const name of readdirSync(directory)) {
    if (name === '.git' || name === 'node_modules') continue;
    const full = join(directory, name);
    const info = statSync(full);
    if (info.isDirectory()) output.push(...walk(full));
    else if (extensions.has(ext(full))) output.push(full);
  }
  return output;
}

function normalizeText(value) {
  let text = String(value);
  const pairs = [
    [`資料及運費確認後安排製作加工，${productionPhrase}；完成後才安排出貨，物流配送時間另計`, officialFulfillment],
    [`資料與運費確認後安排製作加工，${productionPhrase}；完成後才安排出貨，物流配送時間另計`, officialFulfillment],
    [`資料及運費確認後安排製作加工，${productionPhrase}；完成後才安排出貨，另加物流配送時間`, officialFulfillment],
    [`資料與運費確認後安排製作加工，${productionPhrase}；完成後才安排出貨，另加物流配送時間`, officialFulfillment],
    [`資料及運費確認完成後安排製作加工，${productionPhrase}；完成後才安排出貨，物流配送時間另計`, officialFulfillment],
    [`資料與運費確認完成後安排製作加工，${productionPhrase}；完成後才安排出貨，物流配送時間另計`, officialFulfillment],
    [`正式訂單資料與付款方式確認後安排製作加工，${productionPhrase}；完成後才安排出貨，另加物流配送時間`, orderFulfillment],
    [`訂單資料與付款方式確認完成後安排製作加工，${productionPhrase}；完成後才安排出貨，另加物流配送時間`, orderFulfillment],
    [`訂單資料與付款方式確認後安排製作加工，${productionPhrase}；完成後才安排出貨，物流配送時間另計`, orderFulfillment],
    [`${productionPhrase}；完成後才安排出貨，物流配送時間另計`, '約5～7個工作天出貨，不含例假日及物流配送時間'],
    [`${productionPhrase}；完成後才安排出貨，另加物流配送時間`, '約5～7個工作天出貨，不含例假日及物流配送時間'],
    [`${productionPhrase}；完成後才安排出貨`, '約5～7個工作天出貨'],
    [`${onlyProductionPhrase}，不含例假日及完成後的物流配送時間`, '約5～7個工作天出貨，不含例假日及物流配送時間'],
    [`${onlyProductionPhrase2}，不包含完成後的物流配送時間`, '約5～7個工作天出貨，不含例假日及物流配送時間'],
    ['製作加工約5～7工作天，完成後出貨', '接單後安排製作，約5～7個工作天出貨'],
    ['製作加工約5～7個工作天，完成後出貨', '接單後安排製作，約5～7個工作天出貨'],
    ['約5～7個工作天安排出貨', '約5～7個工作天出貨'],
  ];
  for (const [from, to] of pairs) text = text.split(from).join(to);
  return text;
}

function normalizeDeep(value) {
  if (typeof value === 'string') return normalizeText(value);
  if (Array.isArray(value)) return value.map(normalizeDeep);
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) value[key] = normalizeDeep(value[key]);
  }
  return value;
}

let changed = 0;
for (const file of walk(root)) {
  const rel = relative(root, file).replaceAll('\\', '/');
  if (rel === self || rel === 'ci-last-error.txt') continue;
  const before = readFileSync(file, 'utf8');
  const after = normalizeText(before);
  if (after !== before) {
    writeFileSync(file, after);
    changed += 1;
    console.log(`UPDATED ${rel}`);
  }
}

const dataPath = join(root, 'data.json');
const masterPath = join(root, 'line-sales-master.json');
if (!existsSync(dataPath) || !existsSync(masterPath)) throw new Error('缺少 LINE OA 正式資料母本');

const data = normalizeDeep(JSON.parse(readFileSync(dataPath, 'utf8')));
const products = new Map((data.products || []).map((item) => [item.id, item]));
const d30 = products.get('guilu-drink-30');
const d180 = products.get('guilu-drink-180');
if (!d30 || !d180) throw new Error('缺少龜鹿飲30cc或180cc產品');
Object.assign(d30, {
  name: '龜鹿飲30cc玻璃罐', displayName: '龜鹿飲30cc玻璃罐',
  size: '30cc／罐（小玻璃罐）', spec: '30cc／罐（小玻璃罐）', specification: '30cc／罐（小玻璃罐）',
  unit: '罐', price: 50, originalPrice: null,
  offers: [{ qty: 11, total: 500, label: '買10送1' }], promotionTexts: ['買10送1'], quantityOptions: [1, 3, 5, 11],
  priceText: '$50 / 罐', priceLabel: '售價50元，買10送1（共11罐500元）',
});
Object.assign(d180, {
  name: '龜鹿飲180cc鋁袋', displayName: '龜鹿飲180cc鋁袋',
  size: '180cc／包（鋁袋）', spec: '180cc／包（鋁袋）', specification: '180cc／包（鋁袋）',
  unit: '包', price: 200, originalPrice: null,
  offers: [{ qty: 11, total: 2000, label: '買10送1' }], promotionTexts: ['買10送1'], quantityOptions: [1, 3, 5, 11],
  priceText: '$200 / 包', priceLabel: '售價200元，買10送1（共11包2,000元）',
});

data.trialCampaign = {
  ...(data.trialCampaign || {}),
  id: 'guilu-drink-30-evergreen-trial', active: true, evergreen: true,
  title: '龜鹿飲30cc試喝組', contents: '30cc小玻璃罐×3罐', productFee: 0, productFeeText: '試喝品免費',
  shippingOptions: [{ id: 'store', label: '7-11店到店', fee: 60 }, { id: 'home', label: '郵局宅配', fee: 100 }],
  limitRule: '每位顧客、聯絡電話及收件地址限申請一次',
  paymentRule: '試喝運費需先確認並完成付款，試喝組不使用貨到付款',
  fulfillmentRule: officialFulfillment,
  leadTimeDefinition: '接單後安排製作，約5～7個工作天出貨，不含例假日及物流配送時間',
  publicPrice: '龜鹿飲30cc售價50元／罐；買10送1，共11罐500元；另有180cc鋁袋單包200元，買10送1，共11包2,000元',
  lineOnly: true, lineId: '@762jybnm', lineUrl: data.lineUrl || 'https://lin.ee/sHZW7NkR',
};
data.shippingNotes = {
  ...(data.shippingNotes || {}),
  宅配: `${orderFulfillment}。試喝組郵局宅配運費100元。`,
  '7-11賣貨便': `${orderFulfillment}。試喝組7-11店到店運費60元。`,
};
writeFileSync(dataPath, JSON.stringify(normalizeDeep(data), null, 2) + '\n');

const master = normalizeDeep(JSON.parse(readFileSync(masterPath, 'utf8')));
const m30 = master.products?.['guilu-drink-30'];
const m180 = master.products?.['guilu-drink-180'];
if (!m30 || !m180) throw new Error('銷售母本缺少龜鹿飲30cc或180cc');
Object.assign(m30, {
  name: '龜鹿飲30cc玻璃罐', displayName: '龜鹿飲30cc玻璃罐', size: '30cc／罐（小玻璃罐）', spec: '30cc／罐（小玻璃罐）', specification: '30cc／罐（小玻璃罐）',
  unit: '罐', price: 50, offers: ['買10送1'], quantityOptions: [1, 3, 5, 11], offer: { qty: 11, total: 500, label: '買10送1' },
  priceText: '$50 / 罐', priceLabel: '售價50元，買10送1（共11罐500元）',
});
Object.assign(m180, {
  name: '龜鹿飲180cc鋁袋', displayName: '龜鹿飲180cc鋁袋', size: '180cc／包（鋁袋）', spec: '180cc／包（鋁袋）', specification: '180cc／包（鋁袋）',
  unit: '包', price: 200, offers: ['買10送1'], quantityOptions: [1, 3, 5, 11], offer: { qty: 11, total: 2000, label: '買10送1' },
  priceText: '$200 / 包', priceLabel: '售價200元，買10送1（共11包2,000元）',
});
master.trialCampaign = data.trialCampaign;
writeFileSync(masterPath, JSON.stringify(normalizeDeep(master), null, 2) + '\n');

const packagePath = join(root, 'package.json');
const lockPath = join(root, 'package-lock.json');
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
pkg.version = lock.version;
pkg.description = '仙加味 LINE OA 正式版｜30cc三罐試喝品免費、運費自付｜30cc與180cc買10送1｜接單後安排製作，約5～7個工作天出貨｜人工審核後發布';
pkg.scripts.prestart = 'node tools/apply-evergreen-trial-campaign.mjs && node tools/lock-confirmed-trial-shipping-v423.mjs';
pkg.scripts.pretest = 'node tools/apply-evergreen-trial-campaign.mjs && node tools/repair-evergreen-trial-tests.mjs && node tools/lock-confirmed-trial-shipping-v423.mjs';
pkg.scripts['sync:catalog'] = 'node tools/sync_website_catalog.js --write && node tools/sync_sales_master.js --write && node tools/lock-confirmed-trial-shipping-v423.mjs';
pkg.scripts['check:catalog'] = 'node tools/sync_website_catalog.js --check && node tools/sync_sales_master.js && node tools/lock-confirmed-trial-shipping-v423.mjs';
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

const wrapper = `import './lock-confirmed-trial-shipping-v423.mjs';\n`;
writeFileSync(join(root, 'tools/finalize-evergreen-trial-buy10get1-v412.mjs'), wrapper);
writeFileSync(join(root, 'tools/finalize-trial-production-lead-time-v415.mjs'), wrapper);
rmSync(join(root, 'ci-last-error.txt'), { force: true });

for (const file of walk(root)) {
  const rel = relative(root, file).replaceAll('\\', '/');
  if (rel === self) continue;
  const text = readFileSync(file, 'utf8');
  for (const bad of [productionPhrase, onlyProductionPhrase, onlyProductionPhrase2, '買10送2', '共12罐500元', '共12包2,000元', '30cc／瓶（小玻璃瓶）']) {
    if (text.includes(bad)) throw new Error(`${rel} 仍含舊正式資料：${bad}`);
  }
}

const finalData = JSON.parse(readFileSync(dataPath, 'utf8'));
const serialized = JSON.stringify(finalData);
for (const required of ['龜鹿飲30cc玻璃罐', '30cc／罐（小玻璃罐）', '龜鹿飲180cc鋁袋', '30cc小玻璃罐×3罐', '試喝品免費', '買10送1', '約5～7個工作天出貨']) {
  if (!serialized.includes(required)) throw new Error(`LINE OA 母本缺少：${required}`);
}

mkdirSync(join(root, 'diagnostics'), { recursive: true });
writeFileSync(join(root, 'diagnostics/confirmed-trial-shipping-v423.json'), JSON.stringify({
  status: 'success',
  rule: officialFulfillment,
  trial: '30cc小玻璃罐3罐免費；7-11運費60元；郵局宅配100元；每位顧客／電話／地址限一次；LINE OA完成',
  promotion30: '買10送1，共11罐500元',
  promotion180: '買10送1，共11包2,000元',
  owner_review_required: true,
  changed_text_files: changed
}, null, 2) + '\n');

console.log(`PASS LINE OA 正式規則：小玻璃罐、買10送1、約5～7個工作天出貨；更新 ${changed} 個文字檔。`);
